import Pipeline from './Pipeline';
import birdShader from '../shaders/birdShader.wgsl';

export default class FlockingPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, birdCount) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.birdCount = birdCount;

		// Buffers for bird-specific data
		this.phaseBuffer = null; // For wing flapping animation
		this.positionBuffer = null; // For bird positions
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

		// Create buffers for bird phases and positions
		this.phaseBuffer = this.device.createBuffer({
			size: this.birdCount * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Phase Buffer'
		});

		this.positionBuffer = this.device.createBuffer({
			size: this.birdCount * 3 * Float32Array.BYTES_PER_ELEMENT, // Each position has x, y, z
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Position Buffer'
		});

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: 'Flocking Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
				{ binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
			]
		});

		this.pipeline = this.device.createRenderPipeline({
			label: 'Flocking Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: birdShader }),
				entryPoint: 'vertex_main',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: birdShader }),
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
				{ binding: 4, resource: { buffer: this.phaseBuffer } },
				{ binding: 5, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

    render(commandEncoder, passDescriptor, objects, instanceCount) {
        const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
    
        objects.forEach((object) => {
            passEncoder.setVertexBuffer(0, object.getVertexBuffer());
            passEncoder.setIndexBuffer(object.getIndexBuffer(), 'uint16');
            passEncoder.drawIndexed(object.getIndexCount(), instanceCount, 0, 0, 0); // Add `instanceCount` here
        });
    
        passEncoder.end();
    }
    

	updatePhases(time) {
		// Update phases for wing flapping (e.g., sinusoidal animation)
		const phases = new Float32Array(this.birdCount);
		for (let i = 0; i < this.birdCount; i++) {
			phases[i] = Math.sin(time * 0.01 + i * 0.1); // Add slight offset for variety
		}
		this.device.queue.writeBuffer(this.phaseBuffer, 0, phases);
	}

	updatePositions(positions) {
		// Update positions of the birds
		const flatPositions = new Float32Array(positions.flat());
		this.device.queue.writeBuffer(this.positionBuffer, 0, flatPositions);
	}

	cleanup() {
		if (this.phaseBuffer) this.phaseBuffer.destroy();
		if (this.positionBuffer) this.positionBuffer.destroy();
		super.cleanup();
	}
}
