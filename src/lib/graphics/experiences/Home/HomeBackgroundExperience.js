import Experience from '../Experience.js';
import { createFullScreenQuad } from '../../utils/geometryUtils.js';
// Import the shader directly with a fallback mechanism
import matrixShader from './MatrixShader.wgsl';

// Simple fallback shader in case the imported one fails
const FALLBACK_SHADER = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5;
    return output;
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Simple gradient background
    var color = vec3<f32>(uv.x * 0.1, uv.y * 0.1, 0.1);
    
    // Add time-based animation
    color.g += sin(time) * 0.1 + 0.1;
    
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
            
            // Use the imported shader with fallback
            let shaderCode = matrixShader;
            if (!shaderCode || shaderCode.trim() === '') {
                console.warn("Matrix shader not found, using fallback shader");
                shaderCode = FALLBACK_SHADER;
            }
            
            const shaderModule = this.device.createShaderModule({
                label: "Matrix Shader Module",
                code: shaderCode
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