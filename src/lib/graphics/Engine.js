import { initializeWebGPU } from './core/WebGPUContext';
import Camera from './camera/Camera';
import CameraController from './camera/CameraController';
import InteractionManager from './core/InteractionManager';
import ResourceManager from './core/ResourceManager';
import { vec3 } from 'gl-matrix';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.resourceManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;
		this.interactionManager = null;
		this.currentExperience = null;
		this.animationFrameId = null;
	}

	async start(SceneClass, cameraConfig = {}) {
		// Reinitialize WebGPU context
		const { device, context } = await initializeWebGPU(this.canvas);
		this.device = device;
		this.context = context;

		// Initialize Camera and Controller with config
		this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight, cameraConfig);
		this.cameraController = new CameraController(this.camera, vec3.fromValues(0, 0, 0), cameraConfig);

		// Initialize Shared Resource Manager
		this.resourceManager = new ResourceManager(this.device, this.camera);
		this.resourceManager.initialize(this.canvas.width, this.canvas.height);

		// Initialize Scene
		this.scene = new SceneClass(this.device, this.resourceManager);
		await this.scene.initialize();

		// Initialize Interaction Manager
		this.interactionManager = new InteractionManager(this.canvas, this);
		this.interactionManager.initialize();

		// Start rendering loop
		this.render();
	}

	updateViewport(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;

		// Update ResourceManager with new viewport size
		this.resourceManager.updateViewportSize(width, height);

		// Update camera's aspect ratio
		this.cameraController.updateAspect(width, height);

		// Update the scene if it has an onResize method
		if (this.scene && this.scene.onResize) {
			this.scene.onResize(width, height);
		}
	}

	cleanup() {
		if (this.currentExperience) {
			this.currentExperience.cleanup();
			this.currentExperience = null;
		}
		
		if (this.resourceManager) {
			this.resourceManager.cleanup();
		}
		
		// Stop animation frame if it's running
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		
		// Cleanup interaction manager
		if (this.interactionManager && this.interactionManager.destroy) {
			this.interactionManager.destroy();
		}

		// Cleanup camera and controller
		if (this.camera && this.camera.cleanup) {
			this.camera.cleanup();
		}
		if (this.cameraController && this.cameraController.cleanup) {
			this.cameraController.cleanup();
		}

		// Reset device and context
		this.device = null;
		this.context = null;
	}

	render() {
		try {
			const commandEncoder = this.device.createCommandEncoder();
			const textureView = this.context.getCurrentTexture().createView();
			
			// Log texture dimensions
			const texture = this.context.getCurrentTexture();
			console.log(`Rendering to texture: ${texture.width}x${texture.height}`);
			
			// Render scene
			this.scene.render(commandEncoder, textureView);
			
			// Submit commands to GPU queue
			this.device.queue.submit([commandEncoder.finish()]);
			
			// Schedule next frame
			this.animationFrameId = requestAnimationFrame(() => this.render());
		} catch (error) {
			console.error("Error in render loop:", error);
		}
	}

	handleResize() {
		console.log("Engine handleResize called");
		
		// Update canvas size
		if (this.canvas) {
			const width = window.innerWidth;
			const height = window.innerHeight;
			
			this.canvas.width = width;
			this.canvas.height = height;
			console.log(`Canvas resized to ${width}x${height}`);
			
			// Update viewport if needed
			if (this.resourceManager && this.resourceManager.updateViewportSize) {
				this.resourceManager.updateViewportSize(width, height);
			}
		}
		
		// Call resize on scene if it exists
		if (this.scene && typeof this.scene.handleResize === 'function') {
			this.scene.handleResize();
		}
	}
}

export default Engine;
