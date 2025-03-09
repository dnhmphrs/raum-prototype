// Remove the Node.js imports
// import { readFileSync } from 'fs';
// import path from 'path';

class RiemannPipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.currentShaderType = 'default';
        this.shaderModules = {};
        this.renderPipelines = {};
    }
    
    async initialize() {
        console.log("Initializing Riemann Pipeline");
        
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
            await this.initializeShader('default', `${basePath}/RiemannShader.wgsl`);
            await this.initializeShader('sine', `${basePath}/SineShader.wgsl`);
            await this.initializeShader('ripple', `${basePath}/RippleShader.wgsl`);
            await this.initializeShader('complex', `${basePath}/ComplexShader.wgsl`);
            await this.initializeShader('torus', `${basePath}/TorusShader.wgsl`);
            
            this.isInitialized = true;
            console.log("Riemann Pipeline initialized successfully");
            return true;
        } catch (error) {
            console.error("Error initializing Riemann Pipeline:", error);
            return false;
        }
    }
    
    async initializeShader(shaderType, shaderPath) {
        console.log(`Initializing shader: ${shaderType} from ${shaderPath}`);
        
        try {
            // Fetch the shader code from the WGSL file using browser's fetch API
            const response = await fetch(shaderPath);
            if (!response.ok) {
                console.error(`Failed to load shader: ${shaderPath} (Status: ${response.status})`);
                throw new Error(`Failed to load shader: ${shaderPath}`);
            }
            const shaderCode = await response.text();
            
            // Create shader module
            this.shaderModules[shaderType] = this.device.createShaderModule({
                label: `Riemann ${shaderType} Shader`,
                code: shaderCode
            });
            
            // Create render pipeline
            this.renderPipelines[shaderType] = this.device.createRenderPipeline({
                layout: this.pipelineLayout,
                vertex: {
                    module: this.shaderModules[shaderType],
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
                    module: this.shaderModules[shaderType],
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
            
            console.log(`Shader ${shaderType} initialized successfully`);
        } catch (error) {
            console.error(`Error initializing shader ${shaderType}:`, error);
            throw error;
        }
    }
    
    setShaderType(shaderType) {
        if (this.renderPipelines[shaderType]) {
            this.currentShaderType = shaderType;
            console.log(`Switched to shader: ${shaderType}`);
            return true;
        } else {
            console.warn(`Shader ${shaderType} not found, using default`);
            this.currentShaderType = 'default';
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
        }
        
        // Use default if current shader not found
        if (!this.renderPipelines[this.currentShaderType]) {
            this.currentShaderType = 'default';
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
        console.log("Cleaning up Riemann Pipeline");
        this.isInitialized = false;
    }
}

export default RiemannPipeline; 