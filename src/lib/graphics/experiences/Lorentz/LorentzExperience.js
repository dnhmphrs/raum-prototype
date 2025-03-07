import Experience from '../Experience';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Lorentz Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Lorentz parameters - exposed for UI control
        this.params = {
            sigma: 10.0,
            rho: 28.0,
            beta: 8/3,
            dt: 0.0006,
            lineWidth: 1.0,
            rotationSpeed: 0.002
        };
        
        // Number of points - increased for smoother curves
        this.numPoints = 100000; // Match the Three.js version's point count
        
        // Points array to store the attractor trajectory
        this.points = new Float32Array(this.numPoints * 3);
        
        // Camera parameters
        this.camera = {
            position: { x: 0, y: 0, z: 20 }, // Move camera further back
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
            isDragging: false,
            lastMousePosition: { x: 0, y: 0 }
        };
        
        // Generate initial points
        this.generateInitialPoints();
        
        // Create vertex buffer for the attractor
        this.createVertexBuffer();
        
        // Create a simple render pipeline
        this.createRenderPipeline();
        
        // Animation parameters
        this.time = 0;
        
        // Set up mouse controls
        this.setupMouseControls();
    }
    
    setupMouseControls() {
        // Get the canvas from the resource manager
        const canvas = this.resourceManager.canvas;
        if (!canvas) {
            console.warn("Canvas not available for mouse controls");
            return;
        }
        
        // Mouse down event
        canvas.addEventListener('mousedown', (event) => {
            this.camera.isDragging = true;
            this.camera.lastMousePosition = { x: event.clientX, y: event.clientY };
        });
        
        // Mouse move event
        canvas.addEventListener('mousemove', (event) => {
            if (this.camera.isDragging) {
                const deltaX = event.clientX - this.camera.lastMousePosition.x;
                const deltaY = event.clientY - this.camera.lastMousePosition.y;
                
                // Update camera rotation based on mouse movement
                this.camera.rotation.y += deltaX * 0.01;
                this.camera.rotation.x += deltaY * 0.01;
                
                // Limit vertical rotation to avoid flipping
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
                
                this.camera.lastMousePosition = { x: event.clientX, y: event.clientY };
            }
        });
        
        // Mouse up event
        canvas.addEventListener('mouseup', () => {
            this.camera.isDragging = false;
        });
        
        // Mouse leave event
        canvas.addEventListener('mouseleave', () => {
            this.camera.isDragging = false;
        });
        
        // Mouse wheel event for zoom
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            // Adjust camera zoom
            this.camera.position.z += event.deltaY * 0.05;
            // Limit zoom range
            this.camera.position.z = Math.max(5, Math.min(50, this.camera.position.z));
        });
    }
    
    generateInitialPoints() {
        // Generate the initial Lorentz attractor points using the same approach as Three.js
        let x = 0.01, y = 0.01, z = 0.01;
        let a = 4.9;
        let b = 5.4;
        let f = 6.9;
        let g = 1;
        let t = 0.0006;
        
        for (let i = 0; i < this.numPoints; i++) {
            x = x - t * a * x + t * y * y - t * z * z + t * a * f;
            y = y - t * y + t * x * y - t * b * x * z + t * g;
            z = z - t * z + t * b * x * y + t * x * z;
            
            // Store the point with the same scaling as Three.js
            this.points[i * 3] = x * 2;
            this.points[i * 3 + 1] = y * 2;
            this.points[i * 3 + 2] = z * 2;
        }
    }
    
    createVertexBuffer() {
        // Create a buffer for the attractor points
        this.vertexBuffer = this.device.createBuffer({
            size: this.numPoints * 12, // 3 floats per vertex, 4 bytes per float
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Attractor Buffer'
        });
        
        // Update the buffer with initial points
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    updatePoints() {
        // Update the points using the same approach as Three.js
        // Using random variations for a, b, f, g to create the spiral effect
        let a = 0.9 + Math.random() * 7;
        let b = 3.4 + Math.random() * 8;
        let f = 9.9 + Math.random() * 9;
        let g = 1 + Math.random();
        let t = 0.0001;
        
        for (let i = 0; i < this.numPoints; i++) {
            const x = this.points[i * 3];
            const y = this.points[i * 3 + 1];
            const z = this.points[i * 3 + 2];
            
            this.points[i * 3] = x - t * a * x + t * y * y - t * z * z + t * a * f;
            this.points[i * 3 + 1] = y - t * y + t * x * y - t * b * x * z + t * g;
            this.points[i * 3 + 2] = z - t * z + t * b * x * y + t * x * z;
        }
        
        // Update the buffer
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    createRenderPipeline() {
        // Create a simplified shader module for the Lorentz attractor
        const shaderModule = this.device.createShaderModule({
            label: "Lorentz Attractor Shader",
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec3<f32>
                };
                
                struct Camera {
                    rotation: vec3<f32>,
                    padding1: f32,
                    position: vec3<f32>,
                    time: f32,
                    pointSize: f32,
                    padding2: vec3<f32>,
                }
                
                @group(0) @binding(0) var<uniform> camera: Camera;
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Apply camera rotation
                    let rx = camera.rotation.x;
                    let ry = camera.rotation.y;
                    let rz = camera.rotation.z;
                    
                    // Rotate around X axis
                    var pos = position;
                    let y1 = pos.y * cos(rx) - pos.z * sin(rx);
                    let z1 = pos.y * sin(rx) + pos.z * cos(rx);
                    pos.y = y1;
                    pos.z = z1;
                    
                    // Rotate around Y axis
                    let x2 = pos.x * cos(ry) + pos.z * sin(ry);
                    let z2 = -pos.x * sin(ry) + pos.z * cos(ry);
                    pos.x = x2;
                    pos.z = z2;
                    
                    // Rotate around Z axis
                    let x3 = pos.x * cos(rz) - pos.y * sin(rz);
                    let y3 = pos.x * sin(rz) + pos.y * cos(rz);
                    pos.x = x3;
                    pos.y = y3;
                    
                    // Apply camera position
                    pos.z -= camera.position.z;
                    
                    // Scale and position - reduced scale to avoid clipping
                    let scale = 0.005;
                    
                    // Apply perspective projection
                    let perspective = 1.0 / max(1.0, -pos.z * 0.05);
                    
                    output.position = vec4<f32>(
                        pos.x * scale * perspective, 
                        pos.y * scale * perspective, 
                        pos.z * 0.001, // Very small z value to avoid z-fighting
                        1.0
                    );
                    
                    // Use a simple white color with slight blue tint like Three.js
                    // Add depth-based coloring for better 3D perception
                    let depth = clamp((pos.z + 50.0) / 100.0, 0.0, 1.0);
                    output.color = vec3<f32>(
                        0.7 + depth * 0.3,
                        0.7 + depth * 0.3,
                        0.9 + depth * 0.1
                    );
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                    // Add transparency and additive blending like Three.js
                    return vec4<f32>(color, 0.5);
                }
            `
        });
        
        // Create uniform buffer for camera - increased size to match shader requirements
        this.uniformBuffer = this.device.createBuffer({
            size: 64, // 16 floats (4 bytes each) to match the 64-byte requirement
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Camera Buffer'
        });
        
        // Create the pipeline with simplified settings
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 12, // 3 floats, 4 bytes each
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3'
                    }]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one',  // Additive blending like Three.js
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'point-list',  // Use points like Three.js
                cullMode: 'none'
            }
        });
        
        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer
                }
            }]
        });
    }
    
    async initialize() {
        console.log("Initializing Lorentz Experience");
        return true;
    }
    
    // Method to update parameters from UI
    updateParameters(params) {
        // Update parameters
        if (params.sigma !== undefined) this.params.sigma = params.sigma;
        if (params.rho !== undefined) this.params.rho = params.rho;
        if (params.beta !== undefined) this.params.beta = params.beta;
        if (params.dt !== undefined) this.params.dt = params.dt;
        if (params.lineWidth !== undefined) this.params.lineWidth = params.lineWidth;
        if (params.rotationSpeed !== undefined) this.params.rotationSpeed = params.rotationSpeed;
        
        // Regenerate points with new parameters
        this.generateInitialPoints();
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    render(commandEncoder, textureView) {
        // Skip rendering if no valid texture view
        if (!textureView) {
            return;
        }
        
        // Update time
        this.time += 0.01;
        
        // Apply auto-rotation if not being controlled by mouse
        if (!this.camera.isDragging) {
            this.camera.rotation.y += this.params.rotationSpeed;
            this.camera.rotation.x += this.params.rotationSpeed * 0.5;
        }
        
        // Update uniform buffer with camera data - include padding to match 64 bytes
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([
                this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z, 0, // rotation + padding1
                this.camera.position.x, this.camera.position.y, this.camera.position.z, this.time, // position + time
                this.params.lineWidth, 0, 0, 0, // pointSize + padding2
                0, 0, 0, 0  // Additional padding to reach 64 bytes
            ])
        );
        
        // Update points on every frame like Three.js
        this.updatePoints();
        
        // Create a render pass
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
        
        // Begin the render pass
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.numPoints);
        passEncoder.end();
    }
    
    cleanup() {
        console.log("Cleaning up Lorentz Experience");
        
        // Remove event listeners
        const canvas = this.resourceManager.canvas;
        if (canvas) {
            // Clone and replace the canvas to remove all event listeners
            const newCanvas = canvas.cloneNode(true);
            if (canvas.parentNode) {
                canvas.parentNode.replaceChild(newCanvas, canvas);
            }
        }
        
        // Explicitly null out references to help garbage collection
        this.points = null;
        this.vertexBuffer = null;
        this.uniformBuffer = null;
        this.renderPipeline = null;
        this.bindGroup = null;
    }
    
    getCamera() {
        return this.camera;
    }
}

export default LorentzExperience; 