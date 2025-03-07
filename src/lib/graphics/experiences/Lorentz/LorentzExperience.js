import Experience from '../Experience';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Lorentz Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Classic Lorenz parameters for the butterfly shape
        this.params = {
            sigma: 10.0,
            rho: 28.0,
            beta: 8.0/3.0,
            dt: 0.004,
            rotationSpeed: 0.002
        };
        
        // Number of points
        this.numPoints = 100000;
        
        // Points array
        this.points = new Float32Array(this.numPoints * 3);
        
        // Camera parameters
        this.camera = {
            position: { x: 0, y: 0, z: 20 },
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
            isDragging: false,
            lastMousePosition: { x: 0, y: 0 }
        };
        
        // Animation time
        this.time = 0;
        
        // Generate initial points
        this.generateInitialPoints();
        
        // Create vertex buffer
        this.createVertexBuffer();
        
        // Create render pipeline
        this.createRenderPipeline();
        
        // Set up mouse controls
        this.setupMouseControls();
    }
    
    setupMouseControls() {
        const canvas = this.resourceManager.canvas;
        if (!canvas) return;
        
        canvas.addEventListener('mousedown', (event) => {
            this.camera.isDragging = true;
            this.camera.lastMousePosition = { x: event.clientX, y: event.clientY };
        });
        
        canvas.addEventListener('mousemove', (event) => {
            if (this.camera.isDragging) {
                const deltaX = event.clientX - this.camera.lastMousePosition.x;
                const deltaY = event.clientY - this.camera.lastMousePosition.y;
                
                this.camera.rotation.y += deltaX * 0.01;
                this.camera.rotation.x += deltaY * 0.01;
                
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
                
                this.camera.lastMousePosition = { x: event.clientX, y: event.clientY };
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.camera.isDragging = false;
        });
        
        canvas.addEventListener('mouseleave', () => {
            this.camera.isDragging = false;
        });
        
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.camera.position.z += event.deltaY * 0.05;
            this.camera.position.z = Math.max(5, Math.min(50, this.camera.position.z));
        });
    }
    
    generateInitialPoints() {
        // Use classic Lorenz parameters for the butterfly shape
        let x = 0.1, y = 0.1, z = 0.1;
        const sigma = this.params.sigma;
        const rho = this.params.rho;
        const beta = this.params.beta;
        const dt = this.params.dt;
        
        for (let i = 0; i < this.numPoints; i++) {
            // Classic Lorenz equations
            const dx = sigma * (y - x);
            const dy = x * (rho - z) - y;
            const dz = x * y - beta * z;
            
            x += dx * dt;
            y += dy * dt;
            z += dz * dt;
            
            // Scale the points to get a good size
            this.points[i * 3] = x * 0.2;
            this.points[i * 3 + 1] = y * 0.2;
            this.points[i * 3 + 2] = z * 0.2;
        }
    }
    
    createVertexBuffer() {
        this.vertexBuffer = this.device.createBuffer({
            size: this.numPoints * 12,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Attractor Buffer'
        });
        
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    updatePoints() {
        // Use classic Lorenz parameters with tiny variations for natural movement
        const sigma = this.params.sigma * (1 + Math.random() * 0.01);
        const rho = this.params.rho * (1 + Math.random() * 0.01);
        const beta = this.params.beta * (1 + Math.random() * 0.01);
        const dt = this.params.dt;
        
        for (let i = 0; i < this.numPoints; i++) {
            const x = this.points[i * 3];
            const y = this.points[i * 3 + 1];
            const z = this.points[i * 3 + 2];
            
            // Classic Lorenz equations
            const dx = sigma * (y - x);
            const dy = x * (rho - z) - y;
            const dz = x * y - beta * z;
            
            this.points[i * 3] = x + dx * dt;
            this.points[i * 3 + 1] = y + dy * dt;
            this.points[i * 3 + 2] = z + dz * dt;
        }
        
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    createRenderPipeline() {
        // Simple shader for the Lorentz attractor
        const shaderModule = this.device.createShaderModule({
            label: "Lorentz Shader",
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec3<f32>,
                };
                
                struct Uniforms {
                    viewMatrix: mat4x4<f32>,
                    time: f32,
                }
                
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Apply view matrix
                    let pos = uniforms.viewMatrix * vec4<f32>(position, 1.0);
                    
                    // Better perspective calculation with adjusted scale
                    let scale = 0.08; // Larger scale to see the butterfly better
                    let z_dist = max(0.1, abs(pos.z));
                    let perspective = 1.0 / z_dist;
                    
                    // Map to normalized device coordinates with better depth handling
                    output.position = vec4<f32>(
                        pos.x * scale,
                        pos.y * scale,
                        pos.z * 0.01 + 0.5, // Better depth scaling
                        1.0
                    );
                    
                    // Color based on position with more vibrant colors
                    let t = fract(atan2(position.y, position.x) / 6.28318 + 0.5);
                    let height = (position.z + 30.0) / 60.0;
                    
                    // Create a warmer color scheme
                    output.color = vec3<f32>(
                        0.7 + 0.3 * sin(t * 6.28318),
                        0.5 + 0.5 * sin(t * 6.28318 + 2.09),
                        0.3 + 0.7 * height
                    );
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                    // Create a soft glow effect with higher alpha for better visibility
                    return vec4<f32>(color, 0.6);
                }
            `
        });
        
        // Create uniform buffer for view matrix and time
        this.uniformBuffer = this.device.createBuffer({
            size: 80, // mat4x4 (64 bytes) + time (4 bytes) + padding (12 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Uniforms'
        });
        
        // Create pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 12,
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
                            dstFactor: 'one',  // Additive blending for glow effect
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
                topology: 'point-list',
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
    
    updateParameters(params) {
        if (params.sigma !== undefined) this.params.sigma = params.sigma;
        if (params.rho !== undefined) this.params.rho = params.rho;
        if (params.beta !== undefined) this.params.beta = params.beta;
        if (params.dt !== undefined) this.params.dt = params.dt;
        if (params.rotationSpeed !== undefined) this.params.rotationSpeed = params.rotationSpeed;
        
        this.generateInitialPoints();
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    createViewMatrix() {
        // Create a simple view matrix from camera rotation and position
        const cx = Math.cos(this.camera.rotation.x);
        const sx = Math.sin(this.camera.rotation.x);
        const cy = Math.cos(this.camera.rotation.y);
        const sy = Math.sin(this.camera.rotation.y);
        const cz = Math.cos(this.camera.rotation.z);
        const sz = Math.sin(this.camera.rotation.z);
        
        // Create rotation matrix
        const m = new Float32Array(16);
        
        // Combined rotation matrix (X, Y, Z order)
        m[0] = cy * cz;
        m[1] = cy * sz;
        m[2] = -sy;
        m[3] = 0;
        
        m[4] = sx * sy * cz - cx * sz;
        m[5] = sx * sy * sz + cx * cz;
        m[6] = sx * cy;
        m[7] = 0;
        
        m[8] = cx * sy * cz + sx * sz;
        m[9] = cx * sy * sz - sx * cz;
        m[10] = cx * cy;
        m[11] = 0;
        
        // Translation - move further back to avoid clipping
        m[12] = 0;
        m[13] = 0;
        m[14] = -this.camera.position.z - 5.0; // Add extra distance to avoid clipping
        m[15] = 1;
        
        return m;
    }
    
    render(commandEncoder, textureView) {
        if (!textureView) return;
        
        // Update time
        this.time += 0.01;
        
        // Apply auto-rotation if not being controlled by mouse
        if (!this.camera.isDragging) {
            this.camera.rotation.y += this.params.rotationSpeed;
            this.camera.rotation.x += this.params.rotationSpeed * 0.5;
        }
        
        // Create view matrix
        const viewMatrix = this.createViewMatrix();
        
        // Update uniform buffer
        const uniformData = new Float32Array(20); // 16 for matrix + 1 for time + 3 padding
        uniformData.set(viewMatrix, 0);
        uniformData[16] = this.time;
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        
        // Update points
        this.updatePoints();
        
        // Create render pass
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
        
        // Render
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
            const newCanvas = canvas.cloneNode(true);
            if (canvas.parentNode) {
                canvas.parentNode.replaceChild(newCanvas, canvas);
            }
        }
        
        // Clear references
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