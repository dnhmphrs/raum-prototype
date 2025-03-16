// Remove the Node.js imports
// import { readFileSync } from 'fs';
// import path from 'path';

class GridCodePipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.shaderModule = null;
        this.renderPipeline = null;
        
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
        
        // Initialize KP shader - use the original shader from Riemann
        await this.initializeShader('/shaders/riemann/KPShader.wgsl');
        
        this.isInitialized = true;
        return true;
    }
    
    async initializeShader(shaderPath) {
        // Fetch the shader code from the WGSL file using browser's fetch API
        const response = await fetch(shaderPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch shader: ${response.statusText}`);
        }
        
        const shaderCode = await response.text();
        
        // Create shader module
        this.shaderModule = this.device.createShaderModule({
            code: shaderCode,
            label: 'Grid Code KP Tau-Function Shader'
        });
        
        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: this.pipelineLayout,
            vertex: {
                module: this.shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        // Position (x, y, z)
                        arrayStride: 12, // 3 floats * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3'
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module: this.shaderModule,
                entryPoint: 'fragmentMain',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });
        
        return true;
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount) {
        if (!this.isInitialized || !this.renderPipeline) {
            return;
        }
        
        try {
            // Create render pass
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 }, // Match Riemann's background color
                        loadOp: 'clear',
                        storeOp: 'store'
                    }
                ],
                depthStencilAttachment: {
                    view: depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            });
            
            // Get camera buffers
            if (!this.resourceManager || !this.resourceManager.camera) {
                return;
            }
            
            const { projectionBuffer, viewBuffer } = this.resourceManager.camera.getBuffers();
            if (!projectionBuffer || !viewBuffer) {
                return;
            }
            
            // Create bind group
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
            
            // Set pipeline and bind group
            renderPass.setPipeline(this.renderPipeline);
            renderPass.setBindGroup(0, bindGroup);
            
            // Set vertex and index buffers
            renderPass.setVertexBuffer(0, vertexBuffer);
            renderPass.setIndexBuffer(indexBuffer, 'uint32');
            
            // Draw
            renderPass.drawIndexed(indexCount);
            
            // End render pass
            renderPass.end();
        } catch (error) {
            console.error("Error in Grid Code Pipeline render:", error);
        }
    }
    
    cleanup() {
        // Clean up resources - explicitly nullify WebGPU resources
        if (this.shaderModule) {
            this.shaderModule = null;
        }
        
        if (this.renderPipeline) {
            this.renderPipeline = null;
        }
        
        if (this.bindGroupLayout) {
            this.bindGroupLayout = null;
        }
        
        if (this.pipelineLayout) {
            this.pipelineLayout = null;
        }
        
        if (this.kpParamsBuffer) {
            this.kpParamsBuffer = null;
        }
        
        // Clear device and resource manager references
        this.device = null;
        this.resourceManager = null;
        
        // Mark as not initialized
        this.isInitialized = false;
    }
}

export default GridCodePipeline; 