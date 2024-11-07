// webgpu/ComputePipeline.js
import computeShader from './shaders/compute.wgsl';

export let storageBuffer; // The buffer used in the compute shader
export let readBuffer; // The buffer used to read data back to the CPU

// Initialize all buffers
export function initializeComputeBuffers(device) {
	// Create the storage buffer for compute data
	storageBuffer = device.createBuffer({
		label: 'compute storage buffer',
		size: 256 * Float32Array.BYTES_PER_ELEMENT, // Example size (256 floats)
		// eslint-disable-next-line no-undef
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC // STORAGE, COPY_DST, and COPY_SRC
	});

	// Corrected: Ensure only MAP_READ and COPY_DST
	readBuffer = device.createBuffer({
		label: 'compute read buffer',
		size: 256 * Float32Array.BYTES_PER_ELEMENT,
		// eslint-disable-next-line no-undef
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST // Only MAP_READ and COPY_DST
	});
}

// Function to create and return the compute pipeline
export async function createComputePipeline(device) {
	// Create a compute pipeline
	const computePipeline = device.createComputePipeline({
		label: 'compute pipeline',
		layout: 'auto',
		compute: {
			module: device.createShaderModule({ label: 'compute shader', code: computeShader }),
			entryPoint: 'compute_main'
		}
	});

	return computePipeline;
}

// Function to run the compute pass and copy results to the read buffer
export async function runComputePass(device, computePipeline) {
	if (!storageBuffer || !readBuffer) {
		console.error('Buffers are not initialized.');
		return;
	}

	const commandEncoder = device.createCommandEncoder();

	// Start the compute pass
	const passEncoder = commandEncoder.beginComputePass();
	passEncoder.setPipeline(computePipeline);
	passEncoder.setBindGroup(
		0,
		device.createBindGroup({
			label: 'compute bind group',
			layout: computePipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: storageBuffer
					}
				}
			]
		})
	);

	// Dispatch only 4 workgroups (256 / 64)
	passEncoder.dispatchWorkgroups(4); // Adjust based on buffer size and workgroup layout
	passEncoder.end();

	// Copy the data from storageBuffer to readBuffer
	commandEncoder.copyBufferToBuffer(
		storageBuffer,
		0,
		readBuffer,
		0,
		256 * Float32Array.BYTES_PER_ELEMENT
	);

	// Submit the compute pass
	device.queue.submit([commandEncoder.finish()]);
}
