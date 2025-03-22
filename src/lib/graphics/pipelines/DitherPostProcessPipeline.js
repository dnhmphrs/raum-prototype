import Pipeline from './Pipeline.js';

export default class DitherPostProcessPipeline extends Pipeline {
    constructor(device, viewportBuffer, canvasWidth = 800, canvasHeight = 600) {
        super(device);
        this.viewportBuffer = viewportBuffer;
        
        // Store canvas dimensions
        this.canvasWidth = Math.max(1, canvasWidth);
        this.canvasHeight = Math.max(1, canvasHeight);
        
        // Pipeline related
        this.renderPipeline = null;
        this.bindGroup = null;
        
        // Shader code
        this.ditherShaderCode = null;
        
        // Settings buffer for dithering effect
        this.settingsBuffer = null;
        this.settings = null; // Will be initialized by setSettings
        
        // Track whether we're properly initialized
        this.isInitialized = false;
    }

    async initialize() {
        // Create settings buffer
        this.settingsBuffer = this.createBuffer({
            size: 16, // 4 float32 values (4 bytes each)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Dither Settings Buffer'
        });
        
        // Don't update settings here - they'll be set from the Experience
        // this.updateSettings();
        
        // Use the built-in shader code directly
        this.ditherShaderCode = this.getShaderCode();
        
        try {
            // Initialize the render pipeline
            await this.initializeRenderPipeline();
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Error initializing DitherPostProcessPipeline:", error);
            return false;
        }
    }
    
