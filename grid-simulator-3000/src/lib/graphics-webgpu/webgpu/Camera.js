// Camera.js
import { mat4, vec3 } from 'gl-matrix';

export default class Camera {
  constructor(device, width, height) {
    this.device = device;
    this.projectionMatrix = mat4.create();
    this.viewMatrix = mat4.create();
    this.position = vec3.fromValues(0, 0, 5); // Positioned along z-axis
    this.updateAspect(width, height);
  }

  setBuffers(projectionBuffer, viewBuffer, modelBuffer) {
    this.projectionBuffer = projectionBuffer;
    this.viewBuffer = viewBuffer;
    this.modelBuffer = modelBuffer;
  }

  updateAspect(width, height) {
    this.aspect = width / height;
    this.updateProjection();
  }

  updateProjection(fov = Math.PI / 4, near = 0.1, far = 100) {
    mat4.perspective(this.projectionMatrix, fov, this.aspect, near, far);
    this.updateBuffers(); // Immediately synchronize buffer
  }

  updateView() {
    const target = vec3.fromValues(0, 0, 0); // Looking at the origin
    const up = vec3.fromValues(0, 1, 0); // Y-axis is up
    mat4.lookAt(this.viewMatrix, this.position, target, up);
    this.updateBuffers(); // Immediately synchronize buffer
  }

  updateBuffers() {
    if (this.projectionBuffer && this.viewBuffer && this.device) {
      this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
      this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
    }
  }
}
