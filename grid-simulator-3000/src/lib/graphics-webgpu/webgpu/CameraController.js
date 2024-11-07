// CameraController.js
import { vec3 } from 'gl-matrix';

export default class CameraController {
  constructor(camera, target = vec3.fromValues(0, 0, 0)) {
    this.camera = camera;
    this.target = target; // The point the camera orbits around
    this.theta = Math.PI / 2; // Horizontal angle
    this.phi = Math.PI / 4;   // Vertical angle
    this.distance = 5.0;      // Distance from the target

    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Update camera position initially
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

      // Update angles based on mouse movement
      this.theta -= deltaX * 0.01; // Adjust sensitivity as needed
      this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * 0.01));

      // Update camera position
      this.updateCameraPosition();

      // Store current mouse position
      this.lastMouseX = x;
      this.lastMouseY = y;
    }
  }

  updateCameraPosition() {
    // Calculate spherical coordinates
    const x = this.target[0] + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.target[1] + this.distance * Math.cos(this.phi);
    const z = this.target[2] + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

    // Update the camera's position
    this.camera.position = vec3.fromValues(x, y, z);
    this.camera.updateView(); // Recalculate view matrix
  }

  updateAspect(width, height) {
    this.camera.updateAspect(width, height); // Update projection matrix on resize
  }
}
