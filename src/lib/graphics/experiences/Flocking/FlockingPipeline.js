// FlockingPipeline.js

import Pipeline from '../../pipelines/Pipeline';
import birdShader from './birdShader.wgsl';
import flockingShader from './flockingShader.wgsl';

export default class FlockingPipeline extends Pipeline {
    constructor(device, camera, viewportBuffer, mouseBuffer, birdCount) {
        super(device);
        this.camera = camera;
        this.viewportBuffer = viewportBuffer;
        this.mouseBuffer = mouseBuffer;
        this.birdCount = birdCount;

        // Buffers for bird-specific data
        this.phaseBuffer = null; // For wing flapping animation
        this.positionBuffer = null; // For bird positions
        this.velocityBuffer = null; // For bird velocities

        // Compute Pipeline related
        this.computePipeline = null;
        this.computeBindGroup = null;
        this.deltaTimeBuffer = null;

        // Flocking Parameters
        this.flockingParamsBuffer = null;
        this.flockingParams = {
			separation: 1000.0,
			alignment: 5.0,
			cohesion: 10.0, 
            centerGravity: new Float32Array([0.0, 0.0, 0.0])
        };
    }

    async initialize() {
        const format = navigator.gpu.getPreferredCanvasFormat();
        const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

        // Create buffers for bird phases, positions, and velocities
        this.phaseBuffer = this.device.createBuffer({
            size: this.birdCount * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Phase Buffer'
        });

        this.positionBuffer = this.device.createBuffer({
            size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each position has x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Position Buffer'
        });

        this.velocityBuffer = this.device.createBuffer({
            size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each velocity has x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Velocity Buffer'
        });

        // Initialize Compute Shader
        await this.initializeComputePipeline();

        // Initialize Render Shader Pipeline
        await this.initializeRenderPipeline(format, projectionBuffer, viewBuffer);
    }

    async initializeComputePipeline() {
        // Create a shader module for the combined compute shader
        const computeModule = this.device.createShaderModule({
            code: flockingShader
        });

        // Create a bind group layout for the compute shader
        const computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // deltaTime
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // positions
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // velocities
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // flocking parameters
            ]
        });

        // Create the compute pipeline
        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [computeBindGroupLayout]
            }),
            compute: {
                module: computeModule,
                entryPoint: 'main'
            }
        });

        // Create a buffer for deltaTime (uniform)
        this.deltaTimeBuffer = this.device.createBuffer({
            size: 4, // size of f32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Delta Time Buffer'
        });

        // Create a buffer for flocking parameters (uniform)
		this.flockingParamsBuffer = this.device.createBuffer({
			size: 8 * Float32Array.BYTES_PER_ELEMENT, // 32 bytes (8 floats)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Flocking Parameters Buffer'
		});

        // Initialize flocking parameters
        this.updateFlockingParams();

        // Create the compute bind group
        this.computeBindGroup = this.device.createBindGroup({
            layout: computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.deltaTimeBuffer } },
                { binding: 1, resource: { buffer: this.positionBuffer } },
                { binding: 2, resource: { buffer: this.velocityBuffer } },
                { binding: 3, resource: { buffer: this.flockingParamsBuffer } }
            ]
        });
    }

    async initializeRenderPipeline(format, projectionBuffer, viewBuffer) {
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'Flocking Pipeline Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
                { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Position Buffer
                { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Phase Buffer
                { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Mouse Buffer
                { binding: 6, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } } // Velocity Buffer
            ]
        });

        // Create the render pipeline
        this.pipeline = this.device.createRenderPipeline({
            label: 'Flocking Render Pipeline',
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: birdShader }),
                entryPoint: 'vertex_main',
                buffers: [
                    {
                        arrayStride: 12, // Each vertex is 3 floats (x, y, z)
                        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: birdShader }),
                entryPoint: 'fragment_main',
                targets: [{ format }]
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // Create the render bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: projectionBuffer } },
                { binding: 1, resource: { buffer: viewBuffer } },
                { binding: 2, resource: { buffer: this.viewportBuffer } },
                { binding: 3, resource: { buffer: this.positionBuffer } },
                { binding: 4, resource: { buffer: this.phaseBuffer } },
                { binding: 5, resource: { buffer: this.mouseBuffer } },
                { binding: 6, resource: { buffer: this.velocityBuffer } }
            ]
        });
    }

    render(commandEncoder, passDescriptor, objects) {
        // Update flocking and positions via compute shader
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        const workgroupSize = 64;
        const workgroups = Math.ceil(this.birdCount / workgroupSize);
        computePass.dispatchWorkgroups(workgroups);
        computePass.end();

        // Begin render pass
        const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);

        // Assuming all objects share the same geometry
        const firstObject = objects[0];
        passEncoder.setVertexBuffer(0, firstObject.getVertexBuffer());
        passEncoder.setIndexBuffer(firstObject.getIndexBuffer(), 'uint16');

        // Use instancing to draw all birds in a single call
        passEncoder.drawIndexed(firstObject.getIndexCount(), this.birdCount, 0, 0, 0);

        passEncoder.end();
    }

    updatePhases(time) {
        // Update phases for wing flapping (e.g., sinusoidal animation)
        const phases = new Float32Array(this.birdCount);
        for (let i = 0; i < this.birdCount; i++) {
            phases[i] = Math.sin(time * 0.01 + i * 0.1); // Add slight offset for variety
        }
        this.device.queue.writeBuffer(this.phaseBuffer, 0, phases);
    }

	updateFlockingParams() {
		// Update flocking parameters buffer
		const params = new Float32Array([
			this.flockingParams.separation,
			this.flockingParams.alignment,
			this.flockingParams.cohesion,
			this.flockingParams.centerGravity[0],
			this.flockingParams.centerGravity[1],
			this.flockingParams.centerGravity[2],
			0.0, // Padding for vec4
			0.0  // Padding for vec4
		]);
		this.device.queue.writeBuffer(this.flockingParamsBuffer, 0, params);
	}
	
    initializeBuffers(initialPositions, initialVelocities) {
        // Method to initialize position and velocity buffers
        const posArray = new Float32Array(initialPositions.flat());
        this.device.queue.writeBuffer(this.positionBuffer, 0, posArray);

        const velArray = new Float32Array(initialVelocities.flat());
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velArray);
    }

    setFlockingParameters(separation, alignment, cohesion, centerGravity = [0.0, 0.0, 0.0]) {
        // Update flocking parameters
        this.flockingParams.separation = separation;
        this.flockingParams.alignment = alignment;
        this.flockingParams.cohesion = cohesion;
        this.flockingParams.centerGravity = new Float32Array(centerGravity);
        this.updateFlockingParams();
    }

    updateDeltaTime(deltaTime) {
        // Update the deltaTime buffer
        const deltaTimeArray = new Float32Array([deltaTime]);
        this.device.queue.writeBuffer(this.deltaTimeBuffer, 0, deltaTimeArray);
    }

    cleanup() {
        if (this.phaseBuffer) this.phaseBuffer.destroy();
        if (this.positionBuffer) this.positionBuffer.destroy();
        if (this.velocityBuffer) this.velocityBuffer.destroy();
        // if (this.computePipeline) this.computePipeline.destroy();
        // if (this.computeBindGroup) this.computeBindGroup.destroy();
        if (this.flockingParamsBuffer) this.flockingParamsBuffer.destroy();
        // if (this.pipeline) this.pipeline.destroy();
        // if (this.bindGroup) this.bindGroup.destroy();
        super.cleanup();
    }
}