import shaderCode from './shaders/theta2D.wgsl';

export default class RenderPipeline2D {
	constructor(device, viewportBuffer, mouseBuffer) {
		this.device = device;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.pipeline = null;
		this.bindGroup = null;
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();

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
				module: this.device.createShaderModule({ label: 'Vertex Shader', code: shaderCode }),
				entryPoint: 'vertex_main'
			},
			fragment: {
				module: this.device.createShaderModule({ label: 'Fragment Shader', code: shaderCode }),
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

	updateMousePosition(x, y) {
		const mousePosition = new Float32Array([x, y]);
		this.device.queue.writeBuffer(this.mouseBuffer, 0, mousePosition);
	}

	updateViewportSize(width, height) {
		const viewportSize = new Float32Array([width, height]);
		this.device.queue.writeBuffer(this.viewportBuffer, 0, viewportSize);
	}
}
