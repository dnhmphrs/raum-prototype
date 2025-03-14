import Experience from '../Experience.js';
import GridCodePipeline from './GridCodePipeline.js';

class GridCodeExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Grid Code Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Debug flag
        this.debug = true; // Enable debug logging
        
        // Loading state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.loadingMessage = "Initializing...";
        
        // Register this experience with the resource manager
        if (this.resourceManager) {
            if (!this.resourceManager.experiences) {
                this.resourceManager.experiences = {};
            }
            this.resourceManager.experiences.gridcode = this;
        }
        
        // Grid resolution - reduced for better performance during debugging
        this.resolution = 100; // 50x50 grid (reduced from 100x100)
        this.totalVertices = this.resolution * this.resolution;
        this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6; // 2 triangles per grid cell
        
        // KP shader parameters
        this.kpParams = {
            scaleIndex: 2, // Default scale index (middle scale)
            distortion: 0  // Default distortion (none)
        };
        
        // Animation time
        this.time = 0;
        
        // Create vertex and index buffers
        this.createBuffers();
        
        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 3 unused floats + 1 float for time
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Grid Code Uniforms Buffer'
        });
        
        // Expose this experience globally
        if (typeof window !== 'undefined') {
            window.gridCodeExperience = this;
            console.log("Exposed GridCodeExperience globally as window.gridCodeExperience");
        }
        
        if (this.debug) {
            console.log("Grid Code Experience created with resolution:", this.resolution);
            console.log("Total vertices:", this.totalVertices);
            console.log("Total indices:", this.totalIndices);
        }
    }
    
    // Method to update loading state
    updateLoadingState(isLoading, message = "", progress = 0) {
        this.isLoading = isLoading;
        this.loadingMessage = message;
        this.loadingProgress = progress;
        
        // Dispatch a custom event that the UI can listen for
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('gridcode-loading-update', { 
                detail: { 
                    isLoading: this.isLoading,
                    message: this.loadingMessage,
                    progress: this.loadingProgress
                } 
            });
            window.dispatchEvent(event);
        }
        
        console.log(`Loading state: ${isLoading ? 'Loading' : 'Complete'} - ${message} (${progress}%)`);
    }
    
    createBuffers() {
        // Create vertices for the grid
        const vertices = new Float32Array(this.totalVertices * 3); // x, y, z for each vertex
        
        // Generate a flat grid initially - match Riemann's approach
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = (y * this.resolution + x) * 3;
                
                // Map grid coordinates to [-2, 2] range - CENTERED EXACTLY
                const xPos = (x / (this.resolution - 1)) * 4 - 2;
                const yPos = (y / (this.resolution - 1)) * 4 - 2;
                
                // Set vertex position (flat grid)
                vertices[index] = xPos;     // x
                vertices[index + 1] = yPos; // y
                vertices[index + 2] = 0;    // z (flat)
            }
        }
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create indices for the grid
        const indices = new Uint32Array(this.totalIndices);
        let indexCount = 0;
        
        for (let i = 0; i < this.resolution - 1; i++) {
            for (let j = 0; j < this.resolution - 1; j++) {
                const topLeft = i * this.resolution + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * this.resolution + j;
                const bottomRight = bottomLeft + 1;
                
                // First triangle (top-left, bottom-left, bottom-right)
                indices[indexCount++] = topLeft;
                indices[indexCount++] = bottomLeft;
                indices[indexCount++] = bottomRight;
                
                // Second triangle (top-left, bottom-right, top-right)
                indices[indexCount++] = topLeft;
                indices[indexCount++] = bottomRight;
                indices[indexCount++] = topRight;
            }
        }
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
    }
    
    // Function to update KP scale
    updateKPScale(scaleIndex) {
        console.log(`Updating KP scale to: ${scaleIndex}`);
        this.kpParams.scaleIndex = scaleIndex;
        
        if (this.pipeline) {
            this.pipeline.updateKPParams(scaleIndex, this.kpParams.distortion);
        }
    }
    
    // Function to update KP distortion
    updateKPDistortion(distortion) {
        console.log(`Updating KP distortion to: ${distortion}`);
        this.kpParams.distortion = distortion;
        
        if (this.pipeline) {
            this.pipeline.updateKPParams(this.kpParams.scaleIndex, distortion);
        }
    }
    
    async initialize() {
        console.log("Initializing Grid Code Experience");
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Create the pipeline
            this.pipeline = new GridCodePipeline(this.device, this.resourceManager);
            
            // Initialize the pipeline
            const success = await this.pipeline.initialize();
            if (!success) {
                console.error("Failed to initialize Grid Code Pipeline");
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
            // Set initial KP parameters
            this.pipeline.updateKPParams(this.kpParams.scaleIndex, this.kpParams.distortion);
            
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
                
                if (this.debug) {
                    console.log("Camera position:", this.resourceManager.camera.position);
                    console.log("Camera target:", this.resourceManager.camera.target);
                }
            }
            
            this.updateLoadingState(false, "Initialization complete", 100);
            return true;
        } catch (error) {
            console.error("Error initializing Grid Code Experience:", error);
            this.updateLoadingState(false, `Error: ${error.message}`, 100);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        if (!this.pipeline || !this.pipeline.isInitialized) {
            console.warn("Pipeline not initialized in render");
            return;
        }
        
        try {
            // Get depth texture view
            const depthTextureView = this.resourceManager.getDepthTextureView?.();
            if (!depthTextureView) {
                console.warn("Depth texture view not available in render");
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
            
            // Log rendering attempt (only occasionally to avoid spam)
            if (this.debug && Math.floor(this.time * 10) % 100 === 0) {
                console.log("Rendering Grid Code at time:", this.time.toFixed(2));
                console.log("Vertex buffer:", this.vertexBuffer ? "Available" : "Missing");
                console.log("Index buffer:", this.indexBuffer ? "Available" : "Missing");
                console.log("Total indices:", this.totalIndices);
                
                // Log camera info
                if (this.resourceManager && this.resourceManager.camera) {
                    console.log("Camera position:", this.resourceManager.camera.position);
                    console.log("Camera target:", this.resourceManager.camera.target);
                }
            }
            
            // Render using pipeline with the KP shader
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                this.uniformBuffer,
                this.totalIndices,
                'kp' // Always use KP shader
            );
        } catch (error) {
            console.error("Error in Grid Code render:", error);
        }
    }
    
    handleResize(width, height) {
        // Update camera aspect ratio if needed
        if (this.resourceManager && this.resourceManager.camera) {
            this.resourceManager.camera.updateAspect(width, height);
        }
        
        // Update depth texture if needed
        if (this.resourceManager.updateDepthTexture) {
            this.resourceManager.updateDepthTexture(width, height);
        }
    }
    
    cleanup() {
        console.log("Cleaning up Grid Code Experience");
        
        // Clean up pipeline
        if (this.pipeline) {
            console.log("Cleaning up Grid Code Pipeline");
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Clean up buffers - explicitly nullify WebGPU resources
        if (this.vertexBuffer) {
            console.log("Nullifying vertex buffer");
            this.vertexBuffer = null;
        }
        
        if (this.indexBuffer) {
            console.log("Nullifying index buffer");
            this.indexBuffer = null;
        }
        
        if (this.uniformBuffer) {
            console.log("Nullifying uniform buffer");
            this.uniformBuffer = null;
        }
        
        // Reset state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.time = 0;
        
        // Remove from resource manager
        if (this.resourceManager && this.resourceManager.experiences) {
            console.log("Removing Grid Code Experience from resource manager");
            if (this.resourceManager.experiences.gridcode === this) {
                this.resourceManager.experiences.gridcode = null;
            }
        }
        
        // Remove global reference
        if (typeof window !== 'undefined' && window.gridCodeExperience === this) {
            console.log("Removing global Grid Code Experience reference");
            window.gridCodeExperience = null;
        }
        
        // Clear device and resource manager references
        this.device = null;
        this.resourceManager = null;
        
        // Call parent cleanup
        super.cleanup();
        
        console.log("Grid Code Experience cleanup complete");
    }
}

export default GridCodeExperience; 