// VideoBackgroundPipeline.js

import Pipeline from '../../pipelines/Pipeline';

export default class VideoBackgroundPipeline extends Pipeline {
    constructor(device, viewportBuffer, canvasWidth, canvasHeight) {
        super(device);
        this.viewportBuffer = viewportBuffer;
        
        // Store canvas dimensions with fallback values
        this.canvasWidth = Math.max(1, canvasWidth || 800);
        this.canvasHeight = Math.max(1, canvasHeight || 600);
        
        // Pipeline and bind group
        this.videoPipeline = null;
        this.videoBindGroup = null;
        
        // Sampler for video texture
        this.sampler = null;
        
        // Video texture reference (externally provided)
        this.videoTexture = null;
        
        // Time buffer for animations/effects
        this.timeBuffer = this.device.createBuffer({
            size: 4, // Single f32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Video Background Time Buffer'
        });
    }
    
    async initialize() {
        try {
            console.log("Initializing VideoBackgroundPipeline");
            
            // Create the time buffer for shader effects
            this.timeBuffer = this.device.createBuffer({
                size: 16, // Single f32 (with padding to 16 bytes for alignment)
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: "Video Time Buffer"
            });
            
            // Create a sampler for the video texture
            this.sampler = this.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
                label: "Video Texture Sampler"
            });
            
