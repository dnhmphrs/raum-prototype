import { RiemannShader } from './RiemannShader.js';

class RiemannPipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
    }
    
    async initialize() {
        console.log("Initializing Riemann Pipeline");
        
        try {
            // Create shader module
            this.shaderModule = this.device.createShaderModule({
                label: "Riemann Shader",
                code: RiemannShader
            });
            
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
            
            // Create render pipeline
            this.renderPipeline = this.device.createRenderPipeline({
                layout: this.pipelineLayout,
                vertex: {
                    module: this.shaderModule,
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
                    module: this.shaderModule,
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
            
            this.isInitialized = true;
            console.log("Riemann Pipeline initialized successfully");
            return true;
        } catch (error) {
            console.error("Error initializing Riemann Pipeline:", error);
            return false;
        }
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount) {
        if (!this.isInitialized || !textureView) {
            return;
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
            passEncoder.setPipeline(this.renderPipeline);
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