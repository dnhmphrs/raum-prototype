import Experience from '../Experience';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Lorentz Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Lorentz parameters
        this.sigma = 10;
        this.rho = 28;
        this.beta = 8/3;
        this.dt = 0.0006; // Smaller time step for smoother curves
        
        // Number of points to render
        this.numPoints = 10000;
        
        // Points array to store the attractor trajectory
        this.points = new Float32Array(this.numPoints * 3);
        
        // Generate initial points
        this.generateInitialPoints();
        
        // Create vertex buffer for the attractor
        this.createVertexBuffer();
        
        // Create a simple render pipeline
        this.createRenderPipeline();
        
        // Animation parameters
        this.time = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
    }
    
    generateInitialPoints() {
        // Generate the initial Lorentz attractor points
        let x = 0.01, y = 0.01, z = 0.01;
        
        for (let i = 0; i < this.numPoints; i++) {
            // Lorentz equations (similar to the Three.js implementation)
            x = x - this.dt * this.sigma * x + this.dt * y * y - this.dt * z * z + this.dt * this.sigma * this.rho;
            y = y - this.dt * y + this.dt * x * y - this.dt * this.beta * x * z + this.dt;
            z = z - this.dt * z + this.dt * this.beta * x * y + this.dt * x * z;
            
            // Store the point
            this.points[i * 3] = x * 2;     // Scale for visibility
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
        // Update the points with a small perturbation (similar to Three.js)
        const a = 0.9 + Math.random() * 0.2;
        const b = 3.4 + Math.random() * 0.2;
        const f = 9.9 + Math.random() * 0.2;
        const g = 1 + Math.random() * 0.05;
        const t = 0.0001;
        
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
        // Create a shader module for the Lorentz attractor
        const shaderModule = this.device.createShaderModule({
            label: "Lorentz Attractor Shader",
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec3<f32>
                };
                
                struct Uniforms {
                    rotation: vec3<f32>,
                    time: f32,
                }
                
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Apply rotation (similar to Three.js)
                    let rx = uniforms.rotation.x;
                    let ry = uniforms.rotation.y;
                    let rz = uniforms.rotation.z;
                    
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
                    
                    // Scale and position
                    let scale = 0.015;
                    output.position = vec4<f32>(pos.x * scale, pos.y * scale, pos.z * scale, 1.0);
                    
                    // Color based on position (more vibrant)
                    output.color = vec3<f32>(
                        0.5 + 0.5 * sin(position.x * 0.1 + uniforms.time),
                        0.5 + 0.5 * cos(position.y * 0.1 + uniforms.time),
                        0.7 + 0.3 * sin(position.z * 0.1 + uniforms.time)
                    );
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                    return vec4<f32>(color, 1.0);
                }
            `
        });
        
        // Create uniform buffer for rotation and time
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 3 floats for rotation + 1 float for time
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Uniforms Buffer'
        });
        
        // Create the pipeline
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
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'line-strip',
                // Add line width if supported
                stripIndexFormat: 'uint32'
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
    
    render(commandEncoder, textureView) {
        // Update time and rotation
        this.time += 0.01;
        this.rotationX += 0.002;
        this.rotationY += 0.002;
        this.rotationZ += 0.002;
        
        // Update uniform buffer
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([
                this.rotationX,
                this.rotationY,
                this.rotationZ,
                this.time
            ])
        );
        
        // Update points occasionally (not every frame to avoid performance issues)
        if (Math.random() < 0.05) {
            this.updatePoints();
        }
        
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
    
    // Method to reset with new parameters
    resetWithParameters(sigma, rho, beta, dt, initialPoint = [0.01, 0.01, 0.01]) {
        this.sigma = sigma;
        this.rho = rho;
        this.beta = beta;
        this.dt = dt;
        
        // Regenerate points with new parameters
        let x = initialPoint[0], y = initialPoint[1], z = initialPoint[2];
        
        for (let i = 0; i < this.numPoints; i++) {
            // Lorentz equations
            x = x - this.dt * this.sigma * x + this.dt * y * y - this.dt * z * z + this.dt * this.sigma * this.rho;
            y = y - this.dt * y + this.dt * x * y - this.dt * this.beta * x * z + this.dt;
            z = z - this.dt * z + this.dt * this.beta * x * y + this.dt * x * z;
            
            // Store the point
            this.points[i * 3] = x * 2;
            this.points[i * 3 + 1] = y * 2;
            this.points[i * 3 + 2] = z * 2;
        }
        
        // Update the buffer
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    cleanup() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
        }
        if (this.uniformBuffer) {
            this.uniformBuffer.destroy();
        }
    }
    
    getCamera() {
        return null; // No camera needed for this implementation
    }
}

export default LorentzExperience; 