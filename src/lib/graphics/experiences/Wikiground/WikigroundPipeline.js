class WikigroundPipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.isActive = true;
        this.shaderModule = null;
        this.renderPipeline = null;
        this.bindGroup = null;
    }
    
    async initialize() {
        try {
            // Create bind group layout
            this.bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Projection matrix
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // View matrix
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Time and parameters uniform
                    }
                ]
            });
            
            // Create pipeline layout
            this.pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            });
            
            // Initialize shader
            await this.initializeShader('/shaders/wikiground/wikigroundShader.wgsl');
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Error initializing Wikiground pipeline:", error);
            return false;
        }
    }
    
    async initializeShader(shaderPath) {
        try {
            const response = await fetch(shaderPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch shader: ${response.statusText}`);
            }
            
            const shaderCode = await response.text();
            
            // Create shader module
            this.shaderModule = this.device.createShaderModule({
                code: shaderCode,
                label: 'Wikiground Sphere Shader'
            });
            
            // Create render pipeline
            this.renderPipeline = this.device.createRenderPipeline({
                layout: this.pipelineLayout,
                vertex: {
                    module: this.shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [{
                        arrayStride: 12, // 3 floats * 4 bytes
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    }]
                },
                fragment: {
                    module: this.shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'back' // Enable back-face culling for sphere
                },
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth24plus'
                }
            });
            
            return true;
        } catch (error) {
            console.error(`Error initializing Wikiground shader:`, error);
            return false;
        }
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount) {
        if (!this.isInitialized || !this.renderPipeline || !this.isActive) {
            return;
        }
        
        // Validate depth texture view
        if (!depthTextureView) {
            console.warn("Skipping render in Wikiground pipeline: depthTextureView is null");
            return;
        }
        
        try {
            // Get camera buffers
            const { projectionBuffer, viewBuffer } = this.resourceManager.camera.getBuffers();
            
            // Create bind group for this render pass
            const bindGroup = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: projectionBuffer }
                    },
                    {
                        binding: 1,
                        resource: { buffer: viewBuffer }
                    },
                    {
                        binding: 2,
                        resource: { buffer: uniformBuffer }
                    }
                ]
            });
            
            // Create render pass
            const renderPassDescriptor = {
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 }, // Dark blue background
                    loadOp: 'clear',
                    storeOp: 'store'
                }],
                depthStencilAttachment: {
                    view: depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            };
            
            // Begin render pass
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indexBuffer, 'uint32');
            passEncoder.drawIndexed(indexCount);
            passEncoder.end();
        } catch (error) {
            console.error("Error in Wikiground Pipeline render:", error);
        }
    }
    
    cleanup() {
        this.isInitialized = false;
        this.isActive = false;
        
        try {
            // Clean up shader module
            if (this.shaderModule && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.shaderModule, 'shaderModules');
                this.shaderModule = null;
            }
            
            // Clean up render pipeline
            if (this.renderPipeline && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.renderPipeline, 'pipelines');
                this.renderPipeline = null;
            }
            
            // Clean up bind group
            if (this.bindGroup && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.bindGroup, 'bindGroups');
                this.bindGroup = null;
            }
            
            // Other resources
            this.bindGroupLayout = null;
            this.pipelineLayout = null;
            
            // Clear references
            this.device = null;
            this.resourceManager = null;
        } catch (error) {
            console.error("Error during WikigroundPipeline cleanup:", error);
        }
    }
}

export default WikigroundPipeline;