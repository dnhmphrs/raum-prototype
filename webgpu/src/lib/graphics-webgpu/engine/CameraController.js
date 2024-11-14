// CameraController.js
import { vec3 } from 'gl-matrix';
import { zoom } from '$lib/store/store.js'; // Import the zoom store

export default class CameraController {
	constructor(camera, target = vec3.fromValues(0, 0, 0)) {
		this.camera = camera;
		this.target = target;
		this.theta = Math.PI / 2;
		this.phi = Math.PI / 4;
		this.baseDistance = 5.0; // Base distance from target
		this.distance = this.baseDistance; // Initial distance set by zoom

		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;

		// Subscribe to zoom store to adjust camera distance
		zoom.subscribe((newZoom) => {
			this.distance = this.baseDistance * newZoom;
			this.updateCameraPosition();
		});

		// Initial camera position update
		this.updateCameraPosition();
	}

	startDrag(x, y) {
		this.isDragging = true;
		this.lastMouseX = x;
		this.lastMouseY = y;
	}

	endDrag() {
		this.isDragging = false;
	}

	handleMouseMove(x, y) {
		if (this.isDragging) {
			const deltaX = x - this.lastMouseX;
			const deltaY = y - this.lastMouseY;

			this.theta -= deltaX * 0.01;
			this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * 0.01));

			this.updateCameraPosition();

			this.lastMouseX = x;
			this.lastMouseY = y;
		}
	}

	updateCameraPosition() {
		const x = this.target[0] + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
		const y = this.target[1] + this.distance * Math.cos(this.phi);
		const z = this.target[2] + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

		this.camera.position = vec3.fromValues(x, y, z);
		this.camera.updateView();
	}

	updateAspect(width, height) {
		this.camera.updateAspect(width, height);
	}
}
