import Experience from '../Experience';
import RiemannPipeline from './RiemannPipeline.js';

class RiemannExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Riemann Experience with multiple surface types");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Register this experience with the resource manager
        if (this.resourceManager) {
            if (!this.resourceManager.experiences) {
                this.resourceManager.experiences = {};
            }
            this.resourceManager.experiences.riemann = this;
        }
        
        // Grid resolution
        this.resolution = 100; // 100x100 grid
        this.totalVertices = this.resolution * this.resolution;
        this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6; // 2 triangles per grid cell
        
        // Current surface type
        this.currentSurface = 'flat';
        
        // Animation time
        this.time = 0;
        
        // Create vertex and index buffers
        this.createBuffers();
        
        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 3 unused floats + 1 float for time
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Riemann Uniforms Buffer'
        });
        
        // Expose this experience globally
        if (typeof window !== 'undefined') {
            window.riemannExperience = this;
            console.log("Exposed RiemannExperience globally as window.riemannExperience");
        }
    }
    
    createBuffers() {
        // Create vertices for the grid
        const vertices = new Float32Array(this.totalVertices * 3); // x, y, z for each vertex
        
        // Generate a flat grid initially
        this.generateSurface(vertices, 'flat');
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Riemann Vertex Buffer'
        });
        
        // Upload vertices to GPU
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        
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
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            label: 'Riemann Index Buffer'
        });
        
        // Upload indices to GPU
        this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
    }
    
    // Method to update the surface based on the selected type
    updateSurface(surfaceType) {
        console.log(`Updating surface to: ${surfaceType}`);
        
        // Skip if same surface type
        if (surfaceType === this.currentSurface) {
            console.log(`Surface already set to ${surfaceType}`);
            return;
        }
        
        // Update current surface type
        this.currentSurface = surfaceType;
        
        // Create new vertices
        const vertices = new Float32Array(this.totalVertices * 3);
        
        // Generate the new surface
        this.generateSurface(vertices, surfaceType);
        
        // Update vertex buffer with new vertices
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        
        console.log(`Surface updated to ${surfaceType}`);
    }
    
    // Generate different surface types
    generateSurface(vertices, surfaceType) {
        console.log(`Generating surface: ${surfaceType}`);
        
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = (y * this.resolution + x) * 3;
                
                // Map grid coordinates to [-2, 2] range
                const xPos = ((x / (this.resolution - 1)) * 4 - 2);
                const yPos = ((y / (this.resolution - 1)) * 4 - 2);
                
                // Set vertex position based on surface type
                vertices[index] = xPos;     // x
                vertices[index + 1] = yPos; // y
                
                // Calculate z based on surface type
                switch (surfaceType) {
                    case 'flat':
                        // Flat surface (z = 0)
                        vertices[index + 2] = 0;
                        break;
                        
                    case 'sine':
                        // Sine wave
                        vertices[index + 2] = Math.sin(xPos * 2) * 0.5;
                        break;
                        
                    case 'ripple':
                        // Ripple (radial sine wave)
                        const distance = Math.sqrt(xPos * xPos + yPos * yPos);
                        vertices[index + 2] = Math.sin(distance * 5) * 0.2;
                        break;
                        
                    case 'saddle':
                        // Saddle surface (hyperbolic paraboloid)
                        vertices[index + 2] = (xPos * xPos - yPos * yPos) * 0.3;
                        break;
                        
                    case 'gaussian':
                        // Gaussian (bell curve)
                        const gaussRadius = xPos * xPos + yPos * yPos;
                        vertices[index + 2] = Math.exp(-gaussRadius * 2) * 1.5;
                        break;
                        
                    case 'complex':
                        // Complex function visualization
                        const r = Math.sqrt(xPos * xPos + yPos * yPos) + 0.01;
                        const theta = Math.atan2(yPos, xPos);
                        vertices[index + 2] = Math.sin(r * 5) * Math.cos(theta * 3) * 0.5;
                        break;
                        
                    case 'mobius':
                        // Möbius strip approximation
                        const u = xPos * Math.PI; // Parameter along the strip
                        const v = yPos; // Parameter across the strip
                        
                        // Parametric equations for Möbius strip
                        const R = 1.5; // Major radius
                        const w = 0.5; // Width of the strip
                        
                        vertices[index] = (R + v * Math.cos(u/2)) * Math.cos(u);
                        vertices[index + 1] = (R + v * Math.cos(u/2)) * Math.sin(u);
                        vertices[index + 2] = v * Math.sin(u/2);
                        break;
                        
                    case 'torus':
                        // Torus
                        const u2 = xPos * Math.PI; // Angle around the tube
                        const v2 = yPos * Math.PI; // Angle around the torus
                        
                        const torusR = 1.5; // Major radius
                        const torusSmallR = 0.5; // Minor radius
                        
                        vertices[index] = (torusR + torusSmallR * Math.cos(v2)) * Math.cos(u2);
                        vertices[index + 1] = (torusR + torusSmallR * Math.cos(v2)) * Math.sin(u2);
                        vertices[index + 2] = torusSmallR * Math.sin(v2);
                        break;
                        
                    default:
                        // Default to flat
                        vertices[index + 2] = 0;
                }
            }
        }
    }
    
    async initialize() {
        console.log("Initializing Riemann Experience");
        
        try {
            // Create pipeline
            this.pipeline = new RiemannPipeline(this.device, this.resourceManager);
            await this.pipeline.initialize();
            
            // Set camera position for better viewing
            if (this.resourceManager && this.resourceManager.camera) {
                // Position camera to look at the grid from above
                this.resourceManager.camera.position = [0, 0, 5];
                this.resourceManager.camera.updateView();
                
                // Set up camera controller if available
                if (this.resourceManager.cameraController) {
                    this.resourceManager.cameraController.baseDistance = 5.0;
                    this.resourceManager.cameraController.distance = 5.0;
                    this.resourceManager.cameraController.updateCameraPosition();
                }
            }
            
            console.log('Riemann Experience initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Riemann Experience:', error);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        if (!this.pipeline || !textureView) {
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
        if (this.pipeline) {
            this.pipeline.cleanup();
        }
    }
}

export default RiemannExperience; 