// Camera.js
import { mat4, vec3 } from 'gl-matrix';

export default class Camera {
	constructor(device, width, height) {
		this.device = device;
		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();
		this.position = vec3.fromValues(0, 0, 0); // Positioned along the z-axis
		this.aspect = width / height;

		// Initialize buffers
		this.projectionBuffer = this.createBuffer(64);
		this.viewBuffer = this.createBuffer(64);
		this.modelBuffer = this.createBuffer(64); // Placeholder, can be updated later

		// Set initial projection and view matrices
		this.updateProjection();
		this.updateView();
	}

	createBuffer(size) {
		return this.device.createBuffer({
			size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Camera Buffer'
		});
	}

	getBuffers() {
		return {
			projectionBuffer: this.projectionBuffer,
			viewBuffer: this.viewBuffer,
			modelBuffer: this.modelBuffer
		};
	}

	updateAspect(width, height) {
		this.aspect = width / height;
		this.updateProjection();
	}

	updateProjection(fov = Math.PI / 4, near = 0.1, far = 100000) {
		mat4.perspective(this.projectionMatrix, fov, this.aspect, near, far);
		this.updateBuffers(); // Synchronize buffer with projection matrix
	}

	updateView() {
		const target = vec3.fromValues(0, 0, 0); // Looking at the origin
		const up = vec3.fromValues(0, 1, 0); // Y-axis is up
		mat4.lookAt(this.viewMatrix, this.position, target, up);
		this.updateBuffers(); // Synchronize buffer with view matrix
	}

	updateBuffers() {
		if (this.device) {
			this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
			this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
		}
	}

	cleanup() {
		// Destroy buffers
		if (this.projectionBuffer) {
			this.projectionBuffer.destroy();
			this.projectionBuffer = null;
		}
		if (this.viewBuffer) {
			this.viewBuffer.destroy();
			this.viewBuffer = null;
		}
		if (this.modelBuffer) {
			this.modelBuffer.destroy();
			this.modelBuffer = null;
		}
	}
}
