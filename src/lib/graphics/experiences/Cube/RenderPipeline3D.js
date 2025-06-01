import Pipeline from '../../pipelines/Pipeline';
import shaderCode from './theta3D.wgsl';

export default class RenderPipeline3D extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer, modelBuffer } = this.camera.getBuffers();

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: '3D Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
			]
		});

		this.pipeline = this.device.createRenderPipeline({
			label: '3D Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: shaderCode }),
				entryPoint: 'vertex_main',
				buffers: [
					{
						arrayStride: 12,
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: shaderCode }),
				entryPoint: 'fragment_main',
				targets: [{ format }]
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});

		this.bindGroup = this.device.createBindGroup({
			layout: bindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: modelBuffer } },
				{ binding: 3, resource: { buffer: this.viewportBuffer } },
				{ binding: 4, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor, objects) {
		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);

		objects.forEach((object) => {
			passEncoder.setVertexBuffer(0, object.getVertexBuffer());
			passEncoder.setIndexBuffer(object.getIndexBuffer(), 'uint16');
			passEncoder.drawIndexed(object.getIndexCount(), 1, 0, 0);
		});

		passEncoder.end();
	}

	cleanup() {
		// Since GPU pipelines don't have a destroy method, we can nullify references
		this.pipeline = null;
		this.bindGroup = null;
	}
}
