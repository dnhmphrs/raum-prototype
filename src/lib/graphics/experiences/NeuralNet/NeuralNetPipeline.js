import Pipeline from '../../pipelines/Pipeline';
import neuronShader from './neuronShader.wgsl';

export default class NeuralNetPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, neuronCount) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.neuronCount = neuronCount;

		// Buffers for neuron-specific data
		this.activityBuffer = null; // For neuron activity levels
		this.positionBuffer = null; // For neuron positions
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

		// Create buffers for neuron activity and positions
		this.activityBuffer = this.device.createBuffer({
			size: this.neuronCount * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Activity Buffer'
		});

		this.positionBuffer = this.device.createBuffer({
			size: this.neuronCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each position has x, y, z
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Position Buffer'
		});

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: 'NeuralNet Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Positions
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Activities
				{ binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		this.pipeline = this.device.createRenderPipeline({
			label: 'NeuralNet Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'vertex_main',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: neuronShader }),
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
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.positionBuffer } },
				{ binding: 4, resource: { buffer: this.activityBuffer } },
				{ binding: 5, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor, objects, instanceCount) {
		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);

		const firstObject = objects[0]; // Assuming all objects share the same geometry
		passEncoder.setVertexBuffer(0, firstObject.getVertexBuffer());
		passEncoder.setIndexBuffer(firstObject.getIndexBuffer(), 'uint16');

		// Use instancing to draw all neurons
		passEncoder.drawIndexed(firstObject.getIndexCount(), instanceCount, 0, 0, 0);
		passEncoder.end();
	}

	updateActivity(time) {
		// Update activity levels for neurons (e.g., intermittent flashing)
		const activities = new Float32Array(this.neuronCount);
		for (let i = 0; i < this.neuronCount; i++) {
			activities[i] = Math.random() > 0.97 ? 1.0 : 0.0; // Random flashing
		}
		this.device.queue.writeBuffer(this.activityBuffer, 0, activities);
	}

	updatePositions(positions) {
		// Update positions of the neurons
		const flatPositions = new Float32Array(positions.flat());
		this.device.queue.writeBuffer(this.positionBuffer, 0, flatPositions);
	}

	cleanup() {
		if (this.activityBuffer) this.activityBuffer.destroy();
		if (this.positionBuffer) this.positionBuffer.destroy();
		// super.cleanup();
	}
}
