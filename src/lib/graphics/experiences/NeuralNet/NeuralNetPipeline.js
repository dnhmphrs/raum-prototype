import Pipeline from '../../pipelines/Pipeline';
import neuronShader from './neuronShader.wgsl';

export default class NeuralNetPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, neuronCount, dendriteCount, cube) {
		super(device);
		this.device = device;
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.neuronCount = neuronCount;
		this.dendriteCount = dendriteCount;
		this.cube = cube;

		// Buffers for neuron-specific data
		this.activityBuffer = null;
		this.positionBuffer = null;
		this.dendriteVertexBuffer = null; // For dendrite connections

		// Variables for pseudorandom modulation
		this.modulationInterval = 5000; // Change modulation target every 5 seconds
		this.modulationStartTime = undefined;
		this.modulationChangeTime = undefined;
		this.globalModulation = Math.random();
		this.previousModulation = this.globalModulation;
		this.targetModulation = Math.random();
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

		// Cube bind group layout (same as dendrite if no specific uniforms are needed)
		const cubeBindGroupLayout = this.device.createBindGroupLayout({
			label: 'Cube Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Viewport Size
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

		// Create cube pipeline
		this.cubePipeline = this.device.createRenderPipeline({
			label: 'Cube Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [cubeBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'vertex_main_cube',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: neuronShader }),
				entryPoint: 'fragment_main_cube',
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

		// Create cube bind group
		this.cubeBindGroup = this.device.createBindGroup({
			layout: cubeBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } }
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

		// Render cube
		passEncoder.setPipeline(this.cubePipeline);
		passEncoder.setBindGroup(0, this.cubeBindGroup);

		passEncoder.setVertexBuffer(0, this.cube.getVertexBuffer());
		passEncoder.setIndexBuffer(this.cube.getIndexBuffer(), 'uint16');

		passEncoder.drawIndexed(this.cube.getIndexCount(), 1, 0, 0, 0);

		passEncoder.end();
	}

	updateConnections(connections, positions, extraDendritePositions = []) {
		// Calculate total dendrites
		const totalDendriteCount = connections.length + extraDendritePositions.length;

		// Flatten dendrite positions into a Float32Array
		const dendritePositions = new Float32Array(totalDendriteCount * 6);

		// Existing connections
		connections.forEach((connection, i) => {
			const sourcePosition = positions[connection.source];
			const targetPosition = positions[connection.target];
			dendritePositions.set([...sourcePosition, ...targetPosition], i * 6);
		});

		// Extra connections
		extraDendritePositions.forEach((dendrite, i) => {
			const index = connections.length + i;
			dendritePositions.set([...dendrite.sourcePosition, ...dendrite.targetPosition], index * 6);
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

		// Update dendrite count
		this.dendriteCount = totalDendriteCount;
	}

	updateActivity(time) {
		if (!this.positions) {
			console.error('Neuron positions are not defined!');
			return;
		}

		const activities = new Float32Array(this.neuronCount);

		// Calculate the time difference since the last update
		const deltaTime = this.lastUpdateTime !== undefined ? time - this.lastUpdateTime : 16; // Default to ~16ms
		this.lastUpdateTime = time;

		// Decay constant for activity decay (in milliseconds)
		const tau = 200; // Adjust this value to control decay speed
		const decayFactor = Math.exp(-deltaTime / tau);

		// Parameters for activity centers
		const numActivityCenters = 5; // Number of moving activity centers
		const activityCenters = [];
		const centerMovementSpeed = 0.001; // Controls how fast the centers move
		const falloffRadius = 5000; // Radius of influence for activity centers
		const falloffSteepness = 10; // Controls how sharply activity decreases with distance

		// Generate moving activity centers
		for (let j = 0; j < numActivityCenters; j++) {
			const center = [
				Math.sin(time * centerMovementSpeed + j) * 150, // X coordinate
				Math.cos(time * centerMovementSpeed + j * 0.5) * 150, // Y coordinate
				Math.sin(time * centerMovementSpeed + j * 0.25) * 150 // Z coordinate
			];
			activityCenters.push(center);
		}

		// Pseudorandom modulation
		if (this.modulationStartTime === undefined) {
			// Initialize modulation variables
			this.modulationStartTime = time;
			this.modulationChangeTime = time + this.modulationInterval;
			this.globalModulation = Math.random();
			this.previousModulation = this.globalModulation;
			this.targetModulation = Math.random();
		}

		if (time >= this.modulationChangeTime) {
			// Time to change the target modulation
			this.previousModulation = this.globalModulation;
			this.targetModulation = Math.random();
			this.modulationStartTime = time;
			this.modulationChangeTime = time + this.modulationInterval;
		}

		const modulationProgress = Math.min(
			1.0,
			(time - this.modulationStartTime) / this.modulationInterval
		);
		this.globalModulation =
			this.previousModulation +
			(this.targetModulation - this.previousModulation) * modulationProgress;

		// Initialize previousActivities if not present
		if (!this.previousActivities) {
			this.previousActivities = new Float32Array(this.neuronCount);
		}

		// For each neuron, determine if it should fire
		for (let i = 0; i < this.neuronCount; i++) {
			const neuronPosition = this.positions[i];
			if (!neuronPosition) {
				console.error(`Position for neuron ${i} is undefined!`);
				continue;
			}

			// Calculate influence from activity centers
			let influence = 0;
			for (const center of activityCenters) {
				const dx = neuronPosition[0] - center[0];
				const dy = neuronPosition[1] - center[1];
				const dz = neuronPosition[2] - center[2];
				const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

				const normalizedDistance = Math.max(0, 1 - distance / falloffRadius);
				influence += Math.pow(normalizedDistance, falloffSteepness);
			}

			// Include pseudorandom modulation
			const firingProbability = influence * this.globalModulation * 0.1; // Adjust scaling factor as needed

			// Random chance to fire based on firing probability and deltaTime
			if (Math.random() < firingProbability * (deltaTime / 1000)) {
				// Neuron fires: sudden flash
				activities[i] = 1.0; // Maximum activity
			} else {
				// Neuron does not fire: decay activity
				activities[i] = this.previousActivities[i] * decayFactor;
			}
		}

		// Store current activities for next frame
		this.previousActivities = activities;

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
