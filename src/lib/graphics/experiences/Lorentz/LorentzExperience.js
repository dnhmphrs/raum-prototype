import Experience from '../Experience';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Lorentz Experience - Step 2");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Lorentz parameters
        this.sigma = 10;
        this.rho = 28;
        this.beta = 8/3;
        this.dt = 0.005;
        
        // Current point in the attractor
        this.currentPoint = [0.1, 0, 0]; // Starting point
        
        // Number of points to render
        this.numPoints = 5000;
        
        // Points array to store the attractor trajectory
        this.points = new Float32Array(this.numPoints * 3);
        this.pointIndex = 0;
        
        // Create vertex buffer for the attractor
        this.createVertexBuffer();
        
        // Create a simple render pipeline
        this.createRenderPipeline();
    }
    
    createVertexBuffer() {
        // Create a buffer for the attractor points
        this.vertexBuffer = this.device.createBuffer({
            size: this.numPoints * 12, // 3 floats per vertex, 4 bytes per float
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Attractor Buffer'
        });
        
        // Initialize with zeros
        const emptyPoints = new Float32Array(this.numPoints * 3);
        this.device.queue.writeBuffer(this.vertexBuffer, 0, emptyPoints);
    }
    
    // Calculate the next point in the Lorentz attractor
    calculateNextPoint() {
        const [x, y, z] = this.currentPoint;
        
        // Lorentz equations
        const dx = this.sigma * (y - x);
        const dy = x * (this.rho - z) - y;
        const dz = x * y - this.beta * z;
        
        // Update the current point using Euler integration
        const newX = x + dx * this.dt;
        const newY = y + dy * this.dt;
        const newZ = z + dz * this.dt;
        
        this.currentPoint = [newX, newY, newZ];
        
        // Add the new point to our points array
        this.points[this.pointIndex * 3] = newX;
        this.points[this.pointIndex * 3 + 1] = newY;
        this.points[this.pointIndex * 3 + 2] = newZ;
        
        // Increment the point index and wrap around if needed
        this.pointIndex = (this.pointIndex + 1) % this.numPoints;
    }
    
    // Generate a batch of points
    generatePoints() {
        // Generate a batch of points
        for (let i = 0; i < 10; i++) {
            this.calculateNextPoint();
        }
        
        // Update the vertex buffer with the new points
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
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Scale the attractor to fit the screen better
                    let scale = 0.015;
                    
                    // Center the attractor with aspect ratio correction
                    output.position = vec4<f32>(
                        position.x * scale,
                        position.y * scale,
                        position.z * scale * 0.2, // Flatten slightly but keep some depth
                        1.0
                    );
                    
                    // More vibrant color based on position
                    output.color = vec3<f32>(
                        0.5 + 0.5 * sin(position.x * 0.1),
                        0.5 + 0.5 * cos(position.y * 0.1),
                        0.7 + 0.3 * sin(position.z * 0.1)
                    );
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                    return vec4<f32>(color, 1.0);
                }
            `
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
                topology: 'line-strip'
            }
        });
    }
    
    async initialize() {
        console.log("Initializing Lorentz Experience - Step 2");
        
        // Generate initial points
        for (let i = 0; i < this.numPoints; i++) {
            this.calculateNextPoint();
        }
        
        // Update the buffer with initial points
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
        
        return true;
    }
    
    render(commandEncoder, textureView) {
        // Generate new points for the attractor
        this.generatePoints();
        
        // Create a render pass
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
        
        // Begin the render pass
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.numPoints);
        passEncoder.end();
    }
    
    // Method to reset with new parameters
    resetWithParameters(sigma, rho, beta, dt, initialPoint = [0.1, 0, 0]) {
        this.sigma = sigma;
        this.rho = rho;
        this.beta = beta;
        this.dt = dt;
        this.currentPoint = [...initialPoint];
        
        // Clear the points array
        this.points = new Float32Array(this.numPoints * 3);
        this.pointIndex = 0;
        
        // Generate new points with the updated parameters
        for (let i = 0; i < this.numPoints; i++) {
            this.calculateNextPoint();
        }
        
        // Update the buffer
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    cleanup() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
        }
    }
    
    getCamera() {
        return null; // No camera needed for this simple example
    }
}

export default LorentzExperience; 