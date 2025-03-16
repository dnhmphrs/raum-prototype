import Pipeline from '../../pipelines/Pipeline';

export default class RenderPipeline2D extends Pipeline {
	constructor(device, resourceManager) {
		super(device);
		this.resourceManager = resourceManager;
		this.isInitialized = false;
		this.shaderCode = null;
		
		// Create a simple quad for the background
		this.createQuadBuffers();
		
		// Create uniform buffer for time and resolution
		this.uniformBuffer = this.device.createBuffer({
			size: 16, // 4 floats: time, resolution.x, resolution.y, unused
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Background Uniform Buffer'
		});
	}
	
	createQuadBuffers() {
		// Create a full-screen quad
		const vertices = new Float32Array([
			// Position (x, y)
			-1.0, -1.0,  // Bottom-left
			 1.0, -1.0,  // Bottom-right
			 1.0,  1.0,  // Top-right
			-1.0,  1.0,  // Top-left
		]);
		
		const indices = new Uint16Array([
			0, 1, 2,  // First triangle
			0, 2, 3,  // Second triangle
		]);
		
		// Create vertex buffer
		this.vertexBuffer = this.device.createBuffer({
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			label: 'Background Quad Vertex Buffer'
		});
		
		// Create index buffer
		this.indexBuffer = this.device.createBuffer({
			size: indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			label: 'Background Quad Index Buffer'
		});
		
		// Upload data to GPU
		this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
		this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
	}
	
	async initialize() {
		try {
			// Fetch the shader from the static directory
			try {
				const response = await fetch('/shaders/cube/theta2D.wgsl');
				if (response.ok) {
					this.shaderCode = await response.text();
				} else {
					console.error("Failed to load cube 2D shader from static directory");
					return false;
				}
			} catch (error) {
				console.error("Error loading cube 2D shader:", error);
				return false;
			}
			
			// Create bind group layout
			this.bindGroupLayout = this.device.createBindGroupLayout({
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: { type: 'uniform' }
					}
				]
			});
			
			// Create pipeline layout
			this.pipelineLayout = this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout]
			});
			
			// Create shader module
			this.shaderModule = this.device.createShaderModule({
				label: 'Theta2D Shader',
				code: this.shaderCode
			});
			
			// Create render pipeline
			this.pipeline = this.device.createRenderPipeline({
				layout: this.pipelineLayout,
				vertex: {
					module: this.shaderModule,
					entryPoint: 'vertexMain',
					buffers: [{
						arrayStride: 8, // 2 floats, 4 bytes each
						attributes: [{
							shaderLocation: 0,
							offset: 0,
							format: 'float32x2'
						}]
					}]
				},
				fragment: {
					module: this.shaderModule,
					entryPoint: 'fragmentMain',
					targets: [{
						format: navigator.gpu.getPreferredCanvasFormat()
					}]
				},
				primitive: {
					topology: 'triangle-list'
				}
			});
			
			// Create bind group
			this.bindGroup = this.device.createBindGroup({
				layout: this.bindGroupLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.uniformBuffer }
					}
				]
			});
			
			this.isInitialized = true;
			return true;
		} catch (error) {
			console.error("Error initializing 2D Pipeline:", error);
			return false;
		}
	}
	
	render(commandEncoder, textureView, time) {
		if (!this.isInitialized || !textureView) {
			return;
		}
		
		try {
			// Update uniform buffer with time and resolution
			const canvas = this.resourceManager.canvas;
			const width = canvas ? canvas.width : 800;
			const height = canvas ? canvas.height : 600;
			
			this.device.queue.writeBuffer(
				this.uniformBuffer,
				0,
				new Float32Array([time, width, height, 0.0])
			);
			
			// Create render pass
			const renderPassDescriptor = {
				colorAttachments: [{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
					loadOp: 'clear',
					storeOp: 'store'
				}]
			};
			
			// Begin render pass
			const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
			passEncoder.setPipeline(this.pipeline);
			passEncoder.setBindGroup(0, this.bindGroup);
			passEncoder.setVertexBuffer(0, this.vertexBuffer);
			passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
			passEncoder.drawIndexed(6); // 2 triangles = 6 indices
			passEncoder.end();
		} catch (error) {
			console.error("Error in 2D Pipeline render:", error);
		}
	}
	
	cleanup() {
		this.isInitialized = false;
	}
}
