import { initializeWebGPU } from './engine/WebGPUContext';
import PipelineManager from './engine/PipelineManager';
import Camera from './engine/Camera';
import CameraController from './engine/CameraController';
import InteractionManager from './engine/InteractionManager'; // Import the new manager

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.pipelineManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;
		this.interactionManager = null; // Interaction manager instance
	}

	async start(SceneClass) {
		// Initialize WebGPU
		const { device, context } = await initializeWebGPU(this.canvas);
		this.device = device;
		this.context = context;

		// Initialize Camera and Controller
		this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
		this.cameraController = new CameraController(this.camera);

		// Initialize Pipeline Manager
		this.pipelineManager = new PipelineManager(this.device, this.camera);
		await this.pipelineManager.initialize();

		// Initialize Scene
		this.scene = new SceneClass(this.device, this.pipelineManager);

		// Initialize Interaction Manager
		this.interactionManager = new InteractionManager(this.canvas, this);
		this.interactionManager.initialize();

		// Start rendering loop
		this.render();
	}

	updateViewport(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;

		// Update PipelineManager with new viewport size
		this.pipelineManager.updateViewportSize(width, height);

		// Update camera's aspect ratio
		this.cameraController.updateAspect(width, height);
	}

	render() {
		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.context.getCurrentTexture().createView();

		this.camera.updateBuffers();

		// Render scene via the pipeline manager
		this.scene.render(commandEncoder, textureView);

		// Submit commands to GPU queue
		this.device.queue.submit([commandEncoder.finish()]);

		// Schedule next frame
		requestAnimationFrame(() => this.render());
	}
}

export default Engine;
