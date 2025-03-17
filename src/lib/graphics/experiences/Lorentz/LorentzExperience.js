import Experience from '../Experience';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Classic Lorenz parameters for the butterfly shape
        this.params = {
            sigma: 10.0,
            rho: 28.0,
            beta: 8.0/3.0,
            dt: 0.0005,
            rotationSpeed: 0.002
        };
        
        // Number of points
        this.numPoints = 100000;
        
        // Points array
        this.points = new Float32Array(this.numPoints * 3);
        
        // Animation time
        this.time = 0;
        
        // Update counter to reduce frequency of point updates
        this.updateCounter = 0;
        
        // Generate initial points
        this.generateInitialPoints();
        
        // Create vertex buffer
        this.createVertexBuffer();
    }
    
    async initialize() {
        // Check if we have a resource manager
        if (!this.resourceManager) {
            return false;
        }

        // Position camera to see the attractor
        if (this.resourceManager.camera) {
            this.resourceManager.camera.position = [0, 0, 100];
            this.resourceManager.camera.updateView();
            this.resourceManager.camera.updateProjection(Math.PI / 4, 0.1, 1000);
        }

        // Create render pipeline first (doesn't need canvas)
        this.createRenderPipeline();
        
        // Set up mouse controls - using the resource manager's canvas
        this.setupMouseControls();
        
        return true;
    }
    
    setupMouseControls() {
        const canvas = this.resourceManager.canvas;
        if (!canvas) return;
        
        canvas.addEventListener('mousedown', (event) => {
            if (this.resourceManager.cameraController) {
                this.resourceManager.cameraController.startDrag(event.clientX, event.clientY);
            }
        });
        
        canvas.addEventListener('mousemove', (event) => {
            if (this.resourceManager.cameraController) {
                this.resourceManager.cameraController.handleMouseMove(event.clientX, event.clientY);
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            if (this.resourceManager.cameraController) {
                this.resourceManager.cameraController.endDrag();
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            if (this.resourceManager.cameraController) {
                this.resourceManager.cameraController.endDrag();
            }
        });
        
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            if (this.resourceManager.cameraController) {
                this.resourceManager.cameraController.adjustZoom(event.deltaY);
            }
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
            
            // Store raw values without scaling
            this.points[i * 3] = x;
            this.points[i * 3 + 1] = y;
            this.points[i * 3 + 2] = z;
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
        // Only update every 5 frames to reduce instability
        this.updateCounter++;
        if (this.updateCounter % 5 !== 0) return;

        const sigma = this.params.sigma;
        const rho = this.params.rho;
        const beta = this.params.beta;
        const dt = this.params.dt;
        
        // Keep track of bounds to detect instability
        let maxVal = 0;
        
        for (let i = 0; i < this.numPoints; i++) {
            const x = this.points[i * 3];
            const y = this.points[i * 3 + 1];
            const z = this.points[i * 3 + 2];
            
            // Classic Lorenz equations without any noise
            const dx = sigma * (y - x);
            const dy = x * (rho - z) - y;
            const dz = x * y - beta * z;
            
            // Update with tighter bounds checking
            const newX = x + dx * dt;
            const newY = y + dy * dt;
            const newZ = z + dz * dt;
            
            // Check for instability
            maxVal = Math.max(maxVal, Math.abs(newX), Math.abs(newY), Math.abs(newZ));
            
            // More conservative clamping
            this.points[i * 3] = Math.max(-20, Math.min(20, newX));
            this.points[i * 3 + 1] = Math.max(-20, Math.min(20, newY));
            this.points[i * 3 + 2] = Math.max(-20, Math.min(20, newZ));
        }
        
        // If we detect instability, regenerate the points
        if (maxVal > 20) {
            this.generateInitialPoints();
        }
        
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.points);
    }
    
    createRenderPipeline() {
        const shaderModule = this.device.createShaderModule({
            label: "Lorentz Shader",
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec3<f32>,
                };
                
                struct Uniforms {
                    time: f32,
                    padding: vec3<f32>,
                }
                
                @group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
                @group(0) @binding(1) var<uniform> view: mat4x4<f32>;
                @group(0) @binding(2) var<uniform> uniforms: Uniforms;
                
                @vertex
                fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    
                    // Scale in world space for better visibility
                    let scale = 2.0;
                    let worldPos = vec4<f32>(position * scale, 1.0);
                    let viewPos = view * worldPos;
                    output.position = projection * viewPos;
                    
                    // Simple color based on position
                    output.color = vec3<f32>(
                        0.5 + 0.5 * sin(position.x * 0.1),
                        0.5 + 0.5 * sin(position.y * 0.1),
                        0.5 + 0.5 * sin(position.z * 0.1)
                    );
                    
                    return output;
                }
                
                @fragment
                fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                    return vec4<f32>(color, 1.0);
                }
            `
        });

        // Create explicit bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'Lorentz Bind Group Layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }
            ]
        });

        // Create pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            label: 'Lorentz Pipeline',
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
            }),
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
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'point-list'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Time Uniforms'
        });

        // Create bind group
        const { projectionBuffer, viewBuffer } = this.resourceManager.camera.getBuffers();
        
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: projectionBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: viewBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.uniformBuffer }
                }
            ]
        });
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
    
    render(commandEncoder, textureView) {
        if (!textureView || !this.resourceManager.camera) return;
        
        try {
            // Update time
            this.time += 0.01;
            
            // Update uniform buffer with time
            const uniformData = new Float32Array(4); // time + padding
            uniformData[0] = this.time;
            
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
                }],
                depthStencilAttachment: {
                    view: this.resourceManager.getDepthTextureView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            };
            
            // Render
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.vertexBuffer);
            passEncoder.draw(this.numPoints);
            passEncoder.end();
        } catch (error) {
            console.error('Error in Lorentz render:', error);
        }
    }
    
    cleanup() {
        // Remove event listeners
        const canvas = this.resourceManager?.canvas;
        if (canvas) {
            const newCanvas = canvas.cloneNode(true);
            if (canvas.parentNode) {
                canvas.parentNode.replaceChild(newCanvas, canvas);
            }
        }
        
        // Clean up pipeline
        if (this.renderPipeline) {
            // Unregister from resource manager
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.renderPipeline, 'pipelines');
            }
            this.renderPipeline = null;
        }
        
        // Clean up buffers
        if (this.vertexBuffer) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.vertexBuffer, 'buffers');
            }
            this.vertexBuffer = null;
        }
        
        if (this.uniformBuffer) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.uniformBuffer, 'buffers');
            }
            this.uniformBuffer = null;
        }
        
        // Clean up bind group
        if (this.bindGroup) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.bindGroup, 'bindGroups');
            }
            this.bindGroup = null;
        }
        
        // Clear data
        this.points = null;
        
        // Call parent cleanup for standardized resource management
        super.cleanup();
    }
}

export default LorentzExperience; 