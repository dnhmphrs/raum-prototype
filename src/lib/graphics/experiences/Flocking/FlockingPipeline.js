// FlockingPipeline.js

import Pipeline from '../../pipelines/Pipeline';
import birdShader from './birdShader.wgsl';
import predatorShader from './predatorShader.wgsl'; // Import the predator shader
import flockingShader from './flockingShader.wgsl';
import huntingShader from './huntingShader.wgsl';
import backgroundShader from './backgroundShader.wgsl';
import guidingLineShaderCode from './guidingLineShader.wgsl'; // Ensure correct path
import PredatorCamera from '../../camera/PredatorCamera'; // Import the new PredatorCamera class
import { vec3 } from 'gl-matrix';

export default class FlockingPipeline extends Pipeline {
    constructor(device, camera, viewportBuffer, mouseBuffer, birdCount, canvasWidth, canvasHeight) {
        super(device);
        this.camera = camera;
        this.predatorCamera = new PredatorCamera(device); // Initialize the predator camera
        this.viewportBuffer = viewportBuffer;
        this.mouseBuffer = mouseBuffer;
        this.birdCount = birdCount;

        // Store canvas dimensions with fallback values
        this.canvasWidth = Math.max(1, canvasWidth || 800);
        this.canvasHeight = Math.max(1, canvasHeight || 600);

        // Buffers for bird-specific data
        this.phaseBuffer = null; // For wing flapping animation
        this.positionBuffer = null; // For bird positions
        this.velocityBuffer = null; // For bird velocities

        // Predator Buffers
        this.predatorPositionBuffer = null;
        this.predatorVelocityBuffer = null;
        this.targetIndexBuffer = null;

        // Compute Pipeline related
        this.flockingComputePipeline = null;
        this.flockingComputeBindGroup = null;
        this.huntingComputePipeline = null;
        this.huntingComputeBindGroup = null;
        this.deltaTimeBuffer = null;

        // Render Pipelines
        this.birdPipeline = null;
        this.predatorPipeline = null;

        // Bind Groups
        this.birdBindGroup = null;
        this.predatorBindGroup = null;

        this.guidingLineBindGroup = null; // Bind group for guiding line
        this.backgroundBindGroup = null; // Bind group for background

        // Flocking Parameters
        this.flockingParamsBuffer = null;
        this.flockingParams = {
            separation: 250.0,
            alignment: 5.0,
            cohesion: 10.0, 
            centerGravity: new Float32Array([0.0, 0.0, 0.0, 0.0]) // Ensure vec4
        };

        this.currentTargetIndex = 0; // Add this line

        this.startTime = performance.now() / 1000;
        this.timeBuffer = null;

        // Add a performance mode flag to your pipeline
        this.lowPerformanceMode = false;

        // Create a separate buffer for the performance mode
        this.performanceModeBuffer = this.device.createBuffer({
            size: 4, // Single u32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Performance Mode Buffer'
        });
    }

    async initialize() {
        // Create all buffers first
        this.phaseBuffer = this.device.createBuffer({
            size: this.birdCount * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Phase Buffer'
        });

        this.positionBuffer = this.device.createBuffer({
            size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'Position Buffer'
        });

        this.velocityBuffer = this.device.createBuffer({
            size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each velocity has x, y, z
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Velocity Buffer'
        });

        // Create predator buffers
        this.predatorPositionBuffer = this.device.createBuffer({
            size: 3 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'Predator Position Buffer'
        });

        this.predatorVelocityBuffer = this.device.createBuffer({
            size: 3 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'Predator Velocity Buffer'
        });

        // Create a buffer to hold the targetIndex (u32)
        this.targetIndexBuffer = this.device.createBuffer({
            size: 4, // Size of a single u32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Target Index Buffer'
        });

        // Guiding Line Buffer (3 vec3<f32>)
        this.guidingLineBuffer = this.device.createBuffer({
            size: 2 * 4 * Float32Array.BYTES_PER_ELEMENT, // 2 vertices, each with x, y, z + padding
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'Guiding Line Buffer'
        });

        // Create time buffer for background shader
        this.timeBuffer = this.device.createBuffer({
            size: 4, // Single f32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Time Buffer'
        });

        // Initialize compute pipelines
        await this.initializeFlockingComputePipeline();
        await this.initializeHuntingComputePipeline();

        // Initialize render pipelines after all buffers are created
        const format = navigator.gpu.getPreferredCanvasFormat();
        const { projectionBuffer, viewBuffer } = this.camera.getBuffers();
        await this.initializeRenderPipelines(format, projectionBuffer, viewBuffer);

        // Initialize predator camera projection
        this.predatorCamera.updateProjection();
    }

