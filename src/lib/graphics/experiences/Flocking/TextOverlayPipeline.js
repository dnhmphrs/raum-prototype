import Pipeline from '../../pipelines/Pipeline';

export default class TextOverlayPipeline extends Pipeline {
    constructor(device, viewportBuffer, predatorVelocityBuffer, canvasWidth, canvasHeight) {
        super(device);
        this.viewportBuffer = viewportBuffer;
        this.predatorVelocityBuffer = predatorVelocityBuffer;
        this.canvasWidth = Math.max(1, canvasWidth || 800);
        this.canvasHeight = Math.max(1, canvasHeight || 600);
        
        // Pipeline and bind group
        this.textOverlayPipeline = null;
        this.textOverlayBindGroup = null;
        
        // Time uniform buffer for animation
        this.timeBuffer = null;
        
        // Create a fallback buffer if needed
        this.fallbackVelocityBuffer = null;
        
        // Track initialization state
        this.isInitialized = false;
        
        // Shader code
        this.textOverlayShaderCode = null;
    }
    
    async initialize() {
        try {
            // Create fallback velocity buffer (will be used if real one is not available)
            this.fallbackVelocityBuffer = this.device.createBuffer({
                size: 12, // 3 floats (vec3<f32>)
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Fallback Predator Velocity Buffer'
            });
            
            // Initialize fallback buffer with zeros
            this.device.queue.writeBuffer(
                this.fallbackVelocityBuffer,
                0,
                new Float32Array([0, 0, 0])
            );
            
            // Load shader
            const response = await fetch('/shaders/flocking/textOverlayShader.wgsl');
            if (!response.ok) {
                throw new Error(`Failed to load text overlay shader: ${response.statusText}`);
            }
            this.textOverlayShaderCode = await response.text();
            
            // Create time buffer
            this.timeBuffer = this.device.createBuffer({
                size: 4, // Single f32
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: 'Text Overlay Time Buffer'
            });
            
            // Initialize the pipeline
            const format = navigator.gpu.getPreferredCanvasFormat();
            await this.initializePipeline(format);
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing TextOverlayPipeline:', error);
            return false;
        }
    }
    
    async initializePipeline(format) {
        // Create bind group layout
        const textOverlayBindGroupLayout = this.device.createBindGroupLayout({
            label: 'Text Overlay Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // time
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }, // predatorVelocity
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // viewport
            ]
        });
        
        // Create the pipeline - IMPORTANT: Remove the depthStencil configuration
        this.textOverlayPipeline = await this.device.createRenderPipelineAsync({
            label: 'Text Overlay Pipeline',
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [textOverlayBindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({ code: this.textOverlayShaderCode }),
                entryPoint: 'vertex_main',
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({ code: this.textOverlayShaderCode }),
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
            primitive: {
                topology: 'triangle-list',
                stripIndexFormat: undefined,
                frontFace: 'ccw',
                cullMode: 'none'
            }
            // No depthStencil configuration needed - this way the pipeline will be compatible with a render pass that has no depth attachment
        });
        
        // Use the real predator velocity buffer if available, otherwise use fallback
        const actualVelocityBuffer = this.predatorVelocityBuffer || this.fallbackVelocityBuffer;
        
        // Create the bind group
        this.textOverlayBindGroup = this.device.createBindGroup({
            layout: textOverlayBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.timeBuffer } },
                { binding: 1, resource: { buffer: actualVelocityBuffer } },
                { binding: 2, resource: { buffer: this.viewportBuffer } },
            ]
        });
    }
    
    render(commandEncoder, textureView) {
        if (!this.isInitialized) {
            return;
        }
        
        // Update time for animations
        this.updateTimeBuffer();
        
        // Start a render pass for the text overlay - without depth attachment
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: 'load',       // Don't clear - we're drawing on top
                    storeOp: 'store'
                }
            ]
            // No depth stencil attachment needed
        });
        
        // Set the pipeline and bind group
        passEncoder.setPipeline(this.textOverlayPipeline);
        passEncoder.setBindGroup(0, this.textOverlayBindGroup);
        
        // Draw a full-screen quad (6 vertices)
        passEncoder.draw(6, 1, 0, 0);
        
        // End the render pass
        passEncoder.end();
    }
    
    updateTimeBuffer() {
        // Get current time in seconds
        const currentTime = performance.now() / 1000;
        this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([currentTime]));
    }
    
    updateViewportDimensions(width, height) {
        this.canvasWidth = Math.max(1, width);
        this.canvasHeight = Math.max(1, height);
    }
    
    cleanup() {
        try {
            // Clean up resources
            this.textOverlayPipeline = null;
            this.textOverlayBindGroup = null;
            this.textOverlayShaderCode = null;
            
            if (this.timeBuffer) {
                this.timeBuffer = null;
            }
            
            if (this.fallbackVelocityBuffer) {
                this.fallbackVelocityBuffer = null;
            }
            
            this.isInitialized = false;
            
            // Call parent cleanup
            super.cleanup();
        } catch (error) {
            console.error('Error in TextOverlayPipeline cleanup:', error);
        }
    }
    
    // Method to update the predator velocity buffer reference and rebind
    updatePredatorVelocityBuffer(newBuffer) {
        if (!newBuffer || !this.isInitialized) {
            return;
        }
        
        this.predatorVelocityBuffer = newBuffer;
        
        // Recreate the bind group with the new buffer
        if (this.textOverlayPipeline) {
            const bindGroupLayout = this.textOverlayPipeline.getBindGroupLayout(0);
            
            this.textOverlayBindGroup = this.device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.timeBuffer } },
                    { binding: 1, resource: { buffer: this.predatorVelocityBuffer } },
                    { binding: 2, resource: { buffer: this.viewportBuffer } },
                ]
            });
        }
    }
} 