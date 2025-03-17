export default class BirdGeometry {
	constructor(device) {
		this.device = device;
		this.isVisible = true;

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

		// Pad vertices to ensure buffer size is a multiple of 4
		const vertexByteSize = vertices.byteLength;
		const alignedVertexSize = Math.ceil(vertexByteSize / 4) * 4; // Align to 4 bytes
		const paddedVertices = new Float32Array(alignedVertexSize / 4); // Divide by 4 to get Float32 count
		paddedVertices.set(vertices);

		// Define indices for indexed drawing
		this.indices = new Uint16Array([
			// Body
			0,
			1,
			2, // Tail to bottom to head
			// Left Wing
			3,
			4,
			5,
			// Right Wing
			6,
			7,
			8
		]);

		const indexByteSize = this.indices.byteLength;
		const alignedIndexSize = Math.ceil(indexByteSize);
		const paddedIndices = new Uint16Array(alignedIndexSize);
		paddedIndices.set(this.indices);

		// Create vertex buffer
		this.vertexBuffer = this.device.createBuffer({
			size: paddedVertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(paddedVertices);
		this.vertexBuffer.unmap();

		// Create index buffer
		this.indexBuffer = this.device.createBuffer({
			size: paddedIndices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Uint16Array(this.indexBuffer.getMappedRange()).set(paddedIndices);
		this.indexBuffer.unmap();

		this.indexCount = this.indices.length;
	}

	setVisible(visible) {
		this.isVisible = visible;
	}

	isVisible() {
		return this.isVisible;
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
		if (this.instanceBuffer) {
			this.instanceBuffer.destroy();
			this.instanceBuffer = null;
		}
	}
}