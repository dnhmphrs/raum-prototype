import Pipeline from '../../pipelines/Pipeline';
import neuronShader from './neuronShader.wgsl';

export default class NeuralNetPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, neuronCount, dendriteCount) {
		super(device);
		this.device = device;
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.neuronCount = neuronCount;
		this.dendriteCount = dendriteCount;

		// Buffers for neuron-specific data
		this.activityBuffer = null;
		this.positionBuffer = null;
		this.dendriteVertexBuffer = null; // For dendrite connections
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

		// Ensure sizes are aligned to 4 bytes
		const alignTo4Bytes = (size) => Math.ceil(size / 4) * 4;

		// Calculate the required sizes
		const activityBufferSize = alignTo4Bytes(this.neuronCount * Float32Array.BYTES_PER_ELEMENT);
		const positionBufferSize = alignTo4Bytes(this.neuronCount * 16); // 16 bytes per position due to alignment

		// Create buffers
		this.activityBuffer = this.device.createBuffer({
			size: activityBufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Activity Buffer'
		});

		this.positionBuffer = this.device.createBuffer({
			size: positionBufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Position Buffer'
		});

		// Neuron bind group layout
		const neuronBindGroupLayout = this.device.createBindGroupLayout({
			label: 'Neuron Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Positions
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Activities
				{ binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		// Dendrite bind group layout (unchanged)
		const dendriteBindGroupLayout = this.device.createBindGroupLayout({
			label: 'Dendrite Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		// Create neuron pipeline (unchanged)
		this.neuronPipeline = this.device.createRenderPipeline({
			label: 'Neuron Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [neuronBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'vertex_main_neuron',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'fragment_main_neuron',
				targets: [
					{
						format: format,
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
				topology: 'line-list'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});

		// Create dendrite pipeline (unchanged)
		this.dendritePipeline = this.device.createRenderPipeline({
			label: 'Dendrite Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [dendriteBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'vertex_main_dendrite',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'fragment_main_dendrite',
				targets: [
					{
						format: format,
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
				topology: 'line-list'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});

		// Create neuron bind group
		this.neuronBindGroup = this.device.createBindGroup({
			layout: neuronBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.positionBuffer } },
				{ binding: 4, resource: { buffer: this.activityBuffer } },
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});

		// Create dendrite bind group (unchanged)
		this.dendriteBindGroup = this.device.createBindGroup({
			layout: dendriteBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor, objects) {
		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);

		// Render neurons
		passEncoder.setPipeline(this.neuronPipeline);
		passEncoder.setBindGroup(0, this.neuronBindGroup);

		const firstObject = objects[0]; // Assuming all neurons share the same geometry
		passEncoder.setVertexBuffer(0, firstObject.getVertexBuffer());
		passEncoder.setIndexBuffer(firstObject.getIndexBuffer(), 'uint16');

		passEncoder.drawIndexed(firstObject.getIndexCount(), this.neuronCount, 0, 0, 0);

		// Render dendrites
		passEncoder.setPipeline(this.dendritePipeline);
		passEncoder.setBindGroup(0, this.dendriteBindGroup);

		passEncoder.setVertexBuffer(0, this.dendriteVertexBuffer);

		// Each dendrite consists of two vertices
		passEncoder.draw(2 * this.dendriteCount, 1, 0, 0);

		passEncoder.end();
	}

	updateConnections(connections, positions) {
		// Flatten dendrite positions into a Float32Array
		const dendritePositions = new Float32Array(connections.length * 6);
		connections.forEach((connection, i) => {
			const sourcePosition = positions[connection.source];
			const targetPosition = positions[connection.target];
			dendritePositions.set([...sourcePosition, ...targetPosition], i * 6);
		});

		// Create the dendrite vertex buffer
		if (this.dendriteVertexBuffer) {
			this.dendriteVertexBuffer.destroy();
		}

		this.dendriteVertexBuffer = this.device.createBuffer({
			size: dendritePositions.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			label: 'Dendrite Vertex Buffer'
		});

		this.device.queue.writeBuffer(this.dendriteVertexBuffer, 0, dendritePositions);
	}

	updateActivity(time) {
		if (!this.positions) {
			console.error('Neuron positions are not defined!');
			return;
		}

		const activities = new Float32Array(this.neuronCount);

		// Define parameters for multiple activity centers
		const numActivityCenters = 10; // Number of centers
		const activityCenters = [];
		const falloffRadius = 1000; // Larger radius for broader influence
		const falloffSteepness = 0.1; // Adjust steepness for a softer transition

		// Generate moving activity centers
		for (let j = 0; j < numActivityCenters; j++) {
			const center = [
				Math.sin(time * 0.01 + j) * 1, // Move in X
				Math.cos(time * 0.01 + j * 0.5) * 1, // Move in Y
				Math.sin(time * 0.01 + j * 0.25) * Math.cos(time * 0.01 + j * 0.5) * 1 // Move in Z
			];
			activityCenters.push(center);
		}

		// Calculate activity for each neuron
		for (let i = 0; i < this.neuronCount; i++) {
			const neuronPosition = this.positions[i];
			if (!neuronPosition) {
				console.error(`Position for neuron ${i} is undefined!`);
				continue;
			}

			// Combine influences from multiple activity centers
			let combinedActivity = 0;
			for (const center of activityCenters) {
				const distance = Math.sqrt(
					Math.pow(neuronPosition[0] - center[0], 2) +
						Math.pow(neuronPosition[1] - center[1], 2) +
						Math.pow(neuronPosition[2] - center[2], 2)
				);

				// Calculate activity based on falloff
				const normalizedDistance = Math.max(0, 1 - distance / falloffRadius);
				combinedActivity += Math.pow(normalizedDistance, falloffSteepness);
			}

			// Normalize combined activity to avoid excessive brightness
			activities[i] = Math.min(1.0, combinedActivity / numActivityCenters);
		}

		// Add dynamic temporal modulation for the "pulsing" effect
		for (let i = 0; i < this.neuronCount; i++) {
			activities[i] *= 0.5 + 0.5 * Math.sin(time * 0.005 + i * 0.1);
		}

		// Add a pseudo-random ebb and flow modulation
		const randomModulation = (index, time) => {
			// Use a combination of sine waves with different frequencies and offsets
			return (
				0.75 +
				0.5 *
					Math.sin(
						time * Math.sin(0.01 * (0.2 + 0.05 * (index % 5))) + // Low-frequency sine
							0.5 * Math.sin(index * 0.5) // Spatial variation
					)
			);
		};

		for (let i = 0; i < this.neuronCount; i++) {
			activities[i] *= randomModulation(i, time);
		}

		// Update the activity buffer
		this.device.queue.writeBuffer(this.activityBuffer, 0, activities);
	}

	updatePositions(positions) {
		this.positions = positions; // Store positions locally

		// Create a Float32Array with padding (16 bytes per position)
		const paddedPositions = new Float32Array(this.neuronCount * 4); // 4 floats per position
		for (let i = 0; i < this.neuronCount; i++) {
			paddedPositions[i * 4 + 0] = positions[i][0];
			paddedPositions[i * 4 + 1] = positions[i][1];
			paddedPositions[i * 4 + 2] = positions[i][2];
			paddedPositions[i * 4 + 3] = 0; // Padding (could be used for other purposes)
		}

		this.device.queue.writeBuffer(this.positionBuffer, 0, paddedPositions);
	}

	cleanup() {
		if (this.activityBuffer) this.activityBuffer.destroy();
		if (this.positionBuffer) this.positionBuffer.destroy();
		if (this.dendriteVertexBuffer) this.dendriteVertexBuffer.destroy();
	}
}