    async initializeFlockingComputePipeline() {
        // Create a shader module for the compute shader
        const computeModule = this.device.createShaderModule({
            code: flockingShader
        });

        // Create a bind group layout for the compute shader
        const flockingComputeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // deltaTime
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // positions
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // velocities
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // phases
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // flocking parameters
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // predatorPosition
                { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // predatorVelocity
            ]
        });

        // Create the compute pipeline
        this.flockingComputePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [flockingComputeBindGroupLayout]
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
        this.flockingComputeBindGroup = this.device.createBindGroup({
            layout: flockingComputeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.deltaTimeBuffer } },
                { binding: 1, resource: { buffer: this.positionBuffer } },
                { binding: 2, resource: { buffer: this.velocityBuffer } },
                { binding: 3, resource: { buffer: this.phaseBuffer } },
                { binding: 4, resource: { buffer: this.flockingParamsBuffer } },
                { binding: 5, resource: { buffer: this.predatorPositionBuffer } },
                { binding: 6, resource: { buffer: this.predatorVelocityBuffer } },
            ]
        });
    }

    async initializeHuntingComputePipeline() {
        // Create shader module
        const huntingModule = this.device.createShaderModule({
            code: huntingShader
        });

        // Define bind group layout matching the shader bindings
        const huntingComputeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // positions
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // predatorPosition
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // predatorVelocity
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // targetIndex
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // guidingLineBuffer
            ]
        });

        // Create the compute pipeline
        this.huntingComputePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [huntingComputeBindGroupLayout]
            }),
            compute: {
                module: huntingModule,
                entryPoint: 'main'
            }
        });

        // Create the bind group
        this.huntingComputeBindGroup = this.device.createBindGroup({
            layout: huntingComputeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.positionBuffer } },
                { binding: 1, resource: { buffer: this.predatorPositionBuffer } },
                { binding: 2, resource: { buffer: this.predatorVelocityBuffer } },
                { binding: 3, resource: { buffer: this.targetIndexBuffer } },
                { binding: 4, resource: { buffer: this.guidingLineBuffer } },
            ]
        });
    }

    async initializeRenderPipelines(format, projectionBuffer, viewBuffer) {
        // Create background bind group layout first
        const backgroundBindGroupLayout = this.device.createBindGroupLayout({
            label: 'Background Bind Group Layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });

        // Create background pipeline
        this.backgroundPipeline = await this.device.createRenderPipelineAsync({
            label: 'Background Pipeline',
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [backgroundBindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({ code: backgroundShader }),
                entryPoint: 'vertex_main',
                buffers: [] // No vertex buffers needed
            },
            fragment: {
                module: this.device.createShaderModule({ code: backgroundShader }),
                entryPoint: 'fragment_main',
                targets: [{ format }]
            },
            primitive: {
                topology: 'triangle-list',
                stripIndexFormat: undefined,
                frontFace: 'ccw',
                cullMode: 'none'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false, // Background doesn't write to depth
                depthCompare: 'always'     // Always pass depth test to render first
            }
        });

        // Create background bind group
        this.backgroundBindGroup = this.device.createBindGroup({
            layout: backgroundBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.timeBuffer } },
                { binding: 1, resource: { buffer: this.predatorVelocityBuffer } },
                { binding: 2, resource: { buffer: this.performanceModeBuffer } }
            ]
        });

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

        // -----------------------
        // 1. Create the Bird Render Pipeline
        // -----------------------
        this.birdPipeline = this.device.createRenderPipeline({
            label: 'Bird Render Pipeline',
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [birdBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: birdShader }),
                entryPoint: 'vertex_main',
                buffers: [
                    {
                        arrayStride: 12, // 3 floats for position
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' }, // vertexPosition
                        ]
                    }
                ]
            },
            
            fragment: {
                module: this.device.createShaderModule({ code: birdShader }),
                entryPoint: 'fragment_main',
                targets: [{ 
                    format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // -----------------------
        // 2. Create the Predator Render Pipeline
        // -----------------------
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

        // -----------------------
        // 3. Create the Guiding Line Render Pipeline
        // -----------------------
        const guidingLineBindGroupLayout = this.device.createBindGroupLayout({
            label: 'Guiding Line Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
                { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Guiding Line Buffer
            ]
        });

        // Create the Guiding Line Render Pipeline
        this.guidingLinePipeline = this.device.createRenderPipeline({
            label: 'Guiding Line Render Pipeline',
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [guidingLineBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: guidingLineShaderCode }),
                entryPoint: 'vertex_main',
                buffers: [
                    {
                        arrayStride: 12, // Each vertex is 3 floats (x, y, z)
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' }
                        ]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: guidingLineShaderCode }),
                entryPoint: 'fragment_main',
                targets: [{ format }]
            },
            primitive: {
                topology: 'line-strip',
                stripIndexFormat: undefined,
                frontFace: 'cw',
                cullMode: 'none'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // Create Bind Group for Guiding Line
        this.guidingLineBindGroup = this.device.createBindGroup({
            layout: guidingLineBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: projectionBuffer } },
                { binding: 1, resource: { buffer: viewBuffer } },
                { binding: 2, resource: { buffer: this.guidingLineBuffer } },
            ]
        });
    }

    runComputePasses(commandEncoder) {
        // Update flocking and positions via compute shader
        const flockingPass = commandEncoder.beginComputePass();
        flockingPass.setPipeline(this.flockingComputePipeline);
        flockingPass.setBindGroup(0, this.flockingComputeBindGroup);
        const workgroupSize = 64;
        const workgroups = Math.ceil(this.birdCount / workgroupSize);
        flockingPass.dispatchWorkgroups(workgroups);
        flockingPass.end();

        // Update predator via. hunting shader
        const huntingPass = commandEncoder.beginComputePass();
        huntingPass.setPipeline(this.huntingComputePipeline);
        huntingPass.setBindGroup(0, this.huntingComputeBindGroup);
        huntingPass.dispatchWorkgroups(1); // Single workgroup as per shader
        huntingPass.end();
    }

    render(commandEncoder, passDescriptor, birds, predator, textureView, depthView, showPredatorView = false) {
        // Update time for background shader
        this.updateTimeBuffer();

        // Execute compute passes
        this.runComputePasses(commandEncoder);

        // Track positions in JavaScript
        let predatorPosition = vec3.create();
        let targetPosition = vec3.create();

        // Create staging buffers and a separate encoder for position reading
        {
            const positionEncoder = this.device.createCommandEncoder();
            const stagingGuidingLineBuffer = this.device.createBuffer({
                size: 32, // 2 vec4s (source and target)
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                label: 'Staging Guiding Line Buffer'
            });

            // Copy the entire guiding line buffer (contains both positions)
            positionEncoder.copyBufferToBuffer(
                this.guidingLineBuffer, 0,
                stagingGuidingLineBuffer, 0, 32
            );

            // Submit position copying commands
            this.device.queue.submit([positionEncoder.finish()]);

            // Read positions
            stagingGuidingLineBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const positions = new Float32Array(stagingGuidingLineBuffer.getMappedRange());
                
                // First vec4 is predator position, second vec4 is target position
                const predatorPosition = vec3.fromValues(positions[0], positions[1], positions[2]);
                const targetPosition = vec3.fromValues(positions[4], positions[5], positions[6]);

                // Update camera
                this.predatorCamera.updateFromPositionAndTarget(predatorPosition, targetPosition);

                // Cleanup staging buffer
                stagingGuidingLineBuffer.unmap();
                stagingGuidingLineBuffer.destroy();
            });
        }

        // Begin main render pass
        const passEncoder = commandEncoder.beginRenderPass(passDescriptor);

        // Render main scene
        passEncoder.setViewport(0, 0, this.canvasWidth, this.canvasHeight, 0.0, 1.0);
        
        // -----------------------
        // 1. Render Background
        // -----------------------
        passEncoder.setPipeline(this.backgroundPipeline);
        passEncoder.setBindGroup(0, this.backgroundBindGroup);
        passEncoder.draw(3, 1, 0, 0);

        // -----------------------
        // 2. Render Birds
        // -----------------------
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

        // -----------------------
        // 3. Render Predator
        // -----------------------
        passEncoder.setPipeline(this.predatorPipeline);
        passEncoder.setBindGroup(0, this.predatorBindGroup);

        if (predator) {
            passEncoder.setVertexBuffer(0, predator.getVertexBuffer());
            passEncoder.setIndexBuffer(predator.getIndexBuffer(), 'uint16');

            // Single instance for predator
            passEncoder.drawIndexed(predator.getIndexCount(), 1, 0, 0, 0);
        }

        // -----------------------
        // 4. Render Guiding Line
        // -----------------------
        passEncoder.setPipeline(this.guidingLinePipeline);
        passEncoder.setBindGroup(0, this.guidingLineBindGroup);
        passEncoder.draw(2, 1, 0, 0); // Draw two vertices

        passEncoder.end();
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
    
    initializeBirdBuffers(initialPositions, initialVelocities, initialPhases) {
        // Method to initialize position and velocity buffers
        const posArray = new Float32Array(initialPositions.flat());
        this.device.queue.writeBuffer(this.positionBuffer, 0, posArray);

        const velArray = new Float32Array(initialVelocities.flat());
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velArray);

        const phaseArray = new Float32Array(initialPhases.flat());
        this.device.queue.writeBuffer(this.phaseBuffer, 0, phaseArray);
    }

    initializePredatorBuffers(initialPredatorPosition, initialPredatorVelocity) {
        // Initialize predator position and velocity
        this.device.queue.writeBuffer(this.predatorPositionBuffer, 0, initialPredatorPosition);
        this.device.queue.writeBuffer(this.predatorVelocityBuffer, 0, initialPredatorVelocity);

        // Initialize targetIndex to 0
        this.device.queue.writeBuffer(
            this.targetIndexBuffer,
            0,
            new Uint32Array([0])
        );
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

    updateTargetIndex(newIndex) {
        // Update both the buffer and our local copy
        const buffer = new Uint32Array([newIndex]);
        this.device.queue.writeBuffer(this.targetIndexBuffer, 0, buffer);
        this.currentTargetIndex = newIndex;
    }

    cleanup() {
        if (this.phaseBuffer) this.phaseBuffer.destroy();
        if (this.positionBuffer) this.positionBuffer.destroy();
        if (this.velocityBuffer) this.velocityBuffer.destroy();
        if (this.predatorPositionBuffer) this.predatorPositionBuffer.destroy();
        if (this.predatorVelocityBuffer) this.predatorVelocityBuffer.destroy();
        if (this.flockingParamsBuffer) this.flockingParamsBuffer.destroy();

        // Cleanup predator camera
        this.predatorCamera.cleanup();

        super.cleanup();
    }

    updateViewportDimensions(width, height) {
        // Update stored dimensions
        this.canvasWidth = Math.max(1, width);
        this.canvasHeight = Math.max(1, height);
        
        // Update predator camera aspect ratio
        this.predatorCamera.aspect = 1; // Keep it square for the PIP view
        this.predatorCamera.updateProjection();
    }

    updateTimeBuffer() {
        const currentTime = performance.now() / 1000 - this.startTime;
        this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([currentTime]));
    }

    // Method to toggle performance mode
    updatePerformanceMode(lowPerformanceMode) {
        this.lowPerformanceMode = lowPerformanceMode;
        const data = new Uint32Array([lowPerformanceMode ? 1 : 0]);
        this.device.queue.writeBuffer(this.performanceModeBuffer, 0, data);
    }
}