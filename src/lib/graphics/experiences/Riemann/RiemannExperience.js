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
        
        // Current surface type - set KP as default
        this.currentSurface = 'kp';
        
        // Animation time
        this.time = 0;
        
        // Map of surface types to shader types
        this.surfaceShaderMap = {
            'flat': 'default',
            'sine': 'sine',         // Use dedicated sine shader
            'ripple': 'ripple',     // Use dedicated ripple shader
            'complex': 'complex',   // Use dedicated complex shader
            'kp': 'kp',             // Use dedicated KP shader
            'torus': 'torus'        // Use dedicated torus shader
        };
        
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
    
    // For compatibility with the original code
    changeManifold(surfaceType) {
        return this.updateSurface(surfaceType);
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
        
        // For shader-based surfaces, just switch the shader
        if (this.surfaceShaderMap[surfaceType]) {
            const shaderType = this.surfaceShaderMap[surfaceType];
            
            // If this surface uses a dedicated shader, switch to it
            if (shaderType !== 'default') {
                console.log(`Switching to ${shaderType} shader for ${surfaceType} surface`);
                this.pipeline.setShaderType(shaderType);
                return;
            }
        }
        
        // For CPU-based surfaces, update the vertex buffer
        const vertices = new Float32Array(this.totalVertices * 3);
        
        // Generate the new surface
        this.generateSurface(vertices, surfaceType);
        
        // Update vertex buffer with new vertices
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        
        // Switch back to default shader if needed
        this.pipeline.setShaderType('default');
        
        console.log(`Surface updated to ${surfaceType}`);
    }
    
    // Generate different surface types
    generateSurface(vertices, surfaceType) {
        console.log(`Generating surface: ${surfaceType}`);
        
        // Safety check for surfaceShaderMap
        if (!this.surfaceShaderMap) {
            console.warn("surfaceShaderMap is not defined, initializing with defaults");
            this.surfaceShaderMap = {
                'flat': 'default',
                'sine': 'default',
                'ripple': 'default',
                'complex': 'default',
                'kp': 'kp',
                'torus': 'default'
            };
        }
        
        // For shader-based surfaces, just create a flat grid
        if (this.surfaceShaderMap[surfaceType] && this.surfaceShaderMap[surfaceType] !== 'default') {
            console.log(`Using shader for ${surfaceType}, generating flat grid`);
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
            return;
        }
        
        // For CPU-based surfaces, generate the geometry
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = (y * this.resolution + x) * 3;
                
                // Map grid coordinates to [-2, 2] range - CENTERED EXACTLY
                const xPos = (x / (this.resolution - 1)) * 4 - 2;
                const yPos = (y / (this.resolution - 1)) * 4 - 2;
                
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
                        
                    case 'complex':
                        // Complex function visualization
                        const r = Math.sqrt(xPos * xPos + yPos * yPos) + 0.01;
                        const theta = Math.atan2(yPos, xPos);
                        vertices[index + 2] = Math.sin(r * 5) * Math.cos(theta * 3) * 0.5;
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
            
            // Set camera position for better viewing - ADJUSTED FOR CENTERING
            if (this.resourceManager && this.resourceManager.camera) {
                // Position camera directly above the center of the grid
                this.resourceManager.camera.position = [0, 0, 5];
                
                // Look directly at the center of the grid (0,0,0)
                this.resourceManager.camera.target = [0, 0, 0];
                this.resourceManager.camera.updateView();
                
                // Set up camera controller if available
                if (this.resourceManager.cameraController) {
                    // Set the target to the center of the grid
                    this.resourceManager.cameraController.target = [0, 0, 0];
                    
                    // Adjust distance for better viewing
                    this.resourceManager.cameraController.baseDistance = 5.0;
                    this.resourceManager.cameraController.distance = 5.0;
                    
                    // Set initial angles for a top-down view with slight perspective
                    this.resourceManager.cameraController.theta = Math.PI / 4; // 45 degrees
                    this.resourceManager.cameraController.phi = Math.PI / 4;   // 45 degrees
                    
                    // Update camera position based on these settings
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
            
            // Safety check for surfaceShaderMap
            if (!this.surfaceShaderMap) {
                console.warn("surfaceShaderMap is not defined in render, using default shader");
                this.surfaceShaderMap = {
                    'flat': 'default',
                    'sine': 'default',
                    'ripple': 'default',
                    'complex': 'default',
                    'kp': 'kp',
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
        if (this.pipeline) {
            this.pipeline.cleanup();
        }
    }
}

export default RiemannExperience; 