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
        
        // Initialize surface shader map
        this.initializeSurfaceShaderMap();
        
        // Register this experience with the resource manager
        if (this.resourceManager) {
            if (!this.resourceManager.experiences) {
                this.resourceManager.experiences = {};
            }
            this.resourceManager.experiences.riemann = this;
        }
        
        // Grid resolution - increase for better visual quality
        this.resolution = 200;
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
        
        // Initialize time
        this.time = 0;
    }
    
    // Initialize the mapping of surface types to shader types
    initializeSurfaceShaderMap() {
        this.surfaceShaderMap = new Map();
        this.surfaceShaderMap.set('flat', 'default');
        this.surfaceShaderMap.set('sine', 'sine');
        this.surfaceShaderMap.set('ripple', 'ripple');
        this.surfaceShaderMap.set('complex', 'complex');
        this.surfaceShaderMap.set('torus', 'torus');
        this.surfaceShaderMap.set('riemann', 'default');
        
        // Set current surface
        this.currentSurface = 'riemann';
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
            this.currentSurface = surfaceType;
            
            // Generate the new surface
            this.generateSurface(null, surfaceType);
            
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
            
            // Use provided values or fall back to defaults
            const vertexData = vertices || new Float32Array(this.totalVertices * 3);
            const surface = surfaceType || this.surfaceType || 'riemann';
            
            // Update current surface
            this.currentSurface = surface;
            
            // Generate a flat grid if no other type is specified
            if (surface === 'flat' || surface === 'riemann') {
                this.generateFlatGrid(vertexData);
            } else if (surface === 'sine') {
                this.generateSineWave(vertexData);
            } else if (surface === 'ripple') {
                this.generateRipple(vertexData);
            } else if (surface === 'complex') {
                this.generateComplexSurface(vertexData);
            } else if (surface === 'torus') {
                this.generateTorus(vertexData);
            } else {
                // Default to flat grid
                this.generateFlatGrid(vertexData);
            }
            
            // Update vertex buffer with new data if vertices were provided
            if (vertices && this.vertexBuffer) {
                this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
            }
            
            return true;
        } catch (error) {
            console.error("Error generating surface:", error);
            return false;
        }
    }
    
    // Helper method to generate a flat grid
    generateFlatGrid(vertexData) {
        const vertices = vertexData || new Float32Array(this.totalVertices * 3);
        let index = 0;
        
        // Scale factor to make the grid larger
        const scale = 2.0;
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                // Convert grid coordinates to -1 to 1 range, but scaled larger
                const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
                const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;
                
                // Set flat z position
                const zPos = 0;
                
                // Set vertex position
                vertices[index++] = xPos;
                vertices[index++] = yPos;
                vertices[index++] = zPos;
            }
        }
        
        return vertices;
    }
    
    // Helper method to generate a sine wave surface
    generateSineWave(vertexData) {
        const vertices = vertexData || new Float32Array(this.totalVertices * 3);
        let index = 0;
        
        // Scale factor to make the grid larger
        const scale = 2.0;
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                // Convert grid coordinates to -1 to 1 range, but scaled larger
                const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
                const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;
                
                // Much larger amplitude
                const zPos = 1.2 * Math.sin(xPos * Math.PI * 2) * Math.cos(yPos * Math.PI * 1.5);
                
                // Set vertex position
                vertices[index++] = xPos;
                vertices[index++] = yPos;
                vertices[index++] = zPos;
            }
        }
        
        return vertices;
    }
    
    // Helper method to generate a ripple surface
    generateRipple(vertexData) {
        const vertices = vertexData || new Float32Array(this.totalVertices * 3);
        let index = 0;
        
        // Scale factor to make the grid larger
        const scale = 2.0;
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                // Convert grid coordinates to -1 to 1 range, but scaled larger
                const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
                const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;
                
                // Distance from center
                const dist = Math.sqrt(xPos * xPos + yPos * yPos) / scale;
                
                // Much larger amplitude
                const zPos = 1.5 * Math.sin(dist * Math.PI * 5) / (1 + dist);
                
                // Set vertex position
                vertices[index++] = xPos;
                vertices[index++] = yPos;
                vertices[index++] = zPos;
            }
        }
        
        return vertices;
    }
    
    // Helper method to generate a complex surface
    generateComplexSurface(vertexData, time = 0) {
        const vertices = vertexData || new Float32Array(this.totalVertices * 3);
        let index = 0;
        
        // Scale factor to make the grid larger
        const scale = 2.0;
        
        // Use a more reasonable time scale - the previous value was too extreme
        const t = time * 0.5;
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                // Convert grid coordinates to -1 to 1 range, but scaled larger
                const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
                const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;
                
                // Calculate base position
                let zPos = 0;
                
                // Create a dramatically changing surface based on time
                // Use a completely different approach with more visible changes
                
                // Time-based parameters that change more dramatically
                const phase1 = t * 0.3;
                const phase2 = t * 0.7;
                
                // Create dramatic peaks that move across the surface
                const peak1X = Math.sin(phase1) * scale * 0.8;
                const peak1Y = Math.cos(phase1 * 1.3) * scale * 0.8;
                const peak2X = Math.sin(phase2 * 0.7 + 2) * scale * 0.8;
                const peak2Y = Math.cos(phase2 * 0.5 + 1) * scale * 0.8;
                
                // Distance from moving peaks
                const dist1 = Math.sqrt(Math.pow(xPos - peak1X, 2) + Math.pow(yPos - peak1Y, 2));
                const dist2 = Math.sqrt(Math.pow(xPos - peak2X, 2) + Math.pow(yPos - peak2Y, 2));
                
                // Create dramatic peaks that move across the surface
                const peak1 = 2.0 * Math.exp(-dist1 * 1.5);
                const peak2 = 1.5 * Math.exp(-dist2 * 1.5);
                
                // Add some ripples that change frequency over time
                const rippleFreq = 3.0 + Math.sin(t * 0.2) * 2.0;
                const dist = Math.sqrt(xPos * xPos + yPos * yPos);
                const ripple = 0.5 * Math.sin(dist * rippleFreq + t * 2.0);
                
                // Combine effects with dramatic time-based changes
                zPos = peak1 + peak2 + ripple;
                
                // Add dramatic vertical stretching that changes over time
                const stretch = 1.0 + Math.sin(t * 0.1) * 0.5;
                zPos *= stretch;
                
                // Set vertex position
                vertices[index++] = xPos;
                vertices[index++] = yPos;
                vertices[index++] = zPos;
            }
        }
        
        return vertices;
    }
    
    // Helper method to generate a torus surface
    generateTorus(vertexData) {
        const vertices = vertexData || new Float32Array(this.totalVertices * 3);
        let index = 0;
        
        // Enhanced torus parameters for better proportions
        const R = 0.65; // Major radius
        const r = 0.35; // Minor radius
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                // Convert grid coordinates to angle values
                const theta = (x / (this.resolution - 1)) * Math.PI * 2;
                const phi = (y / (this.resolution - 1)) * Math.PI * 2;
                
                // Parametric equation for torus with enhancement
                const xPos = (R + r * Math.cos(phi)) * Math.cos(theta);
                const yPos = (R + r * Math.cos(phi)) * Math.sin(theta);
                const zPos = r * Math.sin(phi);
                
                // Set vertex position
                vertices[index++] = xPos;
                vertices[index++] = yPos;
                vertices[index++] = zPos;
            }
        }
        
        return vertices;
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
            
            // Update time with smoother value for more elegant animation
            this.time += 0.015;
            
            // If the current surface is complex, update it with time-based animation
            if (this.currentSurface === 'complex') {
                const vertices = new Float32Array(this.totalVertices * 3);
                this.generateComplexSurface(vertices, this.time);
                this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
                
                // Log time value occasionally to verify it's changing
                if (Math.floor(this.time * 10) % 100 === 0) {
                    console.log("Current time:", this.time);
                }
            }
            
            // Update uniform buffer with time and additional parameters
            this.device.queue.writeBuffer(
                this.uniformBuffer,
                0,
                new Float32Array([0.15, 0.2, 0.05, this.time]) // Add some parameters for enhanced shading
            );
            
            // Safety check for surfaceShaderMap
            if (!this.surfaceShaderMap) {
                console.warn("surfaceShaderMap is not defined in render, using default shader");
                this.initializeSurfaceShaderMap();
            }
            
            // Get the shader type for the current surface
            const shaderType = this.surfaceShaderMap.get(this.currentSurface) || 'default';
            
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