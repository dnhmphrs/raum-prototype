import { mousePosition, viewportSize, zoom } from '$lib/store/store';

class InteractionManager {
	constructor(canvas, engine) {
		this.canvas = canvas;
		this.engine = engine; // Reference to the Engine
		this.isDragging = false;

		this.lastMouseX = 0;
		this.lastMouseY = 0;
	}

	initialize() {
		// Set up event listeners
		window.addEventListener('resize', this.handleResize.bind(this));
		window.addEventListener('mousemove', this.handleMouseMove.bind(this));
		window.addEventListener('mousedown', this.handleMouseDown.bind(this));
		window.addEventListener('mouseup', this.handleMouseUp.bind(this));
		window.addEventListener('wheel', this.handleMouseWheel.bind(this));

		// Trigger initial resize
		this.handleResize();
	}

	destroy() {
		// Clean up event listeners
		window.removeEventListener('resize', this.handleResize.bind(this));
		window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
		window.removeEventListener('mousedown', this.handleMouseDown.bind(this));
		window.removeEventListener('mouseup', this.handleMouseUp.bind(this));
		window.removeEventListener('wheel', this.handleMouseWheel.bind(this));
	}

	handleResize() {
		const devicePixelRatio = window.devicePixelRatio || 1;
		const width = Math.floor(this.canvas.clientWidth * devicePixelRatio);
		const height = Math.floor(this.canvas.clientHeight * devicePixelRatio);

		viewportSize.set({ width, height });

		// Notify the engine to update viewport-dependent components
		if (this.engine) {
			this.engine.updateViewport(width, height);
		}
	}

	handleMouseMove(event) {
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left) / rect.width;
		const mouseY = (event.clientY - rect.top) / rect.height;

		mousePosition.set({ x: mouseX, y: mouseY });

		// If dragging, notify the engine's camera controller
		if (this.isDragging && this.engine) {
			this.engine.cameraController.handleMouseMove(mouseX, mouseY);
		}
	}

	handleMouseDown(event) {
		this.isDragging = true;

		const rect = this.canvas.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left) / rect.width;
		const mouseY = (event.clientY - rect.top) / rect.height;

		mousePosition.set({ x: mouseX, y: mouseY });

		// Notify the engine's camera controller
		if (this.engine) {
			this.engine.cameraController.startDrag(mouseX, mouseY);
		}
	}

	handleMouseUp() {
		this.isDragging = false;

		// Notify the engine's camera controller
		if (this.engine) {
			this.engine.cameraController.endDrag();
		}
	}

	handleMouseWheel(event) {
		const zoomSpeed = -0.001; // Adjust for sensitivity
		const exponentialZoomFactor = 1.1; // Multiplier for exponential zooming

		zoom.update((currentZoom) => {
			// Adjust zoom using exponential scaling
			let newZoom =
				currentZoom *
				(event.deltaY * zoomSpeed < 0 ? exponentialZoomFactor : 1 / exponentialZoomFactor);

			// Optional: Limit zoom range (remove or adjust for flexibility)
			const minZoom = 0.1; // Allow further zoom out
			const maxZoom = 10.0; // Allow deeper zoom in
			newZoom = Math.min(Math.max(newZoom, minZoom), maxZoom);

			return newZoom;
		});
	}
}

export default InteractionManager;