            // First fetch and load the shader
            try {
                const response = await fetch('/shaders/flocking/videoBackgroundShader.wgsl');
                if (!response.ok) {
                    throw new Error(`Failed to load video background shader: ${response.statusText}`);
                }
                const shaderCode = await response.text();
                
                // Log the first few characters to verify it's the right content
                console.log(`Loaded video background shader (${shaderCode.length} bytes)`);
                
                // Create the shader module
                const shaderModule = this.device.createShaderModule({
                    code: shaderCode,
                    label: "Video Background Shader Module"
                });
                
                // Create the bind group layout
                const videoBindGroupLayout = this.device.createBindGroupLayout({
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.FRAGMENT,
                            buffer: { type: 'uniform' }
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: 'float',
                                viewDimension: '2d',
                                multisampled: false
                            }
                        },
                        {
                            binding: 2,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: { type: 'filtering' }
                        },
                        {
                            binding: 3,
                            visibility: GPUShaderStage.FRAGMENT,
                            buffer: { type: 'uniform' }
                        }
                    ],
                    label: "Video Background Bind Group Layout"
                });
                
                // Create the pipeline
                const pipelineLayout = this.device.createPipelineLayout({
                    bindGroupLayouts: [videoBindGroupLayout],
                    label: "Video Background Pipeline Layout"
                });
                
                // Get the preferred canvas format
                const format = navigator.gpu.getPreferredCanvasFormat();
                
                // Create the pipeline
                this.videoPipeline = await this.device.createRenderPipelineAsync({
                    layout: pipelineLayout,
                    vertex: {
                        module: shaderModule,
                        entryPoint: 'vertex_main'
                    },
                    fragment: {
                        module: shaderModule,
                        entryPoint: 'fragment_main',
                        targets: [
                            {
                                format: format,
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
                            }
                        ]
                    },
                    primitive: {
                        topology: 'triangle-list'
                    },
                    depthStencil: {
                        format: 'depth24plus',
                        depthWriteEnabled: false,
                        depthCompare: 'less-equal'
                    },
                    label: "Video Background Render Pipeline"
                });
                
                // Update state
                this.isInitialized = true;
                console.log("VideoBackgroundPipeline initialized successfully");
                
                return true;
            } catch (error) {
                console.error("Error initializing VideoBackgroundPipeline:", error);
                this.isInitialized = false;
                return false;
            }
        } catch (error) {
            console.error("Error initializing VideoBackgroundPipeline:", error);
            this.isInitialized = false;
            return false;
        }
    }
    
    updateVideoTexture(videoTexture) {
        // Update the video texture reference
        this.videoTexture = videoTexture;
        
        // Recreate the bind group with the new texture
        if (this.isInitialized && this.videoTexture) {
            try {
                this.createBindGroup();
                console.log("Video texture updated successfully with dimensions:", 
                    this.videoTexture.width, "x", this.videoTexture.height);
            } catch (error) {
                console.error("Error updating video texture in pipeline:", error);
                this.videoTexture = null;
            }
        } else {
            console.warn("Cannot update video texture: pipeline not initialized or texture is null");
        }
    }
    
    createBindGroup() {
        try {
            // Check if videoTexture exists first
            if (!this.videoTexture) {
                console.warn("Cannot create bind group: videoTexture is null");
                return;
            }
            
            // Check if the texture is valid and has valid dimensions
            if (!this.videoTexture.width || !this.videoTexture.height) {
                console.warn("Invalid video texture dimensions:", 
                    this.videoTexture.width, "x", this.videoTexture.height);
                return;
            }
            
            // Make sure pipeline is initialized
            if (!this.videoPipeline) {
                console.warn("Cannot create bind group: pipeline not initialized");
                return;
            }
            
            // Create and get a texture view first with explicit format
            const textureView = this.videoTexture.createView({
                format: 'rgba8unorm',
                dimension: '2d',
                aspect: 'all',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer: 0,
                arrayLayerCount: 1
            });
            
            // Create the bind group with the texture view
            this.videoBindGroup = this.device.createBindGroup({
                layout: this.videoPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.timeBuffer } },
                    { binding: 1, resource: textureView },
                    { binding: 2, resource: this.sampler },
                    { binding: 3, resource: { buffer: this.viewportBuffer } }
                ]
            });
            
            console.log("Video background bind group created successfully");
        } catch (error) {
            console.error("Error creating video bind group:", error);
            console.error("Video texture info:", 
                this.videoTexture ? 
                `${this.videoTexture.width}x${this.videoTexture.height}` : 
                "texture is null");
            this.videoBindGroup = null;
        }
    }
    
    updateTimeBuffer() {
        try {
            // Get current time in seconds
            const currentTime = performance.now() / 1000;
            
            // Create uniform struct with time value (needs to be properly aligned)
            const timeData = new Float32Array([
                currentTime,  // time
                0.0, 0.0, 0.0 // padding to 16 bytes
            ]);
            
            // Write buffer data
            this.device.queue.writeBuffer(this.timeBuffer, 0, timeData);
        } catch (error) {
            console.error("Error updating time buffer:", error);
        }
    }
    
    render(commandEncoder, textureView) {
        // Skip if not initialized or missing resources
        if (!this.isInitialized) {
            if (this.frameCount % 60 === 0) {
                console.warn("VideoBackgroundPipeline skipping render: not initialized");
            }
            return;
        }
        
        if (!this.videoBindGroup) {
            if (this.frameCount % 60 === 0) {
                console.warn("VideoBackgroundPipeline skipping render: missing bind group");
                
                // Attempt to recreate the bind group if we have a texture but no bind group
                if (this.videoTexture && this.videoPipeline) {
                    console.log("Attempting to recreate bind group...");
                    this.createBindGroup();
                }
            }
            return;
        }
        
        // Log render calls periodically (every 60 frames)
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        
        if (this.frameCount % 60 === 0) {
            console.log("VideoBackgroundPipeline rendering frame:", this.frameCount);
        }
        
        // Update time uniform for shader effects
        this.updateTimeBuffer();
        
        try {
            // Create a depth texture for the render pass
            const depthTexture = this.device.createTexture({
                size: [this.canvasWidth, this.canvasHeight],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
            
            const depthView = depthTexture.createView();
            
            // Create render pass - load existing content instead of clearing
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        loadOp: 'load',  // Preserve the background
                        storeOp: 'store'
                    }
                ],
                depthStencilAttachment: {
                    view: depthView,
                    depthLoadOp: 'clear',
                    depthClearValue: 1.0,
                    depthStoreOp: 'store'
                }
            });
            
            // Set pipeline and bind group
            passEncoder.setPipeline(this.videoPipeline);
            passEncoder.setBindGroup(0, this.videoBindGroup);
            
            // Draw fullscreen quad (using 3 vertices to cover screen with a triangle)
            passEncoder.draw(3, 1, 0, 0);
            passEncoder.end();
        } catch (error) {
            console.error("Error in VideoBackgroundPipeline render:", error);
        }
    }
    
    updateViewportDimensions(width, height) {
        // Update stored dimensions
        this.canvasWidth = Math.max(1, width);
        this.canvasHeight = Math.max(1, height);
    }
    
    cleanup() {
        // Clean up resources
        this.videoTexture = null;
        this.videoPipeline = null;
        this.videoBindGroup = null;
        
        if (this.sampler) {
            this.sampler = null;
        }
        
        this.isInitialized = false;
        super.cleanup();
    }
} 