import Pipeline from '../../pipelines/Pipeline';

export default class ShaderRectPipeline extends Pipeline {
    constructor(device, camera, viewportBuffer, initialRectCount = 5, canvasWidth = 800, canvasHeight = 600) {
        super(device);
        this.camera = camera;
        this.viewportBuffer = viewportBuffer;
        this.rectCount = initialRectCount;
        
        // Store canvas dimensions
        this.canvasWidth = Math.max(1, canvasWidth);
        this.canvasHeight = Math.max(1, canvasHeight);
        
        // Buffers for shader rectangles
        this.rectBuffer = null; // Stores position, size, and shader type
        this.timeBuffer = null; // Global time for animations
        this.rectDataBuffer = null; // Additional per-rectangle data

        // Pipeline related
        this.renderPipeline = null;
        this.bindGroup = null;
        
        // Shader code
        this.rectShaderCode = null;
        
        // Keep track of start time for animations
        this.startTime = performance.now() / 1000;
        
        // Number of different shader types available
        this.shaderTypeCount = 3; // Increase this as more shader types are added
    }

    async initialize() {
        // Create buffers first
        this.createBuffers();
        
        // Load shader code
        try {
            // Attempt to load shader from file (using the correct path)
            const response = await fetch('/shaders/flocking/shaderRect.wgsl');
            if (!response.ok) {
                // If loading fails, use inline fallback shader
                this.rectShaderCode = this.getFallbackShaderCode();
                console.warn('Using fallback shader for rectangles');
            } else {
                this.rectShaderCode = await response.text();
            }
            
            // Now initialize the render pipeline
            await this.initializeRenderPipeline();
            
            return true;
        } catch (error) {
            console.error("Error initializing ShaderRectPipeline:", error);
            // Use fallback shader if loading fails
            this.rectShaderCode = this.getFallbackShaderCode();
            await this.initializeRenderPipeline();
            return true;
        }
    }
    
    createBuffers() {
        // Buffer for rectangle data (position, size, shader type)
        // Format per rectangle: x, y, width, height, shaderType, padding[3]
        // Each rectangle takes 8 floats (32 bytes)
        this.rectBuffer = this.device.createBuffer({
            size: this.rectCount * 8 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Rectangle Buffer'
        });
        
        // Time buffer for animations
        this.timeBuffer = this.device.createBuffer({
            size: 4, // Single float
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Time Buffer'
        });
        
        // Additional per-rectangle data for complex shaders
        // Each rectangle has 4 floats of custom data
        this.rectDataBuffer = this.device.createBuffer({
            size: this.rectCount * 4 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'Rectangle Data Buffer'
        });
        
        // Initialize buffers with default values
        this.initializeDefaultRectangles();
    }
    
    initializeDefaultRectangles() {
        // Create default data for rectangles
        const rectData = new Float32Array(this.rectCount * 8);
        const customData = new Float32Array(this.rectCount * 4);
        
        for (let i = 0; i < this.rectCount; i++) {
            const baseIndex = i * 8;
            const dataIndex = i * 4;
            
            // Default positions (will be randomized later)
            rectData[baseIndex] = 0.1 + (i * 0.15); // x
            rectData[baseIndex + 1] = 0.1 + (i * 0.1); // y
            rectData[baseIndex + 2] = 0.2; // width
            rectData[baseIndex + 3] = 0.15; // height
            rectData[baseIndex + 4] = Math.floor(Math.random() * this.shaderTypeCount); // random shader type
            // 3 padding values remain at 0
            
            // Custom data (for shader variations)
            customData[dataIndex] = Math.random(); // random parameter 1
            customData[dataIndex + 1] = Math.random(); // random parameter 2
            customData[dataIndex + 2] = Math.random(); // random parameter 3
            customData[dataIndex + 3] = Math.random(); // random parameter 4
        }
        
        // Write to device buffers
        this.device.queue.writeBuffer(this.rectBuffer, 0, rectData);
        this.device.queue.writeBuffer(this.rectDataBuffer, 0, customData);
        
        // Initialize time
        this.updateTimeBuffer();
    }
    
