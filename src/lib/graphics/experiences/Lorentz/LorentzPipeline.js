import Pipeline from '../../pipelines/Pipeline';
import lorentzShader from './lorentzShader.wgsl';
import lorentzComputeShader from './lorentzComputeShader.wgsl';

export default class LorentzPipeline extends Pipeline {
    constructor(device, numPoints, viewportBuffer) {
        super(device);
        this.numPoints = numPoints;
        this.viewportBuffer = viewportBuffer;
        this.time = 0;
        
        // Create parameters buffer
        this.paramsBuffer = device.createBuffer({
            size: 32, // 8 floats (4 bytes each)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Lorentz Parameters Buffer'
        });
        
        // Create vertices buffer
        this.verticesBuffer = device.createBuffer({
            size: numPoints * 16, // vec3 position + padding (16 bytes per vertex)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
            label: 'Lorentz Vertices Buffer'
        });
        
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
    }

    async initialize() {
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
        
        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: renderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 16, // vec3 + padding
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3'
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
                topology: 'line-strip'
            }
        });
        
        // Create render bind group
        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.viewportBuffer }
            }]
        });
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
        // Update parameters
        this.updateParams(params);
        
        // Compute pass
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.numPoints / 64));
        computePass.end();
        
        // Render pass
        const renderPass = commandEncoder.beginRenderPass(passDescriptor);
        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.renderBindGroup);
        renderPass.setVertexBuffer(0, this.verticesBuffer);
        renderPass.draw(this.numPoints);
        renderPass.end();
    }
    
    cleanup() {
        if (this.paramsBuffer) this.paramsBuffer.destroy();
        if (this.verticesBuffer) this.verticesBuffer.destroy();
    }
} 