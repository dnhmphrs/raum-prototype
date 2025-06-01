import Pipeline from '../../pipelines/Pipeline';

export default class RenderPipeline2D extends Pipeline {
	constructor(device, viewportBuffer, mouseBuffer) {
		super(device);
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.shaderCode = null;
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();

		// Fetch the shader from the static directory
		try {
			const response = await fetch('/shaders/cube/theta2D.wgsl');
			if (response.ok) {
				this.shaderCode = await response.text();
			}
		} catch (error) {
			console.error("Error loading neuron shader:", error);
			return;
		}

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: 'Uniform Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
			]
		});

		this.pipeline = this.device.createRenderPipeline({
			label: '2D Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ label: 'Vertex Shader', code: this.shaderCode }),
				entryPoint: 'vertex_main'
			},
			fragment: {
				module: this.device.createShaderModule({ label: 'Fragment Shader', code: this.shaderCode }),
				entryPoint: 'fragment_main',
				targets: [{ format }]
			}
		});

		this.bindGroup = this.device.createBindGroup({
			label: 'Uniform Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.viewportBuffer } },
				{ binding: 1, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor) {
		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);
		passEncoder.draw(3, 1, 0, 0);
		passEncoder.end();
	}

	cleanup() {
		// Since GPU pipelines don't have a destroy method, we can nullify references
		this.pipeline = null;
		this.bindGroup = null;
	}
}
