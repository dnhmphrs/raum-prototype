import { initializeWebGPU } from './core/WebGPUContext';
import Camera from './camera/Camera';
import CameraController from './camera/CameraController';
import InteractionManager from './core/InteractionManager';
import ResourceManager from './core/ResourceManager';

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
	}

	async start(SceneClass) {
		// Reinitialize WebGPU context
		const { device, context } = await initializeWebGPU(this.canvas);
		this.device = device;
		this.context = context;

		// Initialize Camera and Controller
		this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
		this.cameraController = new CameraController(this.camera);

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
		// Cancel the rendering loop
		if (this.frameId) {
			cancelAnimationFrame(this.frameId);
			this.frameId = null;
		}

		// Cleanup scene
		if (this.scene && this.scene.cleanup) {
			this.scene.cleanup();
		}

		// Cleanup resource manager
		if (this.resourceManager && this.resourceManager.cleanup) {
			this.resourceManager.cleanup();
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
		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.context.getCurrentTexture().createView();

		// Render scene
		this.scene.render(commandEncoder, textureView);

		// Submit commands to GPU queue
		this.device.queue.submit([commandEncoder.finish()]);

		// Schedule next frame
		this.frameId = requestAnimationFrame(() => this.render());
	}
}

export default Engine;
