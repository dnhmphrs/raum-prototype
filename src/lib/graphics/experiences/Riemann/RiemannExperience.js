import Experience from '../Experience';

class RiemannExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        console.log("Creating Riemann Experience");
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Store canvas reference on device for easier access
        this.device.canvas = resourceManager.canvas;
        
        // Grid resolution
        this.resolution = 100; // 100x100 grid
        this.totalVertices = this.resolution * this.resolution;
        this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6; // 2 triangles per grid cell
        
        // Animation time
        this.time = 0;
        
        // Current manifold function
        this.currentFunction = 'flat';
        
        // Create vertex and index buffers
        this.createBuffers();
        
        // Create render pipeline
        this.createRenderPipeline();
    }
    
    createBuffers() {
        // Create vertices for the grid
        const vertices = new Float32Array(this.totalVertices * 3); // x, y, z for each vertex
        
        // Generate a flat grid initially
        this.generateVertices(vertices, this.currentFunction);
        
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
    
    generateVertices(vertices, functionType) {
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = (y * this.resolution + x) * 3;
                
                // Normalize coordinates to [-1, 1]
                const nx = (x / (this.resolution - 1)) * 2 - 1;
                const ny = (y / (this.resolution - 1)) * 2 - 1;
                
                // Default x,y coordinates (will be overridden for some surfaces)
                vertices[index] = nx;
                vertices[index + 1] = ny;
                
                // Calculate z based on the selected function
                switch (functionType) {
                    case 'flat':
                        // Completely flat surface
                        vertices[index + 2] = 0;
                        break;
                        
                    case 'sine':
                        // More pronounced sine wave
                        vertices[index + 2] = Math.sin(nx * 5) * Math.cos(ny * 5) * 0.4;
                        break;
                        
                    case 'ripple':
                        // Concentric ripples
                        const d = Math.sqrt(nx * nx + ny * ny);
                        vertices[index + 2] = Math.sin(d * 15) * 0.2 * (1 - d * 0.5);
                        break;
                        
                    case 'saddle':
                        // More pronounced saddle
                        vertices[index + 2] = (nx * nx - ny * ny) * 0.5;
                        break;
                        
                    case 'gaussian':
                        // Taller gaussian bell
                        const exponent = -(nx * nx + ny * ny) * 5;
                        vertices[index + 2] = Math.exp(exponent) * 0.8;
                        break;
                        
                    case 'complex':
                        // Complex function visualization: |sin(z)|
                        const re = nx * 3; // Real part
                        const im = ny * 3; // Imaginary part
                        
                        // Calculate |sin(z)| = |sin(re + i*im)|
                        const sinRe = Math.sin(re);
                        const cosRe = Math.cos(re);
                        const sinhIm = Math.sinh(im);
                        const coshIm = Math.cosh(im);
                        
                        const magnitude = Math.sqrt(
                            sinRe * sinRe * coshIm * coshIm + 
                            cosRe * cosRe * sinhIm * sinhIm
                        );
                        
                        vertices[index + 2] = magnitude * 0.3;
                        break;
                        
                    case 'mobius':
                        // Möbius strip - completely different parametrization
                        const radius = Math.sqrt(nx * nx + ny * ny);
                        
                        if (radius < 0.2 || radius > 0.8) {
                            // Skip center and outer edge for cleaner look
                            vertices[index] = nx * 0.01; // Nearly zero
                            vertices[index + 1] = ny * 0.01;
                            vertices[index + 2] = 0;
                        } else {
                            // Normalize radius to [0, 1]
                            const normR = (radius - 0.2) / 0.6;
                            // Calculate angle
                            const theta = Math.atan2(ny, nx);
                            // Width of the strip
                            const width = 0.3;
                            // Parametric equation of Möbius strip
                            const u = (normR - 0.5) * 2; // [-1, 1]
                            const v = theta; // [0, 2π]
                            
                            // Completely replace the coordinates
                            vertices[index] = (1 + u * 0.5 * Math.cos(v * 0.5)) * Math.cos(v) * 0.5;
                            vertices[index + 1] = (1 + u * 0.5 * Math.cos(v * 0.5)) * Math.sin(v) * 0.5;
                            vertices[index + 2] = u * 0.5 * Math.sin(v * 0.5) * 0.5;
                        }
                        break;
                        
                    case 'torus':
                        // Torus - completely different parametrization
                        const majorRadius = 0.6; // Major radius
                        const minorRadius = 0.2; // Minor radius
                        
                        // Convert to angles
                        const theta = nx * Math.PI; // [-π, π]
                        const phi = ny * Math.PI * 2; // [-2π, 2π]
                        
                        // Parametric equation of torus
                        vertices[index] = (majorRadius + minorRadius * Math.cos(phi)) * Math.cos(theta);
                        vertices[index + 1] = (majorRadius + minorRadius * Math.cos(phi)) * Math.sin(theta);
                        vertices[index + 2] = minorRadius * Math.sin(phi);
                        break;
                        
                    default:
                        vertices[index + 2] = 0;
                }
            }
        }
        
        console.log(`Generated vertices for ${functionType} surface`);
    }
    
    createRenderPipeline() {
        // Create shader module
        const shaderModule = this.device.createShaderModule({
            label: "Riemann Shader",
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec3<f32>,
                    @location(1) normal: vec3<f32>
                };
                
                struct Uniforms {
                    unused: vec3<f32>,
                    time: f32,
                }
                
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Fixed viewing angle - top-down with slight tilt
                    var pos = position;
                    
                    // Scale and position with a fixed viewing angle
                    // Use a simple projection that keeps surfaces visible
                    output.position = vec4<f32>(
                        pos.x * 0.8,                // Scale X
                        pos.y * 0.8 - pos.z * 0.3,  // Scale Y with Z influence for tilt
                        pos.z * 0.5,                // Scale Z (depth)
                        1.0                         // W component
                    );
                    
                    // Calculate normal (approximate)
                    var normal = vec3<f32>(0.0, 0.0, 1.0);
                    
                    // Better normal approximation based on position
                    if (abs(position.z) > 0.01) {
                        // For non-flat surfaces, estimate normal based on z gradient
                        normal = normalize(vec3<f32>(
                            -position.z * sign(position.x) * 2.0,
                            -position.z * sign(position.y) * 2.0,
                            1.0
                        ));
                    }
                    
                    output.normal = normal;
                    
                    // Color based on position and function
                    // Use time only for subtle color changes
                    let colorTime = uniforms.time * 0.1;
                    
                    // Base color from position
                    let baseColor = vec3<f32>(
                        0.5 + 0.5 * sin(position.x * 2.0 + colorTime),
                        0.5 + 0.5 * cos(position.y * 2.0 + colorTime),
                        0.5 + 0.5 * abs(position.z * 3.0)
                    );
                    
                    output.color = baseColor;
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(
                    @location(0) color: vec3<f32>,
                    @location(1) normal: vec3<f32>
                ) -> @location(0) vec4<f32> {
                    // Enhanced lighting
                    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
                    let diffuse = max(dot(normal, light_dir), 0.0);
                    let ambient = 0.3;
                    let specular = pow(max(dot(reflect(-light_dir, normal), vec3<f32>(0.0, 0.0, 1.0)), 0.0), 32.0) * 0.3;
                    let lighting = ambient + diffuse * 0.6 + specular;
                    
                    return vec4<f32>(color * lighting, 1.0);
                }
            `
        });
        
        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 3 unused floats + 1 float for time
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Riemann Uniforms Buffer'
        });
        
        // Create pipeline
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
                topology: 'triangle-list',
                cullMode: 'back'
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
        console.log("Initializing Riemann Experience");
        return true;
    }
    
    updateSurface(functionType) {
        console.log(`Updating surface to: ${functionType}`);
        this.currentFunction = functionType;
        
        // Create new vertices
        const vertices = new Float32Array(this.totalVertices * 3);
        this.generateVertices(vertices, functionType);
        
        // Update vertex buffer
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    }
    
    render(commandEncoder, textureView) {
        // Update time (for subtle color animation only)
        this.time += 0.01;
        
        // Update uniform buffer with time only
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([
                0, 0, 0, // Unused values
                this.time
            ])
        );
        
        // Create render pass descriptor
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
        
        // Begin render pass
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
        passEncoder.drawIndexed(this.totalIndices);
        passEncoder.end();
    }
    
    cleanup() {
        console.log("Cleaning up Riemann Experience");
    }
    
    getCamera() {
        return null; // No camera needed for this implementation
    }
}

export default RiemannExperience; 