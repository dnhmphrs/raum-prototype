import Experience from '../Experience';
import RiemannPipeline from './RiemannPipeline.js';

class RiemannExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Initialize surface type
        this.surfaceType = 'riemann';
        
        // Initialize loading state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.loadingMessage = "Initializing...";
        
        // Register this experience with the resource manager
        if (this.resourceManager) {
            if (!this.resourceManager.experiences) {
                this.resourceManager.experiences = {};
            }
            this.resourceManager.experiences.riemann = this;
        }
        
        // Grid resolution
        this.resolution = 100;
        this.totalVertices = this.resolution * this.resolution;
        this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6;
        
        // Create vertex and index buffers
        this.createBuffers();
        
        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Riemann Uniforms Buffer'
        });
    }
    
    // Method to update loading state
    updateLoadingState(isLoading, message = "", progress = 0) {
        this.isLoading = isLoading;
        this.loadingMessage = message;
        this.loadingProgress = progress;
        
        // Dispatch a custom event that the UI can listen for
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('riemann-loading-update', { 
                detail: { 
                    isLoading: this.isLoading,
                    message: this.loadingMessage,
                    progress: this.loadingProgress
                } 
            });
            window.dispatchEvent(event);
        }
    }
    
    // For compatibility with the original code
    changeManifold(surfaceType) {
        return this.updateSurface(surfaceType);
    }
    
    createBuffers() {
        // Create vertices for the grid
        const vertices = new Float32Array(this.totalVertices * 3); // x, y, z for each vertex
        
        // Generate a flat grid initially
        this.generateSurface(vertices, 'flat');
        
        // Create vertex buffer with mappedAtCreation for better memory management
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
            label: 'Riemann Vertex Buffer'
        });
        
        // Copy data to the mapped buffer and unmap
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create indices for the grid
        const indices = new Uint32Array(this.totalIndices);
        let index = 0;
        
        for (let y = 0; y < this.resolution - 1; y++) {
            for (let x = 0; x < this.resolution - 1; x++) {
                // First triangle
                indices[index++] = y * this.resolution + x;
                indices[index++] = y * this.resolution + x + 1;
                indices[index++] = (y + 1) * this.resolution + x;
                
                // Second triangle
                indices[index++] = y * this.resolution + x + 1;
                indices[index++] = (y + 1) * this.resolution + x + 1;
                indices[index++] = (y + 1) * this.resolution + x;
            }
        }
        
        // Create index buffer with mappedAtCreation for better memory management
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
            label: 'Riemann Index Buffer'
        });
        
        // Copy data to the mapped buffer and unmap
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
    }
    
    // Method to update the surface based on the selected type
    updateSurface(surfaceType) {
        try {
            if (!this.surfaceShaderMap) {
                console.warn("surfaceShaderMap is not defined, initializing with defaults");
                this.initializeSurfaceShaderMap();
            }
            
            // Update the surface type
            this.surfaceType = surfaceType;
            
            // Generate the new surface
            this.generateSurface();
            
            return true;
        } catch (error) {
            console.error("Error updating surface:", error);
            return false;
        }
    }
    
    // Generate different surface types
    generateSurface(vertices, surfaceType) {
        try {
            if (!this.surfaceShaderMap) {
                console.warn("surfaceShaderMap is not defined, initializing with defaults");
                this.initializeSurfaceShaderMap();
            }
            
            // Get the shader for the current surface type
            const shader = this.surfaceShaderMap.get(surfaceType);
            
            // Generate the surface using the appropriate shader
            this.generateFlatGrid();
            
            return true;
        } catch (error) {
            console.error("Error generating surface:", error);
            return false;
        }
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Create the pipeline
            this.pipeline = new RiemannPipeline(this.device, this.resourceManager);
            
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
            
            // Safety check for surfaceShaderMap
            if (!this.surfaceShaderMap) {
                console.warn("surfaceShaderMap is not defined in render, using default shader");
                this.surfaceShaderMap = {
                    'flat': 'default',
                    'sine': 'default',
                    'ripple': 'default',
                    'complex': 'default',
                    'torus': 'default'
                };
            }
            
            // Get the shader type for the current surface
            const shaderType = this.surfaceShaderMap[this.currentSurface] || 'default';
            
            // Render using pipeline with the appropriate shader
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                this.uniformBuffer,
                this.totalIndices,
                shaderType
            );
        } catch (error) {
            console.error('Error in Riemann render:', error);
        }
    }
    
    handleResize(width, height) {
        if (this.resourceManager.camera) {
            this.resourceManager.camera.updateAspect(width, height);
        }
        
        if (this.resourceManager.updateDepthTexture) {
            this.resourceManager.updateDepthTexture(width, height);
        }
    }
    
    cleanup() {
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
            if (this.resourceManager.experiences.riemann === this) {
                this.resourceManager.experiences.riemann = null;
            }
        }
        
        // Clear device and resource manager references
        this.device = null;
        this.resourceManager = null;
        
        // Call parent cleanup
        super.cleanup();
    }
}

export default RiemannExperience; 