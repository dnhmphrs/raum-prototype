import Pipeline from '../../pipelines/Pipeline';

export default class RenderPipeline3D extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.shaderCode = null;
	}

	async initialize() {
		try {
			// Fetch the shader from the static directory
			const response = await fetch('/shaders/cube/theta3D.wgsl');
			if (response.ok) {
				this.shaderCode = await response.text();
			} else {
				console.error("Failed to load cube shader from static directory");
				return false;
			}
		} catch (error) {
			console.error("Error loading cube shader:", error);
			return false;
		}

		// Create bind group layout
		this.bindGroupLayout = this.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: 'uniform' } // Projection matrix
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: 'uniform' } // View matrix
				},
				{
					binding: 2,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: 'uniform' } // Time uniform
				}
			]
		});

		// Create pipeline layout
		this.pipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayout]
		});

		// Create shader module
		this.shaderModule = this.device.createShaderModule({
			label: 'Cube Shader',
			code: this.shaderCode
		});
		
		// Create render pipeline
		this.pipeline = this.device.createRenderPipeline({
			layout: this.pipelineLayout,
			vertex: {
				module: this.shaderModule,
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
				module: this.shaderModule,
				entryPoint: 'fragmentMain',
				targets: [{
					format: navigator.gpu.getPreferredCanvasFormat(),
					blend: {
						color: {
							srcFactor: 'src-alpha',
							dstFactor: 'one-minus-src-alpha',
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
				topology: 'triangle-list',
				cullMode: 'back'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});
		
		this.isInitialized = true;
		return true;
	}

	render(commandEncoder, textureView, depthTextureView, uniformBuffer) {
		if (!this.isInitialized || !textureView || !depthTextureView) {
			return;
		}
		
		try {
			// Get camera buffers
			const { projectionBuffer, viewBuffer } = this.camera.getBuffers();
			
			// Create bind group for this render pass
			const bindGroup = this.device.createBindGroup({
				layout: this.bindGroupLayout,
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
						resource: { buffer: uniformBuffer }
					}
				]
			});
			
			// Create render pass with explicit depth testing
			// IMPORTANT: Use 'load' instead of 'clear' to preserve the background
			const renderPassDescriptor = {
				colorAttachments: [{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, // Transparent clear color
					loadOp: 'load', // Use 'load' to preserve background
					storeOp: 'store'
				}],
				depthStencilAttachment: {
					view: depthTextureView,
					depthClearValue: 1.0,
					depthLoadOp: 'clear', // Clear depth buffer
					depthStoreOp: 'store'
				}
			};
			
			// Begin render pass
			const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
			passEncoder.setPipeline(this.pipeline);
			passEncoder.setBindGroup(0, bindGroup);
			passEncoder.setVertexBuffer(0, this.vertexBuffer);
			passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
			passEncoder.drawIndexed(36); // 12 triangles = 36 indices for a cube
			passEncoder.end();
		} catch (error) {
			console.error("Error in 3D Pipeline render:", error);
		}
	}

	cleanup() {
		this.isInitialized = false;
	}
}
