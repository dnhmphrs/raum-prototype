// FlockingPipeline.js

import Pipeline from '../../pipelines/Pipeline';
import birdShader from './birdShader.wgsl';
import positionUpdateShader from './positionUpdateShader.wgsl';
import flockingComputeShader from './flockingComputeShader.wgsl';

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
        this.positionComputePipeline = null;
        this.positionComputeBindGroup = null;
        this.deltaTimeBuffer = null;

        // Flocking Compute Pipeline
        this.flockingComputePipeline = null;
        this.flockingBindGroup = null;
        this.flockingParamsBuffer = null;
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
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'Position Buffer'
        });

        this.velocityBuffer = this.device.createBuffer({
            size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each velocity has x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Velocity Buffer'
        });

        // Initialize Compute Shaders
        await this.initializeFlockingComputePipeline();
        await this.initializePositionUpdatePipeline();

        // Initialize Render Shader Pipeline
        await this.initializeRenderPipeline(format, projectionBuffer, viewBuffer);
    }

    async initializeFlockingComputePipeline() {
        // Create a shader module for the flocking compute shader
        const flockingComputeModule = this.device.createShaderModule({
            code: flockingComputeShader
        });

        // Create a bind group layout for the flocking compute shader
        const flockingBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // deltaTime
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // positions
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // velocities
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // flocking parameters
            ]
        });

        // Create the flocking compute pipeline
        this.flockingComputePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [flockingBindGroupLayout]
            }),
            compute: {
                module: flockingComputeModule,
                entryPoint: 'main'
            }
        });

        // Create a buffer for flocking parameters (separation, alignment, cohesion)
        this.flockingParamsBuffer = this.device.createBuffer({
            size: 3 * Float32Array.BYTES_PER_ELEMENT, // separation, alignment, cohesion
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Flocking Parameters Buffer'
        });

        // Initialize default flocking parameters
        const defaultFlockingParams = new Float32Array([15.0, 20.0, 20.0]); // separation, alignment, cohesion
        this.device.queue.writeBuffer(this.flockingParamsBuffer, 0, defaultFlockingParams);

        // Create the flocking compute bind group
        this.flockingBindGroup = this.device.createBindGroup({
            layout: flockingBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.deltaTimeBuffer || this.createDeltaTimeBuffer() } }, // deltaTime
                { binding: 1, resource: { buffer: this.positionBuffer } }, // positions
                { binding: 2, resource: { buffer: this.velocityBuffer } }, // velocities
                { binding: 3, resource: { buffer: this.flockingParamsBuffer } } // flocking parameters
            ]
        });
    }

    async initializePositionUpdatePipeline() {
        // Create a shader module for the position update compute shader
        const positionUpdateModule = this.device.createShaderModule({
            code: positionUpdateShader
        });

        // Create a bind group layout for the position update compute shader
        const positionUpdateBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // deltaTime
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // velocities
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } } // positions
            ]
        });

        // Create the position update compute pipeline
        this.positionComputePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [positionUpdateBindGroupLayout]
            }),
            compute: {
                module: positionUpdateModule,
                entryPoint: 'main'
            }
        });

        // Create a buffer for deltaTime (uniform) if not already created
        if (!this.deltaTimeBuffer) {
            this.deltaTimeBuffer = this.device.createBuffer({
                size: 4, // size of f32
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: 'Delta Time Buffer'
            });
        }

        // Create the position update compute bind group
        this.positionComputeBindGroup = this.device.createBindGroup({
            layout: positionUpdateBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.deltaTimeBuffer } },
                { binding: 1, resource: { buffer: this.velocityBuffer } },
                { binding: 2, resource: { buffer: this.positionBuffer } }
            ]
        });
    }

    async initializeRenderPipeline(format, projectionBuffer, viewBuffer) {
        // Create the render pipeline layout with existing bind group layout
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

    createDeltaTimeBuffer() {
        // Helper method to create deltaTime buffer if not existing
        if (!this.deltaTimeBuffer) {
            this.deltaTimeBuffer = this.device.createBuffer({
                size: 4, // size of f32
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: 'Delta Time Buffer'
            });
        }
        return this.deltaTimeBuffer;
    }

    render(commandEncoder, passDescriptor, objects) {
        // Dispatch the flocking compute pass to update velocities
        const flockingPassEncoder = commandEncoder.beginComputePass();
        flockingPassEncoder.setPipeline(this.flockingComputePipeline);
        flockingPassEncoder.setBindGroup(0, this.flockingBindGroup);
        const workgroupSize = 64;
        const flockingWorkgroups = Math.ceil(this.birdCount / workgroupSize);
        flockingPassEncoder.dispatchWorkgroups(flockingWorkgroups);
        flockingPassEncoder.end();

        // Dispatch the position update compute pass to update positions
        const positionComputePass = commandEncoder.beginComputePass();
        positionComputePass.setPipeline(this.positionComputePipeline);
        positionComputePass.setBindGroup(0, this.positionComputeBindGroup);
        const positionWorkgroups = Math.ceil(this.birdCount / workgroupSize);
        positionComputePass.dispatchWorkgroups(positionWorkgroups);
        positionComputePass.end();

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

    updateVelocities(velocities) {
        // Method to update velocities externally if needed
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velocities);
    }

    initializeBuffers(initialPositions, initialVelocities) {
        // Method to initialize position and velocity buffers
        const posArray = new Float32Array(initialPositions.flat());
        this.device.queue.writeBuffer(this.positionBuffer, 0, posArray);

        const velArray = new Float32Array(initialVelocities.flat());
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velArray);
    }

    setFlockingParameters(separation, alignment, cohesion) {
        // Update flocking parameters buffer
        const params = new Float32Array([separation, alignment, cohesion]);
        this.device.queue.writeBuffer(this.flockingParamsBuffer, 0, params);
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
        if (this.flockingComputePipeline) this.flockingComputePipeline.destroy();
        if (this.flockingBindGroup) this.flockingBindGroup.destroy();
        if (this.flockingParamsBuffer) this.flockingParamsBuffer.destroy();
        if (this.positionComputePipeline) this.positionComputePipeline.destroy();
        if (this.positionComputeBindGroup) this.positionComputeBindGroup.destroy();
        if (this.deltaTimeBuffer) this.deltaTimeBuffer.destroy();
        super.cleanup();
    }
}