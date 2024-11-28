// BirdGeometry.js
export default class BirdGeometry {
	constructor(device) {
		this.device = device;

		// Define bird vertices (body and wings)
		const vertices = new Float32Array([
			// Body - Tail
			0, 0, -20,
			// Body - Bottom
			0, -8, 10,
			// Body - Head
			0, 0, 30,

			// Left Wing
			0, 0, -15, -20, 0, 5, 0, 0, 15,

			// Right Wing
			0, 0, 15, 20, 0, 5, 0, 0, -15
		]);

		// Create vertex buffer
		this.vertexBuffer = device.createBuffer({
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});

		// Write vertices to the GPU buffer
		device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

		this.vertexCount = vertices.length / 3;
	}

	getVertexBuffer() {
		return this.vertexBuffer;
	}

	getVertexCount() {
		return this.vertexCount;
	}
}