    async initializeRenderPipeline() {
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }, // Rectangle data
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Time
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }, // Custom data
            ]
        });
        
        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });
        
        // Create shader module
        const shaderModule = this.device.createShaderModule({
            code: this.rectShaderCode
        });
        
        // Create render pipeline
        this.renderPipeline = await this.device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertex_main',
                buffers: [] // No vertex buffers needed - we use vertexIndex
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragment_main',
                targets: [
                    {
                        format,
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha'
                            }
                        }
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            // No depth testing - we want rectangles to always appear on top
        });
        
        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.rectBuffer } },
                { binding: 1, resource: { buffer: this.timeBuffer } },
                { binding: 2, resource: { buffer: this.viewportBuffer } },
                { binding: 3, resource: { buffer: this.rectDataBuffer } },
            ]
        });
    }
    
    updateTimeBuffer() {
        const currentTime = performance.now() / 1000 - this.startTime;
        const timeArray = new Float32Array([currentTime]);
        this.device.queue.writeBuffer(this.timeBuffer, 0, timeArray);
    }
    
    updateRectCount(newCount) {
        if (newCount === this.rectCount) return;
        
        this.rectCount = newCount;
        
        // Re-create buffers with new size
        if (this.rectBuffer) {
            if (typeof this.rectBuffer.destroy === 'function') {
                this.rectBuffer.destroy();
            }
            this.rectBuffer = this.device.createBuffer({
                size: this.rectCount * 8 * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Buffer'
            });
        }
        
        if (this.rectDataBuffer) {
            if (typeof this.rectDataBuffer.destroy === 'function') {
                this.rectDataBuffer.destroy();
            }
            this.rectDataBuffer = this.device.createBuffer({
                size: this.rectCount * 4 * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Data Buffer'
            });
        }
        
        // Re-create bind group with new buffers
        if (this.renderPipeline) {
            const bindGroupLayout = this.renderPipeline.getBindGroupLayout(0);
            this.bindGroup = this.device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.rectBuffer } },
                    { binding: 1, resource: { buffer: this.timeBuffer } },
                    { binding: 2, resource: { buffer: this.viewportBuffer } },
                    { binding: 3, resource: { buffer: this.rectDataBuffer } },
                ]
            });
        }
    }
    
    updateRectangles(rectangles) {
        if (!this.rectBuffer || !this.rectDataBuffer || rectangles.length > this.rectCount) {
            return;
        }
        
        const rectData = new Float32Array(this.rectCount * 8);
        const customData = new Float32Array(this.rectCount * 4);
        
        // Fill with rectangles data
        for (let i = 0; i < rectangles.length; i++) {
            const rect = rectangles[i];
            const baseIndex = i * 8;
            const dataIndex = i * 4;
            
            rectData[baseIndex] = rect.position[0];
            rectData[baseIndex + 1] = rect.position[1];
            rectData[baseIndex + 2] = rect.size[0];
            rectData[baseIndex + 3] = rect.size[1];
            
            // Assign a shader type or use randomly selected one
            rectData[baseIndex + 4] = rect.shaderType !== undefined ? 
                rect.shaderType : Math.floor(Math.random() * this.shaderTypeCount);
            
            // Padding indices 5-7 remain 0
            
            // Generate some random custom data for this rectangle
            customData[dataIndex] = Math.random();
            customData[dataIndex + 1] = Math.random();
            customData[dataIndex + 2] = Math.random();
            customData[dataIndex + 3] = Math.random();
        }
        
        // Write data to buffers
        this.device.queue.writeBuffer(this.rectBuffer, 0, rectData);
        this.device.queue.writeBuffer(this.rectDataBuffer, 0, customData);
    }
    
    render(commandEncoder, textureView) {
        // Update time for animations
        this.updateTimeBuffer();
        
        // Begin render pass (without depth)
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: 'load', // Don't clear - we're drawing on top
                    storeOp: 'store'
                }
            ]
        });
        
        // Set pipeline and bind group
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        
        // Draw rectangles (6 vertices per rectangle - 2 triangles)
        passEncoder.draw(6, this.rectCount, 0, 0);
        
        // End the render pass
        passEncoder.end();
    }
    
    updateViewportDimensions(width, height) {
        this.canvasWidth = Math.max(1, width);
        this.canvasHeight = Math.max(1, height);
    }
    
    cleanup() {
        try {
            // Clean up buffers
            const buffers = ['rectBuffer', 'timeBuffer', 'rectDataBuffer'];
            
            buffers.forEach(bufferName => {
                if (this[bufferName]) {
                    if (typeof this[bufferName].destroy === 'function') {
                        try {
                            this[bufferName].destroy();
                        } catch (e) {
                            console.warn(`Error destroying ${bufferName}:`, e);
                        }
                    }
                    this[bufferName] = null;
                }
            });
            
            // Clean up other references
            this.bindGroup = null;
            this.renderPipeline = null;
            this.rectShaderCode = null;
            this.camera = null;
            this.viewportBuffer = null;
            
            // Call parent cleanup
            super.cleanup();
        } catch (error) {
            console.error("Error in ShaderRectPipeline cleanup:", error);
        }
    }
    
    // Fallback shader code if loading from file fails
    getFallbackShaderCode() {
        return `
        struct RectData {
            position: vec2f,
            size: vec2f,
            shaderType: f32,
            padding: vec3f,
        };
        
        struct CustomData {
            params: vec4f,
        };
        
        @group(0) @binding(0) var<storage, read> rectangles: array<RectData>;
        @group(0) @binding(1) var<uniform> time: f32;
        @group(0) @binding(2) var<uniform> viewport: vec2f;
        @group(0) @binding(3) var<storage, read> customData: array<CustomData>;
        
        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) uv: vec2f,
            @location(1) @interpolate(flat) rectIndex: u32,
        };
        
        @vertex
        fn vertex_main(
            @builtin(vertex_index) vertexIndex: u32,
            @builtin(instance_index) instanceIndex: u32
        ) -> VertexOutput {
            // Each rectangle consists of 2 triangles (6 vertices)
            let vertexInRect = vertexIndex % 6u;
            let rectIndex = instanceIndex;
            
            // Get rectangle data
            let rect = rectangles[rectIndex];
            
            // Define the 6 vertices for a quad (2 triangles)
            var localPos: vec2f;
            
            switch vertexInRect {
                case 0u: { localPos = vec2f(0.0, 0.0); } // Bottom-left
                case 1u: { localPos = vec2f(1.0, 0.0); } // Bottom-right
                case 2u: { localPos = vec2f(0.0, 1.0); } // Top-left
                case 3u: { localPos = vec2f(1.0, 0.0); } // Bottom-right
                case 4u: { localPos = vec2f(1.0, 1.0); } // Top-right
                case 5u: { localPos = vec2f(0.0, 1.0); } // Top-left
                default: { localPos = vec2f(0.0, 0.0); } // Fallback
            }
            
            // Transform to rectangle position and size
            let worldPos = rect.position + localPos * rect.size;
            
            // Adjust to clip space (-1 to 1)
            let clipPos = worldPos * 2.0 - 1.0;
            // Y is flipped in clip space
            let adjustedClipPos = vec2f(clipPos.x, -clipPos.y);
            
            var output: VertexOutput;
            output.position = vec4f(adjustedClipPos, 0.0, 1.0);
            output.uv = localPos;
            output.rectIndex = rectIndex;
            
            return output;
        }
        
        // Hash function for procedural noise
        fn hash21(p: vec2f) -> f32 {
            var n = dot(p, vec2f(127.1, 311.7));
            return fract(sin(n) * 43758.5453);
        }
        
        @fragment
        fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
            let rectIndex = input.rectIndex;
            let rect = rectangles[rectIndex];
            let params = customData[rectIndex].params;
            
            // Ecco-2k inspired edgy London vibes - black rectangle
            var color = vec4f(0.0, 0.0, 0.0, 0.85);
            
            // Add subtle noise texture
            let noise = hash21(input.uv * 100.0 + time * 0.1) * 0.05;
            color.r += noise;
            color.g += noise;
            color.b += noise;
            
            // Add subtle border
            let borderWidth = 0.02;
            if (input.uv.x < borderWidth || input.uv.x > (1.0 - borderWidth) || 
                input.uv.y < borderWidth || input.uv.y > (1.0 - borderWidth)) {
                // Subtle flicker
                let flicker = 0.8 + 0.2 * sin(time * 10.0 + params.y * 10.0);
                color = vec4f(0.2, 0.2, 0.2, 0.9) * flicker;
            }
            
            return color;
        }`;
    }
} 