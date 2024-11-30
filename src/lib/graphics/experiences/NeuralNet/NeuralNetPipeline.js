import Pipeline from '../../pipelines/Pipeline';
import neuronShader from './neuronShader.wgsl';

export default class NeuralNetPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, neuronCount, dendriteCount) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.neuronCount = neuronCount;
		this.dendriteCount = dendriteCount; // Ensure dendriteCount is passed correctly

		// Buffers for neuron-specific data
		this.activityBuffer = null;
		this.positionBuffer = null;
		this.dendriteBuffer = null; // For dendrite connections
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

		if (!this.dendriteCount || this.dendriteCount <= 0) {
			console.error('Dendrite count is zero or undefined. Ensure connections are set properly.');
			this.dendriteCount = 1; // Avoid zero-sized buffer; fallback for debugging
		}

		// Ensure sizes are aligned to 4 bytes
		const alignTo4Bytes = (size) => Math.ceil(size / 4) * 4;

		// Calculate the required sizes
		const activityBufferSize = this.neuronCount * Float32Array.BYTES_PER_ELEMENT;
		const positionBufferSize = this.neuronCount * 3 * Float32Array.BYTES_PER_ELEMENT;
		const dendriteBufferSize = alignTo4Bytes(
			this.dendriteCount * 6 * Float32Array.BYTES_PER_ELEMENT
		);

		if (dendriteBufferSize <= 0) {
			throw new Error(`Invalid dendriteBufferSize: ${dendriteBufferSize}`);
		}

		// Create buffers
		this.activityBuffer = this.device.createBuffer({
			size: alignTo4Bytes(activityBufferSize),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Activity Buffer'
		});

		this.positionBuffer = this.device.createBuffer({
			size: alignTo4Bytes(positionBufferSize),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Position Buffer'
		});

		if (this.dendriteCount <= 0) {
			throw new Error('Dendrite count must be greater than zero.');
		}

		this.dendriteBuffer = this.device.createBuffer({
			size: dendriteBufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Dendrite Buffer'
		});

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: 'NeuralNet Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Positions
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Activities
				{ binding: 5, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Dendrites
				{ binding: 6, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Instance Count
				{ binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		this.instanceCountBuffer = this.device.createBuffer({
			size: 4, // Single `u32` value
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Instance Count Buffer'
		});

		console.log(`Neuron Count: ${this.neuronCount}`);
		console.log(`Dendrite Count: ${this.dendriteCount}`);
		console.log(`Dendrite Buffer Size: ${this.dendriteBuffer.size}`);

		this.device.queue.writeBuffer(this.instanceCountBuffer, 0, new Uint32Array([this.neuronCount]));

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
				targets: [
					{
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
						},
						writeMask: GPUColorWrite.ALL
					}
				]
			},
			primitive: {
				topology: 'line-list' // Or 'triangle-list' for neurons
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
				{ binding: 5, resource: { buffer: this.dendriteBuffer } },
				{ binding: 6, resource: { buffer: this.instanceCountBuffer } }, // Instance Count
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor, objects, instanceCount) {
		const totalInstanceCount = this.neuronCount + this.dendriteCount;

		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);

		const firstObject = objects[0]; // Assuming all objects share the same geometry
		passEncoder.setVertexBuffer(0, firstObject.getVertexBuffer());
		passEncoder.setIndexBuffer(firstObject.getIndexBuffer(), 'uint16');

		// Use total instance count for drawing neurons and dendrites
		passEncoder.drawIndexed(firstObject.getIndexCount(), totalInstanceCount, 0, 0, 0);
		passEncoder.end();
	}

	updateConnections(connections, positions) {
		if (
			this.dendriteBuffer &&
			this.dendriteBuffer.size < connections.length * 6 * Float32Array.BYTES_PER_ELEMENT
		) {
			// Recreate buffer if current size is insufficient
			this.dendriteBuffer.destroy();
			this.dendriteBuffer = this.device.createBuffer({
				size: alignTo4Bytes(connections.length * 6 * Float32Array.BYTES_PER_ELEMENT),
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
				label: 'Dendrite Buffer'
			});
		}

		// Update buffer data
		const dendriteData = new Float32Array(connections.length * 6);
		connections.forEach((connection, i) => {
			const sourcePosition = positions[connection.source];
			const targetPosition = positions[connection.target];
			dendriteData.set([...sourcePosition, ...targetPosition], i * 6);
		});
		this.device.queue.writeBuffer(this.dendriteBuffer, 0, dendriteData);
	}

	updateActivity(time) {
		const activities = new Float32Array(this.neuronCount);
		for (let i = 0; i < this.neuronCount; i++) {
			activities[i] = Math.random() > 0.97 ? 1.0 : 0.0; // Random flashing
		}
		this.device.queue.writeBuffer(this.activityBuffer, 0, activities);
	}

	updatePositions(positions) {
		const flatPositions = new Float32Array(positions.flat());
		this.device.queue.writeBuffer(this.positionBuffer, 0, flatPositions);
	}

	cleanup() {
		if (this.activityBuffer) this.activityBuffer.destroy();
		if (this.positionBuffer) this.positionBuffer.destroy();
		if (this.dendriteBuffer) this.dendriteBuffer.destroy();
	}
}
