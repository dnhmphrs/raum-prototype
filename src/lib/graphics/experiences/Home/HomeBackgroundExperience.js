import Experience from '../Experience.js';
import { createFullScreenQuad } from '../../utils/geometryUtils.js';

// Embed the shader code directly to avoid fetch issues
const MATRIX_SHADER_CODE = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Use a simpler uniform structure with explicit alignment
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    return output;
}

// Random function
fn random(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

// Hash function for matrix effect
fn hash(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.103, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Adjust UV to maintain aspect ratio
    var uv_aspect = uv;
    uv_aspect.x *= resolution.x / resolution.y;
    
    // Create a grid for the matrix effect
    let grid_size = 40.0;
    var grid_uv = floor(uv_aspect * grid_size) / grid_size;
    
    // Create digital rain effect
    var rain_speed = 0.3;
    var rain_offset = time * rain_speed;
    
    // Different columns move at different speeds
    let column_variation = hash(vec2<f32>(grid_uv.x, 0.0)) * 0.8 + 0.2;
    rain_offset *= column_variation;
    
    // Create falling characters
    var char_pos = grid_uv.y + rain_offset;
    char_pos = fract(char_pos);
    
    // Determine which characters are visible
    let char_hash = hash(grid_uv);
    let char_threshold = 0.2 + char_hash * 0.3;
    
    // Character brightness based on position
    var char_brightness = smoothstep(1.0, 0.0, char_pos * 2.0);
    
    // Only show characters that meet the threshold
    var char_visible = step(char_pos, char_threshold);
    
    // Glitch effect - occasional horizontal shifts
    let glitch_time = floor(time * 2.0);
    let glitch_seed = hash(vec2<f32>(glitch_time, grid_uv.y));
    let glitch_amount = step(0.96, glitch_seed) * 0.1;
    let glitch_offset = hash(vec2<f32>(grid_uv.y, glitch_time)) * 2.0 - 1.0;
    grid_uv.x += glitch_offset * glitch_amount;
    
    // Occasional color shifts
    let color_shift = step(0.95, hash(vec2<f32>(grid_uv.x, time)));
    let color_amount = hash(vec2<f32>(grid_uv.y, time));
    
    // Combine effects
    var color = vec3<f32>(0.0, 0.0, 0.0);
    
    // Base matrix color (brighter green)
    let matrix_color = vec3<f32>(0.0, 1.0, 0.4) * char_brightness * char_visible * 1.5;
    
    // Add occasional color variations
    let alt_color1 = vec3<f32>(0.0, 0.9, 1.0) * char_brightness * char_visible * 1.5;
    let alt_color2 = vec3<f32>(1.0, 0.6, 0.0) * char_brightness * char_visible * 1.5;
    
    // Mix colors based on hash
    color = mix(matrix_color, alt_color1, color_shift * color_amount);
    color = mix(color, alt_color2, color_shift * (1.0 - color_amount));
    
    // Add subtle scan lines
    let scan_line = sin(uv.y * resolution.y * 0.5) * 0.5 + 0.5;
    color *= 0.9 + scan_line * 0.2;
    
    // Add subtle vignette
    let vignette = 1.0 - length((uv - 0.5) * 1.5);
    color *= vignette;
    
    // Add subtle noise
    let noise = random(uv + time * 0.01) * 0.05;
    color += noise;
    
    // Add mouse interaction - enhanced glow around mouse position
    let mouse_dist = length(uv - mouse);
    let mouse_glow = smoothstep(0.4, 0.0, mouse_dist) * 0.5;
    color += vec3<f32>(0.0, mouse_glow, mouse_glow * 0.7);
    
    return vec4<f32>(color, 1.0);
}
`;

class HomeBackgroundExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Home Background Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Create a full-screen quad
        const { vertices, indices } = createFullScreenQuad();
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
        
        // Create separate uniform buffers for each parameter
        this.timeBuffer = this.device.createBuffer({
            size: 4, // Single float (4 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Time Uniform Buffer'
        });
        
        this.resolutionBuffer = this.device.createBuffer({
            size: 8, // Two floats (8 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Resolution Uniform Buffer'
        });
        
        this.mouseBuffer = this.device.createBuffer({
            size: 8, // Two floats (8 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Mouse Uniform Buffer'
        });
        
        // Animation time
        this.time = 0;
        
        // Mouse position (normalized)
        this.mouse = { x: 0.5, y: 0.5 };
        
        // Register mouse move event
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        }
    }
    
    handleMouseMove(event) {
        // Update mouse position (normalized coordinates)
        if (typeof window !== 'undefined') {
            this.mouse.x = event.clientX / window.innerWidth;
            this.mouse.y = 1.0 - (event.clientY / window.innerHeight); // Flip Y for WebGPU coordinates
        }
    }
    
    async initialize() {
        console.log("Initializing Home Background Experience");
        
        try {
            // Create bind group layout with separate bindings
            this.bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                        buffer: { type: 'uniform' } // Time
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                        buffer: { type: 'uniform' } // Resolution
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                        buffer: { type: 'uniform' } // Mouse
                    }
                ]
            });
            
            // Create pipeline layout
            this.pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            });
            
            // Create shader module using the embedded shader code
            const shaderModule = this.device.createShaderModule({
                label: "Matrix Shader Module",
                code: MATRIX_SHADER_CODE
            });
            
            // Create render pipeline
            this.pipeline = this.device.createRenderPipeline({
                layout: this.pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [
                        {
                            arrayStride: 3 * 4, // 3 floats, 4 bytes each
                            attributes: [
                                {
                                    // position
                                    shaderLocation: 0,
                                    offset: 0,
                                    format: 'float32x3'
                                }
                            ]
                        }
                    ]
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat()
                        }
                    ]
                },
                primitive: {
                    topology: 'triangle-list'
                }
            });
            
            // Create bind group with separate bindings
            this.bindGroup = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.timeBuffer
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.resolutionBuffer
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.mouseBuffer
                        }
                    }
                ]
            });
            
            console.log("Home Background Experience initialized successfully");
            return true;
        } catch (error) {
            console.error("Error initializing Home Background Experience:", error);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        try {
            // Update time
            this.time += 0.016; // Approximately 60fps
            
            // Get canvas dimensions - use the texture view's dimensions or fallback to window size
            let width = 800;
            let height = 600;
            
            // Try to get dimensions from the texture
            if (textureView && textureView.texture) {
                width = textureView.texture.width;
                height = textureView.texture.height;
            } 
            // Fallback to window dimensions if available
            else if (typeof window !== 'undefined') {
                width = window.innerWidth;
                height = window.innerHeight;
            }
            
            // Update time buffer
            this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([this.time]));
            
            // Update resolution buffer
            this.device.queue.writeBuffer(this.resolutionBuffer, 0, new Float32Array([width, height]));
            
            // Update mouse buffer
            this.device.queue.writeBuffer(this.mouseBuffer, 0, new Float32Array([this.mouse.x, this.mouse.y]));
            
            // Begin render pass
            const renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store'
                    }
                ]
            };
            
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.pipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.vertexBuffer);
            passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
            passEncoder.drawIndexed(6); // 6 indices for a quad (2 triangles)
            passEncoder.end();
        } catch (error) {
            console.error("Error in Home Background render:", error);
        }
    }
    
    cleanup() {
        console.log("Cleaning up Home Background Experience");
        
        // Remove event listener
        if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', this.handleMouseMove);
        }
        
        // Clean up buffers
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.timeBuffer = null;
        this.resolutionBuffer = null;
        this.mouseBuffer = null;
        
        // Call parent cleanup
        super.cleanup();
    }
}

export default HomeBackgroundExperience; 