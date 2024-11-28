import RenderPipeline2D from './RenderPipeline2D';
import RenderPipeline3D from './RenderPipeline3D';
import ComputePipeline from './ComputePipeline';

class PipelineManager {
	constructor(device, camera) {
		this.device = device;
		this.camera = camera;
		this.pipelines = {}; // Stores the initialized pipelines
		this.buffers = {}; // Stores shared uniform buffers
		this.depthTexture = null; // Shared depth texture
	}

	async initialize() {
		try {
			this.buffers.viewportBuffer = this.createUniformBuffer(16);
			this.buffers.mouseBuffer = this.createUniformBuffer(16);

			this.pipelines['2D'] = new RenderPipeline2D(
				this.device,
				this.buffers.viewportBuffer,
				this.buffers.mouseBuffer
			);
			await this.pipelines['2D'].initialize();

			this.pipelines['3D'] = new RenderPipeline3D(
				this.device,
				this.camera,
				this.buffers.viewportBuffer,
				this.buffers.mouseBuffer
			);
			await this.pipelines['3D'].initialize();

			this.pipelines['Compute'] = new ComputePipeline(this.device);
			await this.pipelines['Compute'].initialize();

			// Initialize the depth texture
			this.initializeDepthTexture(this.device.canvas.width, this.device.canvas.height);

			console.log('PipelineManager initialized successfully:', this.pipelines);
		} catch (error) {
			console.error('Error during PipelineManager initialization:', error);
		}
	}

	initializeDepthTexture(width, height) {
		if (this.depthTexture) {
			this.depthTexture.destroy(); // Free up the old texture
		}
		this.depthTexture = this.device.createTexture({
			size: { width, height, depthOrArrayLayers: 1 },
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			label: 'Depth Texture'
		});
	}

	getDepthTexture() {
		return this.depthTexture.createView();
	}

	createUniformBuffer(size) {
		return this.device.createBuffer({
			size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Uniform Buffer'
		});
	}

	// Update shared uniform buffers
	updateMousePosition(x, y) {
		const mouseData = new Float32Array([x, y]);
		this.device.queue.writeBuffer(this.buffers.mouseBuffer, 0, mouseData);
	}

	updateViewportSize(width, height) {
		const viewportData = new Float32Array([width, height]);
		this.device.queue.writeBuffer(this.buffers.viewportBuffer, 0, viewportData);
	}

	// Access a pipeline by name
	getPipeline(name) {
		if (!this.pipelines[name]) {
			console.error(`Pipeline ${name} is not initialized.`);
			return null;
		}
		return this.pipelines[name];
	}

	// Run the compute pipeline
	async runComputePipeline() {
		const computePipeline = this.pipelines['Compute'];
		if (computePipeline) {
			await computePipeline.runComputePass();
		} else {
			console.error('Compute pipeline is not initialized.');
		}
	}

	// Update 2D and 3D pipelines with shared buffer data
	updatePipelines(mouseX, mouseY, viewportWidth, viewportHeight) {
		this.updateMousePosition(mouseX, mouseY);
		this.updateViewportSize(viewportWidth, viewportHeight);
	}

	// Run the render pipelines
	runRenderPipelines(commandEncoder, textureView, depthView) {
		// Run 2D pipeline
		const pipeline2D = this.pipelines['2D'];
		if (pipeline2D) {
			pipeline2D.render(commandEncoder, textureView);
		} else {
			console.error('2D pipeline is not initialized.');
		}

		// Run 3D pipeline
		const pipeline3D = this.pipelines['3D'];
		if (pipeline3D) {
			pipeline3D.render(commandEncoder, textureView, depthView);
		} else {
			console.error('3D pipeline is not initialized.');
		}
	}
}

export default PipelineManager;
