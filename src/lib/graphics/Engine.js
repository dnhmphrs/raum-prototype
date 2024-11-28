import { initializeWebGPU } from './engine/WebGPUContext';
import PipelineManager from './engine/PipelineManager';
import Scene from './engine/Scene';
import Camera from './engine/Camera';
import CameraController from './engine/CameraController';
import { viewportSize, mousePosition, zoom } from '$lib/store/store';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.pipelineManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;

		// State management for interactions
		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
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

		// Set up interactions
		this.setupInteractions();

		// Start rendering loop
		this.render();
	}

	setupInteractions() {
		// Handle viewport resizing
		viewportSize.subscribe(({ width, height }) => {
			if (this.device) this.updateViewport(width, height);
		});

		// Update mouse position in pipelines
		mousePosition.subscribe(({ x, y }) => {
			this.pipelineManager.updateMousePosition(x, y);
		});

		// Mouse interactions for camera control
		window.addEventListener('mousedown', (e) => {
			this.isDragging = true;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;
			this.cameraController.startDrag(e.clientX, e.clientY);
		});

		window.addEventListener('mousemove', (e) => {
			if (this.isDragging) {
				const deltaX = e.clientX - this.lastMouseX;
				const deltaY = e.clientY - this.lastMouseY;
				this.lastMouseX = e.clientX;
				this.lastMouseY = e.clientY;
				this.cameraController.handleMouseMove(deltaX, deltaY);
			}
		});

		window.addEventListener('mouseup', () => {
			this.isDragging = false;
			this.cameraController.endDrag();
		});

		// Zoom control using mouse wheel
		window.addEventListener('wheel', (e) => {
			zoom.update((currentZoom) => Math.min(Math.max(currentZoom - e.deltaY * 0.001, 0.5), 2.0));
		});
	}

	updateViewport(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.pipelineManager.updateViewportSize(width, height);
		this.cameraController.updateAspect(width, height);

		// Reinitialize the depth texture with the new dimensions
		this.pipelineManager.initializeDepthTexture(width, height);
	}

	render() {
		// Create command encoder
		const commandEncoder = this.device.createCommandEncoder();

		// Get texture view from the WebGPU context
		const textureView = this.context.getCurrentTexture().createView();

		// Update camera buffers
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
