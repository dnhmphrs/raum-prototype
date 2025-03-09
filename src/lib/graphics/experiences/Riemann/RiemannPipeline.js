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
        
        // Create KP shader parameters buffer with default values
        this.kpParamsBuffer = this.device.createBuffer({
            size: 16, // 4 floats (scaleIndex, distortion, padding1, padding2)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'KP Shader Parameters Buffer'
        });
        
        // Initialize with default values
        this.updateKPParams(2, 0); // Default: scale index 2, no distortion
    }
    
    // Method to update KP shader parameters
    updateKPParams(scaleIndex, distortion) {
        if (!this.device || !this.kpParamsBuffer) return;
        
        // Clamp values to valid ranges
        scaleIndex = Math.max(0, Math.min(5, scaleIndex));
        distortion = Math.max(0, Math.min(1, distortion));
        
        // Update the buffer
        this.device.queue.writeBuffer(
            this.kpParamsBuffer,
            0,
            new Float32Array([scaleIndex, distortion, 0, 0]) // Include padding
        );
    }
    
    async initialize() {
        console.log("Initializing Riemann Pipeline");
        
        try {
            // Create bind group layout with additional binding for KP parameters
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
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // KP shader parameters
                    }
                ]
            });
            
            // Create pipeline layout
            this.pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            });
            
            // Initialize all shaders - using paths relative to this module
            await this.initializeShader('default', './shaders/RiemannShader.wgsl');
            await this.initializeShader('kp', './shaders/KPShader.wgsl');
            await this.initializeShader('sine', './shaders/SineShader.wgsl');
            await this.initializeShader('ripple', './shaders/RippleShader.wgsl');
            await this.initializeShader('complex', './shaders/ComplexShader.wgsl');
            await this.initializeShader('torus', './shaders/TorusShader.wgsl');
            
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
            // Resolve the shader path relative to the current module
            // For production builds, we need to ensure the path is relative to the deployed assets
            const resolvedPath = new URL(shaderPath, import.meta.url).href;
            console.log(`Resolved shader path: ${resolvedPath}`);
            
            // Fetch the shader code from the WGSL file using browser's fetch API
            const response = await fetch(resolvedPath);
            if (!response.ok) {
                console.error(`Failed to load shader: ${resolvedPath} (Status: ${response.status})`);
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
                    },
                    {
                        binding: 3,
                        resource: { buffer: this.kpParamsBuffer }
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