    async initializeRenderPipeline() {
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport size
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Dither settings
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // Sampler
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // Input texture
            ]
        });
        
        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });
        
        // Create shader module
        const shaderModule = this.createShaderModule({
            code: this.ditherShaderCode
        });
        
        // Create render pipeline
        this.renderPipeline = await this.device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertex_main',
                buffers: [] // No vertex buffers needed - using a full-screen quad generated in the shader
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragment_main',
                targets: [{ format }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            // No depth testing - this is a full-screen post process
        });
        
        // Create sampler for the texture - use nearest for pixelated look
        this.sampler = this.device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            magFilter: 'nearest',
            minFilter: 'nearest'
        });
    }
    
    updateSettings() {
        // Create settings object if it doesn't exist
        if (!this.settings) {
            this.settings = {
                patternScale: 1.0,
                thresholdOffset: -0.05,
                noiseIntensity: 0.08,
                colorReduction: 2.0
            };
        }
        
        // Ensure buffer exists
        if (!this.settingsBuffer) {
            console.warn("Cannot update dither settings: buffer not initialized");
            return;
        }
            
        // Update the dither settings buffer
        try {
            const settingsArray = new Float32Array([
                this.settings.patternScale,
                this.settings.thresholdOffset,
                this.settings.noiseIntensity,
                this.settings.colorReduction
            ]);
            this.device.queue.writeBuffer(this.settingsBuffer, 0, settingsArray);
        } catch (error) {
            console.error("Error updating dither settings buffer:", error);
        }
    }
    
    // Method to update settings from outside
    setSettings(patternScale, thresholdOffset, noiseIntensity, colorReduction) {
        // Initialize settings object if it doesn't exist
        if (!this.settings) {
            this.settings = {};
        }
        
        this.settings.patternScale = patternScale;
        this.settings.thresholdOffset = thresholdOffset;
        this.settings.noiseIntensity = noiseIntensity;
        this.settings.colorReduction = colorReduction;
        this.updateSettings();
    }
    
    // Create a bind group for this specific texture
    createBindGroup(textureView) {
        return this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.viewportBuffer } },
                { binding: 1, resource: { buffer: this.settingsBuffer } },
                { binding: 2, resource: this.sampler },
                { binding: 3, resource: textureView }
            ]
        });
    }
    
    // Apply the dithering effect to the source texture and output to the destination texture
    render(commandEncoder, sourceTextureView, destinationTextureView) {
        if (!this.isInitialized || !this.renderPipeline) {
            console.warn("Cannot render dither effect: pipeline not initialized");
            return;
        }
        
        // Ensure settings are updated before rendering
        if (!this.settings) {
            console.warn("Dither settings not initialized, using defaults");
            this.settings = {
                patternScale: 1.0,
                thresholdOffset: -0.05,
                noiseIntensity: 0.08,
                colorReduction: 2.0
            };
            this.updateSettings();
        }
        
        // Create bind group specifically for this texture view
        const bindGroup = this.createBindGroup(sourceTextureView);
        
        // Begin render pass
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: destinationTextureView,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0, g: 0, b: 0, a: 1 }
                }
            ]
        });
        
        // Set pipeline and bind group
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        
        // Draw 6 vertices (2 triangles) for a full-screen quad
        passEncoder.draw(6, 1, 0, 0);
        
        // End render pass
        passEncoder.end();
    }
    
    updateViewportDimensions(width, height) {
        // Update stored dimensions
        this.canvasWidth = Math.max(1, width);
        this.canvasHeight = Math.max(1, height);
    }
    
    cleanup() {
        // Clean up resources handled by parent class
        super.cleanup();
    }
    
    getShaderCode() {
        return `
        // Dither post-processing shader with extreme pixelation

        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) texCoord: vec2f,
        };
        
        @group(0) @binding(0) var<uniform> viewport: vec2f;
        @group(0) @binding(1) var<uniform> settings: vec4f; // patternScale, thresholdOffset, noiseIntensity, colorReduction
        @group(0) @binding(2) var texSampler: sampler;
        @group(0) @binding(3) var inputTexture: texture_2d<f32>;
        
        @vertex
        fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
            // Generate a fullscreen quad
            var output: VertexOutput;
            var pos = array<vec2f, 6>(
                vec2f(-1.0, -1.0),
                vec2f(1.0, -1.0),
                vec2f(-1.0, 1.0),
                vec2f(-1.0, 1.0),
                vec2f(1.0, -1.0),
                vec2f(1.0, 1.0)
            );
            
            var texCoord = array<vec2f, 6>(
                vec2f(0.0, 1.0),
                vec2f(1.0, 1.0),
                vec2f(0.0, 0.0),
                vec2f(0.0, 0.0),
                vec2f(1.0, 1.0),
                vec2f(1.0, 0.0)
            );
            
            output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
            output.texCoord = texCoord[vertexIndex];
            
            return output;
        }
        
        // Generate pseudo-random noise
        fn rand(co: vec2f) -> f32 {
            return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
        }
        
        // Bayer matrix for ordered dithering
        fn getBayerValue(pos: vec2f) -> f32 {
            let x = u32(pos.x) % 4u;
            let y = u32(pos.y) % 4u;
            
            // 4x4 Bayer matrix, normalized to [0, 1]
            var bayerMatrix = array<f32, 16>(
                0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
                12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
                3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
                15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
            );
            
            return bayerMatrix[y * 4u + x];
        }
        
        // Apply extreme pixelation
        fn pixelate(texCoord: vec2f, pixelSize: f32) -> vec2f {
            let pixels = viewport / pixelSize;
            return floor(texCoord * pixels) / pixels;
        }
        
        // Extreme color quantization (creates limited palette)
        fn quantizeColor(color: vec3f, levels: f32) -> vec3f {
            return floor(color * levels) / levels;
        }
        
        @fragment
        fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
            // Extract settings
            let patternScale = settings.x;
            let thresholdOffset = settings.y;
            let noiseIntensity = settings.z;
            let colorReduction = max(1.0, settings.w * 6.0);
            
            // Calculate pixelation factor (pixel size) - should be a noticeable value
            // We use a constant large value for consistent strong pixelation
            let pixelSize = max(4.0, 24.0 / max(1.0, patternScale * 2.0));
            
            // Apply strong pixelation to texture coordinates
            let pixelatedCoord = pixelate(input.texCoord, pixelSize);
            
            // Sample the input texture with pixelated coordinates
            var color = textureSample(inputTexture, texSampler, pixelatedCoord);
            
            // Calculate luminance
            let luminance = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
            
            // Extreme color reduction first (for retro look)
            var reducedColor = quantizeColor(color.rgb, colorReduction);
            
            // Create a pixel grid position for deterministic dithering
            let pixelPos = floor(input.position.xy);
            
            // Get dithering threshold from Bayer pattern
            let bayerThreshold = getBayerValue(pixelPos);
            
            // Add noise for variation (if enabled)
            let threshold = bayerThreshold + thresholdOffset + (rand(pixelatedCoord) * noiseIntensity);
            
            // Apply harsh 1-bit dithering effect to create very visible pattern
            if (luminance < threshold) {
                // Dark areas
                reducedColor *= 0.4; // Significantly darker
                
                // Completely black in certain areas for more contrast
                if (luminance < 0.2 || (luminance < 0.4 && bayerThreshold > 0.7)) {
                    reducedColor = vec3f(0.0, 0.0, 0.0);
                }
            } else {
                // Light areas - boost brightness in some pixels
                if (luminance > 0.6 || (luminance > 0.4 && bayerThreshold < 0.2)) {
                    reducedColor = mix(reducedColor, vec3f(1.0), 0.4);
                }
            }
            
            return vec4f(reducedColor, color.a);
        }
        `;
    }
} 