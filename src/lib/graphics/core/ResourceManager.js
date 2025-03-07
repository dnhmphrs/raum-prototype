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
		if (!this.depthTexture) {
			console.warn("Depth texture is null, attempting to recreate");
			// Try to get canvas dimensions
			let width = 0;
			let height = 0;
			
			if (this.canvas) {
				width = this.canvas.width;
				height = this.canvas.height;
			} else if (this.device && this.device.canvas) {
				width = this.device.canvas.width;
				height = this.device.canvas.height;
			}
			
			// Only recreate if we have valid dimensions
			if (width > 0 && height > 0) {
				this.updateDepthTexture(width, height);
				console.log(`Recreated depth texture with size ${width}x${height}`);
			} else {
				console.warn("Cannot recreate depth texture: invalid dimensions");
				return null;
			}
		}
		
		// Return null instead of throwing an error if depthTexture is still null
		return this.depthTexture ? this.depthTexture.createView() : null;
	}

	updateViewportSize(width, height) {
		console.log(`ResourceManager updating viewport size: ${width}x${height}`);
		
		// Update canvas dimensions
		if (this.canvas) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		
		// Update camera aspect ratio
		if (this.camera) {
			this.camera.updateAspect(width, height);
		}
		
		// Update depth texture
		this.updateDepthTexture(width, height);
		
		// Notify all experiences of the resize
		if (this.experiences) {
			for (const experience of Object.values(this.experiences)) {
				if (experience && typeof experience.handleResize === 'function') {
					experience.handleResize(width, height);
				}
			}
		}
	}

	updateDepthTexture(width, height) {
		// Validate dimensions
		if (!width || !height || width <= 0 || height <= 0) {
			console.warn(`Invalid dimensions for depth texture: ${width}x${height}`);
			return;
		}
		
		try {
			// Clean up existing depth texture if it exists
			if (this.depthTexture) {
				// No need to destroy WebGPU textures, they're automatically garbage collected
				this.depthTexture = null;
				this.depthTextureView = null;
			}
			
			// Create a new depth texture with the updated dimensions
			this.depthTexture = this.device.createTexture({
				size: { width, height, depthOrArrayLayers: 1 },
				format: 'depth24plus',
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			});
			
			// Pre-create the view for faster access
			this.depthTextureView = this.depthTexture.createView();
			console.log(`Depth texture recreated with size ${width}x${height}`);
		} catch (error) {
			console.error("Error creating depth texture:", error);
			this.depthTexture = null;
			this.depthTextureView = null;
		}
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
