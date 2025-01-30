// FlockingPipeline.js

import Pipeline from '../../pipelines/Pipeline';
import birdShader from './birdShader.wgsl';
import predatorShader from './predatorShader.wgsl'; // Import the predator shader
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

        // Predator Buffers
        this.predatorPositionBuffer = null;
        this.predatorVelocityBuffer = null;

        // Compute Pipeline related
        this.computePipeline = null;
        this.computeBindGroup = null;
        this.deltaTimeBuffer = null;

        // Render Pipelines
        this.birdPipeline = null;
        this.predatorPipeline = null;

        // Bind Groups
        this.birdBindGroup = null;
        this.predatorBindGroup = null;

        // Flocking Parameters
        this.flockingParamsBuffer = null;
        this.flockingParams = {
            separation: 1000.0,
            alignment: 5.0,
            cohesion: 10.0, 
            centerGravity: new Float32Array([0.0, 0.0, 0.0, 0.0]) // Ensure vec4
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

        // Create predator buffers
        this.predatorPositionBuffer = this.device.createBuffer({
            size: 3 * Float32Array.BYTES_PER_ELEMENT, // x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Predator Position Buffer'
        });

        this.predatorVelocityBuffer = this.device.createBuffer({
            size: 3 * Float32Array.BYTES_PER_ELEMENT, // x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Predator Velocity Buffer'
        });

        // Initialize Compute Shader
        await this.initializeComputePipeline();

        // Initialize Render Shader Pipelines
        await this.initializeRenderPipelines(format, projectionBuffer, viewBuffer);
    }

    async initializeComputePipeline() {
        // Create a shader module for the compute shader
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

    async initializeRenderPipelines(format, projectionBuffer, viewBuffer) {
        // Create Bind Group Layout for Birds
        const birdBindGroupLayout = this.device.createBindGroupLayout({
            label: 'Birds Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
                { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Position Buffer
                { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Phase Buffer
                { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Mouse Buffer
                { binding: 6, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Velocity Buffer
            ]
        });

        // Create Bind Group Layout for Predator
        const predatorBindGroupLayout = this.device.createBindGroupLayout({
            label: 'Predator Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
                { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Predator Position Buffer
                { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Predator Velocity Buffer
            ]
        });

        // Create the Bird Render Pipeline
        this.birdPipeline = this.device.createRenderPipeline({
            label: 'Bird Render Pipeline',
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [birdBindGroupLayout] }),
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

        // Create the Predator Render Pipeline
        this.predatorPipeline = this.device.createRenderPipeline({
            label: 'Predator Render Pipeline',
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [predatorBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: predatorShader }),
                entryPoint: 'vertex_main',
                buffers: [
                    {
                        arrayStride: 12, // Each vertex is 3 floats (x, y, z)
                        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: predatorShader }),
                entryPoint: 'fragment_main',
                targets: [{ format }]
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // Create Bind Group for Birds
        this.birdBindGroup = this.device.createBindGroup({
            layout: birdBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: projectionBuffer } },
                { binding: 1, resource: { buffer: viewBuffer } },
                { binding: 2, resource: { buffer: this.viewportBuffer } },
                { binding: 3, resource: { buffer: this.positionBuffer } },
                { binding: 4, resource: { buffer: this.phaseBuffer } },
                { binding: 5, resource: { buffer: this.mouseBuffer } },
                { binding: 6, resource: { buffer: this.velocityBuffer } },
            ]
        });

        // Create Bind Group for Predator
        this.predatorBindGroup = this.device.createBindGroup({
            layout: predatorBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: projectionBuffer } },
                { binding: 1, resource: { buffer: viewBuffer } },
                { binding: 2, resource: { buffer: this.viewportBuffer } },
                { binding: 3, resource: { buffer: this.predatorPositionBuffer } },
                { binding: 4, resource: { buffer: this.predatorVelocityBuffer } },
            ]
        });
    }

    render(commandEncoder, passDescriptor, birds, predator) {
        // Update flocking and positions via compute shader
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        const workgroupSize = 64;
        const workgroups = Math.ceil(this.birdCount / workgroupSize);
        computePass.dispatchWorkgroups(workgroups);
        computePass.end();

        // Begin main render pass
        const passEncoder = commandEncoder.beginRenderPass(passDescriptor);

        // Render Birds
        passEncoder.setPipeline(this.birdPipeline);
        passEncoder.setBindGroup(0, this.birdBindGroup);

        // Assuming all birds share the same geometry
        if (birds.length > 0) {
            const firstBird = birds[0];
            passEncoder.setVertexBuffer(0, firstBird.getVertexBuffer());
            passEncoder.setIndexBuffer(firstBird.getIndexBuffer(), 'uint16');

            // Use instancing to draw all birds in a single call
            passEncoder.drawIndexed(firstBird.getIndexCount(), this.birdCount, 0, 0, 0);
        }

        // Render Predator
        passEncoder.setPipeline(this.predatorPipeline);
        passEncoder.setBindGroup(0, this.predatorBindGroup);

        if (predator) {
            passEncoder.setVertexBuffer(0, predator.getVertexBuffer());
            passEncoder.setIndexBuffer(predator.getIndexBuffer(), 'uint16');

            // Single instance for predator
            passEncoder.drawIndexed(predator.getIndexCount(), 1, 0, 0, 0);
        }

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
            this.flockingParams.centerGravity[3],
            0.0 // Padding
        ]);
        this.device.queue.writeBuffer(this.flockingParamsBuffer, 0, params);
    }
    
    initializeBirdBuffers(initialPositions, initialVelocities) {
        // Method to initialize position and velocity buffers
        const posArray = new Float32Array(initialPositions.flat());
        this.device.queue.writeBuffer(this.positionBuffer, 0, posArray);

        const velArray = new Float32Array(initialVelocities.flat());
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velArray);
    }

    initializePredatorBuffers(initialPredatorPosition, initialPredatorVelocity) {
        // Initialize predator position and velocity
        this.device.queue.writeBuffer(this.predatorPositionBuffer, 0, initialPredatorPosition);
        this.device.queue.writeBuffer(this.predatorVelocityBuffer, 0, initialPredatorVelocity);
    }

    setFlockingParameters(separation, alignment, cohesion, centerGravity = [0.0, 0.0, 0.0, 0.0]) {
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
        if (this.predatorPositionBuffer) this.predatorPositionBuffer.destroy();
        if (this.predatorVelocityBuffer) this.predatorVelocityBuffer.destroy();
        if (this.flockingParamsBuffer) this.flockingParamsBuffer.destroy();

        super.cleanup();
    }
}