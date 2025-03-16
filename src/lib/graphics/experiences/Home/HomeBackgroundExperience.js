import Experience from '../Experience.js';
import { createFullScreenQuad } from '../../utils/geometryUtils.js';
// Remove the direct import
// import matrixShader from './MatrixShader.wgsl';

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
    // Apply subtle warping effect around mouse cursor
    var warped_uv = uv;
    let mouse_vector = uv - mouse;
    let mouse_dist = length(mouse_vector);
    let warp_strength = 0.03; // Very subtle warping
    let warp_radius = 0.3; // Radius of influence
    
    // Only apply warping within the radius
    if (mouse_dist < warp_radius) {
        // Calculate warping factor - stronger closer to cursor, fading out to edge
        let warp_factor = smoothstep(warp_radius, 0.0, mouse_dist) * warp_strength;
        
        // Create a subtle swirl/lens effect
        let angle = atan2(mouse_vector.y, mouse_vector.x) + sin(time * 0.5) * 0.2;
        let swirl = vec2<f32>(cos(angle), sin(angle)) * mouse_dist;
        
        // Apply the warping
        warped_uv -= swirl * warp_factor;
    }
    
    // Simple gradient background
    var color = vec3<f32>(warped_uv.x * 0.1, warped_uv.y * 0.1, 0.1);
    
    // Add time-based animation
    color.g += sin(time) * 0.1 + 0.1;
    
    return vec4<f32>(color, 1.0);
}
`;

class HomeBackgroundExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Initialize loading state
        this.isLoading = true;
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
    
    async loadShader() {
        // Fetch the shader from the static directory instead of using the imported one
        let shaderCode = FALLBACK_SHADER;
        try {
            const response = await fetch('/shaders/home/MatrixShader.wgsl');
            if (response.ok) {
                shaderCode = await response.text();
            } else {
                console.warn("Matrix shader not found in static directory, using fallback shader");
            }
        } catch (error) {
            console.error("Error loading Matrix shader:", error);
            console.warn("Using fallback shader");
        }
        return shaderCode;
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Create the pipeline
            this.pipeline = new HomeBackgroundPipeline(this.device, this.resourceManager);
            
            // Initialize the pipeline
            const success = await this.pipeline.initialize();
            if (!success) {
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
            // Set up camera target to center of grid without overriding position
            this.updateLoadingState(true, "Configuring camera...", 90);
            if (this.resourceManager && this.resourceManager.camera) {
                // Look at the center of the grid (0,0,0)
                this.resourceManager.camera.target = [0, 0, 0];
                this.resourceManager.camera.updateView();
                
                // Set up camera controller if available
                if (this.resourceManager.cameraController) {
                    // Set the target to the center of the grid
                    this.resourceManager.cameraController.target = [0, 0, 0];
                }
            }
            
            this.updateLoadingState(false, "Initialization complete", 100);
            return true;
        } catch (error) {
            console.error("Error initializing Home Background Experience:", error);
            this.updateLoadingState(false, `Error: ${error.message}`, 100);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        if (!this.pipeline || !this.pipeline.isInitialized) {
            return;
        }
        
        try {
            // Get depth texture view
            const depthTextureView = this.resourceManager.getDepthTextureView?.();
            if (!depthTextureView) {
                return;
            }
            
            // Update time (for subtle animation)
            this.time += 0.01;
            
            // Update uniform buffer with time
            this.device.queue.writeBuffer(
                this.uniformBuffer,
                0,
                new Float32Array([0, 0, 0, this.time])
            );
            
            // Render using pipeline
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                this.uniformBuffer,
                this.totalIndices
            );
        } catch (error) {
            console.error("Error in Home Background render:", error);
        }
    }
    
    cleanup() {
        // Remove event listener
        // Clean up pipeline
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Clean up buffers
        if (this.vertexBuffer) {
            this.vertexBuffer = null;
        }
        
        if (this.indexBuffer) {
            this.indexBuffer = null;
        }
        
        if (this.uniformBuffer) {
            this.uniformBuffer = null;
        }
        
        // Reset state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.time = 0;
        
        // Remove from resource manager
        if (this.resourceManager && this.resourceManager.experiences) {
            if (this.resourceManager.experiences.homeBackground === this) {
                this.resourceManager.experiences.homeBackground = null;
            }
        }
        
        // Clear device and resource manager references
        this.device = null;
        this.resourceManager = null;
        
        // Call parent cleanup
        super.cleanup();
    }
}

export default HomeBackgroundExperience; 