export default class Disc {
	constructor(device) {
		this.device = device;

		// Define vertex data for a cube with larger dimensions to match the bird's size
		this.vertices = new Float32Array([
			// Front face
			-100.0, -100.0, 100.0, 100.0, -100.0, 100.0, 100.0, 100.0, 100.0, -100.0, 100.0, 100.0,
			// Back face
			-100.0, -100.0, -100.0, 100.0, -100.0, -100.0, 100.0, 100.0, -100.0, -100.0, 100.0, -100.0
		]);

		this.indices = new Uint16Array([
			// Front face
			0, 1, 2, 0, 2, 3,
			// Back face
			4, 5, 6, 4, 6, 7,
			// Top face
			3, 2, 6, 3, 6, 7,
			// Bottom face
			0, 1, 5, 0, 5, 4,
			// Right face
			1, 2, 6, 1, 6, 5,
			// Left face
			0, 3, 7, 0, 7, 4
		]);

		// Initialize buffers
		this.vertexBuffer = this.device.createBuffer({
			size: this.vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(this.vertices);
		this.vertexBuffer.unmap();

		this.indexBuffer = this.device.createBuffer({
			size: this.indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Uint16Array(this.indexBuffer.getMappedRange()).set(this.indices);
		this.indexBuffer.unmap();

		this.indexCount = this.indices.length;
	}

	getVertexBuffer() {
		return this.vertexBuffer;
	}

	getIndexBuffer() {
		return this.indexBuffer;
	}

	getIndexCount() {
		return this.indexCount;
	}

	cleanup() {
		if (this.vertexBuffer) {
			this.vertexBuffer.destroy();
			this.vertexBuffer = null;
		}
		if (this.indexBuffer) {
			this.indexBuffer.destroy();
			this.indexBuffer = null;
		}
	}
}
