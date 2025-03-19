import Pipeline from '../../pipelines/Pipeline';

export default class ShaderRectPipeline extends Pipeline {
    constructor(device, camera, viewportBuffer, initialRectCount = 5, canvasWidth = 800, canvasHeight = 600) {
        super(device);
        this.camera = camera;
        this.viewportBuffer = viewportBuffer;
        this.rectCount = Math.max(1, initialRectCount); // Always ensure at least 1 rectangle
        
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
        
        // Track whether we're properly initialized
        this.isInitialized = false;
        
        // Synchronization
        this.bufferUpdateInProgress = false;
        this.pendingUpdates = false;
        this.minBufferSize = 48; // Minimum bytes required as per error message
    }

    async initialize() {
        // Ensure we have at least one rectangle
        if (this.rectCount < 1) {
            this.rectCount = 1;
        }
        
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
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Error initializing ShaderRectPipeline:", error);
            // Use fallback shader if loading fails
            this.rectShaderCode = this.getFallbackShaderCode();
            await this.initializeRenderPipeline();
            this.isInitialized = true;
            return true;
        }
    }
    
    createBuffers() {
        // Ensure we always have at least one rectangle
        this.rectCount = Math.max(1, this.rectCount);
        
        // Ensure buffer size is sufficient - min 48 bytes as per error
        const rectBufferSize = Math.max(
            this.minBufferSize,
            this.rectCount * 8 * Float32Array.BYTES_PER_ELEMENT
        );
        
        // Buffer for rectangle data (position, size, shader type)
        // Format per rectangle: x, y, width, height, shaderType, padding[3]
        // Each rectangle takes 8 floats (32 bytes)
        this.rectBuffer = this.device.createBuffer({
            size: rectBufferSize,
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
        const dataBufferSize = Math.max(
            16, // Minimum 16 bytes (4 floats)
            this.rectCount * 4 * Float32Array.BYTES_PER_ELEMENT
        );
        
        this.rectDataBuffer = this.device.createBuffer({
            size: dataBufferSize,
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
        
        // Safety padding for extremely small counts
        if (this.rectCount === 1) {
            // Ensure at least 48 bytes in the buffer for the minimum required size
            rectData[0] = 0.1; // x
            rectData[1] = 0.1; // y
            rectData[2] = 0.1; // width
            rectData[3] = 0.1; // height
            rectData[4] = 0; // shader type
            rectData[5] = 0; // padding
            rectData[6] = 0; // padding
            rectData[7] = 0; // padding
            
            // Also ensure custom data is initialized
            customData[0] = 0.5;
            customData[1] = 0.5;
            customData[2] = 0.5;
            customData[3] = 0.5;
        } else {
            // Initialize multiple rectangles with default data
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
        }
        
        // Safely write to device buffers
        try {
            this.device.queue.writeBuffer(this.rectBuffer, 0, rectData);
            this.device.queue.writeBuffer(this.rectDataBuffer, 0, customData);
            
            // Initialize time
            this.updateTimeBuffer();
        } catch (e) {
            console.error("Error initializing default rectangles:", e);
            this.isInitialized = false;
        }
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
        // Don't update if already in progress, just mark as pending
        if (this.bufferUpdateInProgress) {
            this.pendingUpdates = true;
            return;
        }
        
        this.bufferUpdateInProgress = true;
        
        try {
            // Always ensure at least 1 rectangle to prevent buffer size issues
            const safeCount = Math.max(1, newCount);
            
            if (safeCount === this.rectCount) {
                this.bufferUpdateInProgress = false;
                return;
            }
            
            this.rectCount = safeCount;
            
            // Destroy old buffers before creating new ones
            if (this.rectBuffer) {
                if (typeof this.rectBuffer.destroy === 'function') {
                    try {
                        this.rectBuffer.destroy();
                    } catch (e) {
                        console.warn("Error destroying rect buffer:", e);
                    }
                }
                this.rectBuffer = null;
            }
            
            if (this.rectDataBuffer) {
                if (typeof this.rectDataBuffer.destroy === 'function') {
                    try {
                        this.rectDataBuffer.destroy();
                    } catch (e) {
                        console.warn("Error destroying rect data buffer:", e);
                    }
                }
                this.rectDataBuffer = null;
            }
            
            // Calculate safe buffer sizes - ensure at least min size
            const rectBufferSize = Math.max(
                this.minBufferSize,
                this.rectCount * 8 * Float32Array.BYTES_PER_ELEMENT
            );
            
            const dataBufferSize = Math.max(
                16, // Minimum 16 bytes (4 floats)
                this.rectCount * 4 * Float32Array.BYTES_PER_ELEMENT
            );
            
            // Create new buffers with sufficient size
            this.rectBuffer = this.device.createBuffer({
                size: rectBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Buffer'
            });
            
            this.rectDataBuffer = this.device.createBuffer({
                size: dataBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Data Buffer'
            });
            
            // Only recreate bind group if we have a pipeline
            if (this.renderPipeline) {
                try {
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
                } catch (e) {
                    console.error("Error creating bind group:", e);
                    this.isInitialized = false;
                }
            }
            
            // Initialize with default rectangles to ensure valid data
            this.initializeDefaultRectangles();
        } catch (e) {
            console.error("Error updating rect count:", e);
            this.isInitialized = false;
        } finally {
            this.bufferUpdateInProgress = false;
            
            // Check if we should process additional updates
            if (this.pendingUpdates) {
                this.pendingUpdates = false;
                // Force re-initialization on next render
                this.isInitialized = false;
            }
        }
    }
    
    updateRectangles(rectangles) {
        // Don't update if initialization not complete
        if (!this.isInitialized) {
            return;
        }
        
        // Don't update if already in progress
        if (this.bufferUpdateInProgress) {
            this.pendingUpdates = true;
            return;
        }
        
        this.bufferUpdateInProgress = true;
        
        try {
            // Safety check - if we have no rectangles to update, initialize default ones
            if (!rectangles || rectangles.length === 0) {
                this.initializeDefaultRectangles();
                this.bufferUpdateInProgress = false;
                return;
            }
            
            if (!this.rectBuffer || !this.rectDataBuffer) {
                this.isInitialized = false;
                this.bufferUpdateInProgress = false;
                return;
            }
            
            // If rectangle count mismatch, update the count first
            if (rectangles.length !== this.rectCount) {
                this.bufferUpdateInProgress = false;
                this.updateRectCount(rectangles.length);
                this.bufferUpdateInProgress = true;
            }
            
            const rectData = new Float32Array(this.rectCount * 8);
            const customData = new Float32Array(this.rectCount * 4);
            
            // Fill with rectangles data
            for (let i = 0; i < this.rectCount; i++) {
                const rect = i < rectangles.length ? rectangles[i] : { 
                    position: [0.1, 0.1], 
                    size: [0.1, 0.1], 
                    shaderType: 0 
                };
                
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
            try {
                this.device.queue.writeBuffer(this.rectBuffer, 0, rectData);
                this.device.queue.writeBuffer(this.rectDataBuffer, 0, customData);
            } catch (e) {
                console.error("Error writing to buffers:", e);
                this.isInitialized = false;
            }
        } catch (e) {
            console.error("Error updating rectangles:", e);
            this.isInitialized = false;
        } finally {
            this.bufferUpdateInProgress = false;
            
            // Check if we should process additional updates
            if (this.pendingUpdates) {
                this.pendingUpdates = false;
                // Force re-initialization on next render
                this.isInitialized = false;
            }
        }
    }
    
    render(commandEncoder, textureView) {
        // If not initialized, try to recover
        if (!this.isInitialized) {
            this.recreateResourcesOnError();
            return;
        }
        
        // Safety check - don't render if we have invalid state or update in progress
        if (!this.renderPipeline || !this.bindGroup || this.rectCount < 1 || this.bufferUpdateInProgress) {
            return;
        }
        
        try {
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
                // No depth attachment - we want rectangles to appear between background and flock
                // This ensures they're always behind 3D objects but on top of the background
            });
            
            // Set pipeline and bind group
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            
            // Draw rectangles (6 vertices per rectangle - 2 triangles)
            passEncoder.draw(6, this.rectCount, 0, 0);
            
            // End the render pass
            passEncoder.end();
        } catch (error) {
            console.error("Error rendering shader rectangles:", error);
            // Try to recreate resources if we encounter an error
            this.recreateResourcesOnError();
        }
    }
    
    recreateResourcesOnError() {
        try {
            // Reset initialization flag
            this.isInitialized = false;
            
            // Clean up existing resources
            if (this.bindGroup) {
                this.bindGroup = null;
            }
            
            // Ensure we have at least one rectangle 
            this.rectCount = Math.max(1, this.rectCount);
            
            // Force a fixed buffer size to avoid size issues
            const fixedSize = 1; // Use exactly one fixed rectangle for recovery
            
            // Reset state
            this.bufferUpdateInProgress = false;
            this.pendingUpdates = false;
            
            console.log("Emergency recovery: Creating fixed-size buffers");
            
            // Create fixed-size buffers with ample padding
            this.rectBuffer = this.device.createBuffer({
                size: Math.max(64, fixedSize * 8 * Float32Array.BYTES_PER_ELEMENT), // At least 64 bytes
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Buffer (Recovery)'
            });
            
            this.rectDataBuffer = this.device.createBuffer({
                size: Math.max(32, fixedSize * 4 * Float32Array.BYTES_PER_ELEMENT), // At least 32 bytes
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Rectangle Data Buffer (Recovery)'
            });
            
            // Ensure time buffer exists
            if (!this.timeBuffer) {
                this.timeBuffer = this.device.createBuffer({
                    size: 4,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    label: 'Time Buffer'
                });
            }
            
            // Write emergency recovery data with a single rectangle
            const rectData = new Float32Array(fixedSize * 8);
            rectData[0] = 0.1; // x
            rectData[1] = 0.1; // y
            rectData[2] = 0.1; // width
            rectData[3] = 0.1; // height
            rectData[4] = 0; // shader type
            // padding at indices 5-7 are 0
            
            const customData = new Float32Array(fixedSize * 4);
            customData[0] = 0.5;
            customData[1] = 0.5;
            customData[2] = 0.5;
            customData[3] = 0.5;
            
            // Write the data
            this.device.queue.writeBuffer(this.rectBuffer, 0, rectData);
            this.device.queue.writeBuffer(this.rectDataBuffer, 0, customData);
            this.updateTimeBuffer();
            
            // Re-initialize pipeline with the emergency fixed size
            this.rectCount = fixedSize;
            
            // Re-initialize pipeline
            this.initializeRenderPipeline()
                .then(() => {
                    console.log("Emergency recovery successful");
                    this.isInitialized = true;
                })
                .catch(error => {
                    console.error("Failed to recover from render error:", error);
                });
        } catch (e) {
            console.error("Error in recovery attempt:", e);
        }
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
        
        // Function to create trippy color cycling
        fn trippyColors(time: f32, params: vec4f) -> vec3f {
            // Base color cycling
            let r = sin(time * 2.0 + params.x * 10.0) * 0.5 + 0.5;
            let g = sin(time * 2.5 + params.y * 10.0) * 0.5 + 0.5;
            let b = sin(time * 3.0 + params.z * 10.0) * 0.5 + 0.5;
            
            return vec3f(r, g, b);
        }
        
        // Function to create flashing behavior
        fn flashEffect(time: f32, params: vec4f) -> f32 {
            // Fast flashing that varies with params
            let flashSpeed = 4.0 + params.x * 8.0; // 4-12 Hz flashing
            
            // Mix of different frequencies for unpredictable flashing
            let flash1 = step(0.5, sin(time * flashSpeed));
            let flash2 = step(0.6, sin(time * (flashSpeed * 0.7 + params.y * 5.0)));
            
            // Combine different flash patterns
            let combinedFlash = flash1 * 0.7 + flash2 * 0.5;
            
            // Ensure we don't go completely black too often
            return mix(0.4, 1.0, combinedFlash);
        }
        
        @fragment
        fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
            let rectIndex = input.rectIndex;
            let rect = rectangles[rectIndex];
            let params = customData[rectIndex].params;
            
            // Get flash intensity
            let flashIntensity = flashEffect(time, params);
            
            // Trippy colors with noise
            let colors = trippyColors(time, params);
            
            // Add noise texture
            let noise = hash21(input.uv * 100.0 + time * 0.1) * 0.1;
            
            // Base color with full opacity
            var color = vec4f(colors + vec3f(noise), 1.0);
            
            // Apply flash effect
            color = color * flashIntensity;
            
            return color;
        }`;
    }
} 