import Pipeline from '../../pipelines/Pipeline';
import lorentzShader from './lorentzShader.wgsl';
import lorentzComputeShader from './lorentzComputeShader.wgsl';

export default class LorentzPipeline extends Pipeline {
    constructor(device, numPoints, viewportBuffer) {
        super(device);
        this.numPoints = numPoints;
        this.viewportBuffer = viewportBuffer;
        
        // Create parameters buffer
        this.paramsBuffer = device.createBuffer({
            size: 32, // 8 floats (4 bytes each)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Parameters Buffer'
        });
        
        // Create vertices buffer
        this.verticesBuffer = device.createBuffer({
            size: numPoints * 16, // vec4 position (16 bytes per vertex)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Vertices Buffer'
        });
        
        // Initialize vertex buffer with zeros
        const initialData = new Float32Array(numPoints * 4); // 4 floats per vertex (xyz + padding)
        device.queue.writeBuffer(this.verticesBuffer, 0, initialData);
        
        // Default parameters
        this.params = {
            sigma: 10.0,
            rho: 28.0,
            beta: 8/3,
            dt: 0.001,
            time: 0.0,
            numPoints: numPoints,
            padding1: 0,
            padding2: 0
        };
        
        console.log("LorentzPipeline constructor completed");
    }

    async initialize() {
        try {
            console.log("Creating compute shader module...");
            // Create compute shader
            const computeModule = this.device.createShaderModule({
                label: 'Lorentz compute shader',
                code: lorentzComputeShader
            });
            
            // Create compute pipeline
            this.computePipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: computeModule,
                    entryPoint: 'main'
                }
            });
            
            // Create compute bind group
            this.computeBindGroup = this.device.createBindGroup({
                layout: this.computePipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: this.paramsBuffer }
                    },
                    {
                        binding: 1,
                        resource: { buffer: this.verticesBuffer }
                    }
                ]
            });
            
            // Create render shader
            const renderModule = this.device.createShaderModule({
                label: 'Lorentz render shader',
                code: lorentzShader
            });
            
            // Create explicit bind group layout for render pipeline
            const bindGroupLayout = this.device.createBindGroupLayout({
                label: 'Lorentz Render Bind Group Layout',
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' }
                    }
                ]
            });
            
            // Create render pipeline with explicit layout
            this.renderPipeline = this.device.createRenderPipeline({
                label: 'Lorentz Render Pipeline',
                layout: this.device.createPipelineLayout({
                    bindGroupLayouts: [bindGroupLayout]
                }),
                vertex: {
                    module: renderModule,
                    entryPoint: 'vertexMain',
                    buffers: [{
                        arrayStride: 16, // 16 bytes per vertex (vec3 + padding)
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3' // Use x,y,z from the Vertex struct
                        }]
                    }]
                },
                fragment: {
                    module: renderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }]
                },
                primitive: {
                    topology: 'point-list'
                }
            });
            
            // Create render bind group with explicit layout
            this.renderBindGroup = this.device.createBindGroup({
                label: 'Lorentz Render Bind Group',
                layout: bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: { buffer: this.viewportBuffer }
                }]
            });
            
            // Initial parameter update
            this.updateParams({});
            
            console.log("LorentzPipeline initialization complete");
            return true;
        } catch (error) {
            console.error("Error initializing LorentzPipeline:", error);
            throw error;
        }
    }
    
    updateParams(params) {
        // Update local params
        if (params.sigma !== undefined) this.params.sigma = params.sigma;
        if (params.rho !== undefined) this.params.rho = params.rho;
        if (params.beta !== undefined) this.params.beta = params.beta;
        if (params.dt !== undefined) this.params.dt = params.dt;
        
        // Update time
        this.params.time += 0.01;
        
        // Write to GPU
        this.device.queue.writeBuffer(
            this.paramsBuffer, 
            0, 
            new Float32Array([
                this.params.sigma,
                this.params.rho,
                this.params.beta,
                this.params.dt,
                this.params.time,
                this.params.numPoints,
                this.params.padding1,
                this.params.padding2
            ])
        );
    }

    render(commandEncoder, passDescriptor, params = {}) {
        try {
            console.log("Rendering Lorentz with params:", params);
            
            // Check if we have a valid passDescriptor
            if (!passDescriptor || !passDescriptor.colorAttachments || 
                !passDescriptor.colorAttachments[0] || 
                !passDescriptor.colorAttachments[0].view) {
                console.error("Invalid passDescriptor:", passDescriptor);
                return;
            }
            
            // Log the texture view
            console.log("Texture view:", passDescriptor.colorAttachments[0].view);
            
            // Update parameters
            this.updateParams(params);
            
            // Compute pass
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.computeBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.numPoints / 64));
            computePass.end();
            
            // Render pass - with extra validation
            const renderPass = commandEncoder.beginRenderPass(passDescriptor);
            renderPass.setPipeline(this.renderPipeline);
            renderPass.setBindGroup(0, this.renderBindGroup);
            renderPass.setVertexBuffer(0, this.verticesBuffer);
            renderPass.draw(this.numPoints);
            renderPass.end();
            
            console.log("Render completed successfully");
        } catch (error) {
            console.error("Error in LorentzPipeline render:", error);
        }
    }
    
    cleanup() {
        // Since GPU resources don't have explicit destroy methods, we can nullify references
        this.computePipeline = null;
        this.renderPipeline = null;
        this.computeBindGroup = null;
        this.renderBindGroup = null;
    }
} 