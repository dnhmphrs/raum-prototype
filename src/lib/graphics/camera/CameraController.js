// CameraController.js
import { vec3 } from 'gl-matrix';

export default class CameraController {
	constructor(camera, target = vec3.fromValues(0, 0, 0)) {
		this.camera = camera;
		this.target = target;
		this.theta = Math.PI / 2;
		this.phi = Math.PI / 4;
		this.currentZoom = 1.0;
		this.baseDistance = 4000.0; // Base distance from target
		this.distance = this.baseDistance; // Initial distance set by zoom

		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;

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

	adjustZoom(deltaZoom) {
		const sensitivity = 0.001; // Zoom sensitivity
		const minZoom = 0.1; // Minimum zoom level
		const maxZoom = 100.0; // Maximum zoom level

		// Adjust the current zoom level and clamp it
		this.currentZoom = Math.min(
			Math.max(this.currentZoom + deltaZoom * sensitivity, minZoom),
			maxZoom
		);

		// Update the distance based on the current zoom
		this.distance = this.baseDistance * this.currentZoom;

		// Update the camera position to reflect the new zoom level
		this.updateCameraPosition();
	}

	handleMouseMove(x, y) {
		if (this.isDragging) {
			const deltaX = x - this.lastMouseX;
			const deltaY = y - this.lastMouseY;

			const sensitivity = 10.0;

			this.theta -= deltaX * sensitivity;
			this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * sensitivity));

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
