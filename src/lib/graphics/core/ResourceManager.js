class ResourceManager {
	constructor(device, camera) {
		this.device = device;
		this.camera = camera;
		this.buffers = {};
		this.depthTexture = null;
	}

	initialize(width, height) {
		this.buffers.viewportBuffer = this.createUniformBuffer(16);
		this.buffers.mouseBuffer = this.createUniformBuffer(16);

		this.camera.updateAspect(width, height);
		this.initializeDepthTexture(width, height);
	}

	createUniformBuffer(size) {
		return this.device.createBuffer({
			size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Uniform Buffer'
		});
	}

	initializeDepthTexture(width, height) {
		if (this.depthTexture) {
			this.depthTexture.destroy();
		}
		this.depthTexture = this.device.createTexture({
			size: { width, height, depthOrArrayLayers: 1 },
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		});
	}

	getViewportBuffer() {
		return this.buffers.viewportBuffer;
	}

	getMouseBuffer() {
		return this.buffers.mouseBuffer;
	}

	getDepthTextureView() {
		return this.depthTexture.createView();
	}

	updateViewportSize(width, height) {
		const viewportData = new Float32Array([width, height]);
		this.device.queue.writeBuffer(this.buffers.viewportBuffer, 0, viewportData);

		this.camera.updateAspect(width, height);
		this.initializeDepthTexture(width, height);
	}

	updateMousePosition(x, y) {
		const mouseData = new Float32Array([x, y]);
		this.device.queue.writeBuffer(this.buffers.mouseBuffer, 0, mouseData);
	}

	cleanup() {
		// Destroy buffers
		if (this.buffers.viewportBuffer) {
			this.buffers.viewportBuffer.destroy();
			this.buffers.viewportBuffer = null;
		}
		if (this.buffers.mouseBuffer) {
			this.buffers.mouseBuffer.destroy();
			this.buffers.mouseBuffer = null;
		}

		// Destroy depth texture
		if (this.depthTexture) {
			this.depthTexture.destroy();
			this.depthTexture = null;
		}
	}
}

export default ResourceManager;
