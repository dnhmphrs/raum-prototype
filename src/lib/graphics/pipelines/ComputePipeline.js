import computeShader from '../shaders/compute.wgsl';

export default class ComputePipeline {
	constructor(device) {
		this.device = device;
		this.pipeline = null;
		this.storageBuffer = null;
		this.readBuffer = null;
		this.bindGroup = null;
	}

	async initialize() {
		this.createBuffers();
		await this.createPipeline();
		this.createBindGroup();
	}

	createBuffers() {
		// Create the storage buffer for compute data
		this.storageBuffer = this.device.createBuffer({
			label: 'Compute Storage Buffer',
			size: 256 * Float32Array.BYTES_PER_ELEMENT, // Example size (256 floats)
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
		});

		// Create the read buffer for CPU-side data reading
		this.readBuffer = this.device.createBuffer({
			label: 'Compute Read Buffer',
			size: 256 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST // Only MAP_READ and COPY_DST
		});
	}

	async createPipeline() {
		// Create a compute pipeline
		this.pipeline = this.device.createComputePipeline({
			label: 'Compute Pipeline',
			layout: 'auto',
			compute: {
				module: this.device.createShaderModule({
					label: 'Compute Shader',
					code: computeShader
				}),
				entryPoint: 'compute_main'
			}
		});
	}

	createBindGroup() {
		if (!this.pipeline || !this.storageBuffer) {
			console.error('Pipeline or buffers not initialized for bind group creation.');
			return;
		}

		// Create the bind group for the pipeline
		this.bindGroup = this.device.createBindGroup({
			label: 'Compute Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: { buffer: this.storageBuffer }
				}
			]
		});
	}

	async run() {
		if (!this.pipeline || !this.storageBuffer || !this.readBuffer) {
			console.error('Compute pipeline or buffers are not initialized.');
			return;
		}

		const commandEncoder = this.device.createCommandEncoder();

		// Start the compute pass
		const passEncoder = commandEncoder.beginComputePass();
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);
		passEncoder.dispatchWorkgroups(4); // Adjust based on buffer size and workgroup layout
		passEncoder.end();

		// Copy the data from storageBuffer to readBuffer
		commandEncoder.copyBufferToBuffer(
			this.storageBuffer,
			0,
			this.readBuffer,
			0,
			256 * Float32Array.BYTES_PER_ELEMENT
		);

		// Submit the compute pass
		this.device.queue.submit([commandEncoder.finish()]);

		// Map and read the buffer (optional, for CPU-side usage)
		await this.readBuffer.mapAsync(GPUMapMode.READ);
		const mappedData = new Float32Array(this.readBuffer.getMappedRange());
		console.log('Compute output:', mappedData.slice(0, 10));
		this.readBuffer.unmap();
	}

	cleanup() {
		// Since GPU pipelines don't have a destroy method, we can nullify references
		this.pipeline = null;
		this.bindGroup = null;
	}
}
