// Remove the Node.js imports
// import { readFileSync } from 'fs';
// import path from 'path';

class RiemannPipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.currentShaderType = 'flat';
        this.shaderModules = new Map();
        this.renderPipelines = {};
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
                        buffer: { type: 'uniform' } // Time uniform
                    }
                ]
            });
            
            // Create pipeline layout
            this.pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            });
            
            // Base path for shaders - this will work in both development and production
            const basePath = '/shaders/riemann';
            
            // Initialize all shaders with paths relative to the base URL
            await this.initializeShader('flat', `${basePath}/FlatShader.wgsl`);
            await this.initializeShader('sine', `${basePath}/SineShader.wgsl`);
            await this.initializeShader('ripple', `${basePath}/RippleShader.wgsl`);
            await this.initializeShader('weird', `${basePath}/WeirdShader.wgsl`);
            await this.initializeShader('torus', `${basePath}/TorusShader.wgsl`);
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async initializeShader(shaderType, shaderPath) {
        try {
            const response = await fetch(shaderPath);
            if (!response.ok) {
                console.error(`Failed to load shader: ${shaderPath} (Status: ${response.status})`);
                return false;
            }
            
            const shaderCode = await response.text();
            
            // Create shader module
            const shaderModule = this.device.createShaderModule({
                label: `Riemann ${shaderType} Shader`,
                code: shaderCode
            });
            
            // Store shader module
            this.shaderModules.set(shaderType, shaderModule);
            
            // Create render pipeline
            this.renderPipelines[shaderType] = this.device.createRenderPipeline({
                layout: this.pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [{
                        arrayStride: 12, // 3 floats, 4 bytes each
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    }]
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none' // Show both sides of the surface
                },
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less'
                }
            });
            
            return true;
        } catch (error) {
            console.error(`Error initializing shader ${shaderType}:`, error);
            return false;
        }
    }
    
    setShaderType(shaderType) {
        try {
            if (!this.shaderModules.has(shaderType)) {
                console.warn(`Shader ${shaderType} not found, using flat`);
                shaderType = 'flat';
            }
            
            // Update current shader type
            this.currentShaderType = shaderType;
            
            // Update pipeline with new shader
            this.updatePipeline();
            
            return true;
        } catch (error) {
            console.error(`Error setting shader type ${shaderType}:`, error);
            return false;
        }
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount, shaderType = null) {
        if (!this.isInitialized || !textureView) {
            return;
        }
        
        // Set shader type if provided
        if (shaderType && this.renderPipelines[shaderType]) {
            this.currentShaderType = shaderType;
        } else if (shaderType && !this.renderPipelines[shaderType]) {
            // If requested shader doesn't exist, log a warning and use flat
            console.warn(`Requested shader '${shaderType}' not found, falling back to flat`);
            this.currentShaderType = 'flat';
        }
        
        // Use flat if current shader not found
        if (!this.renderPipelines[this.currentShaderType]) {
            this.currentShaderType = 'flat';
        }
        
        // Validate depth texture view
        if (!depthTextureView) {
            console.warn("Skipping render in pipeline: depthTextureView is null");
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
            
            // Create render pass with explicit depth testing
            const renderPassDescriptor = {
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 },
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
            passEncoder.setPipeline(this.renderPipelines[this.currentShaderType]);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indexBuffer, 'uint32');
            passEncoder.drawIndexed(indexCount);
            passEncoder.end();
        } catch (error) {
            console.error("Error in Riemann Pipeline render:", error);
        }
    }
    
    cleanup() {
        this.isInitialized = false;
        
        // Clean up shader modules
        if (this.shaderModules) {
            for (const [_, module] of this.shaderModules) {
                if (module && typeof module.destroy === 'function') {
                    try {
                        module.destroy();
                    } catch (error) {
                        console.warn(`Error destroying shader module:`, error);
                    }
                }
            }
            this.shaderModules.clear();
        }
        
        // Unregister render pipelines
        if (this.renderPipelines) {
            for (const key in this.renderPipelines) {
                if (this.renderPipelines[key]) {
                    if (this.resourceManager) {
                        this.resourceManager.unregisterResource?.(this.renderPipelines[key], 'pipelines');
                    }
                }
            }
            this.renderPipelines = {};
        }
        
        // Clean up bind group layout and bind group
        if (this.bindGroup) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.bindGroup, 'bindGroups');
            }
            this.bindGroup = null;
        }
        
        if (this.bindGroupLayout) {
            this.bindGroupLayout = null;
        }
        
        // Clean up pipeline layout
        this.pipelineLayout = null;
        
        // Check if this is a subclass of Pipeline before calling super.cleanup()
        if (Object.getPrototypeOf(this).constructor.name === 'Pipeline' && 
            typeof super.cleanup === 'function') {
            super.cleanup();
        }
        
        // Clear references
        this.device = null;
        this.resourceManager = null;
    }
}

export default RiemannPipeline; 