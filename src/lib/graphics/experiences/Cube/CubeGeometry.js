export default class CubeGeometry {
	constructor(device, minPosition, maxPosition) {
		this.device = device;

		// Define the 8 vertices of the cube
		const vertices = new Float32Array([
			// Back face (z = minPosition[2])
			minPosition[0],
			minPosition[1],
			minPosition[2], // 0: left-bottom-back
			maxPosition[0],
			minPosition[1],
			minPosition[2], // 1: right-bottom-back
			maxPosition[0],
			maxPosition[1],
			minPosition[2], // 2: right-top-back
			minPosition[0],
			maxPosition[1],
			minPosition[2], // 3: left-top-back
			// Front face (z = maxPosition[2])
			minPosition[0],
			minPosition[1],
			maxPosition[2], // 4: left-bottom-front
			maxPosition[0],
			minPosition[1],
			maxPosition[2], // 5: right-bottom-front
			maxPosition[0],
			maxPosition[1],
			maxPosition[2], // 6: right-top-front
			minPosition[0],
			maxPosition[1],
			maxPosition[2] // 7: left-top-front
		]);

		// Define the 12 edges of the cube (24 indices)
		const indices = new Uint16Array([
			// Back face
			0, 1, 1, 2, 2, 3, 3, 0,
			// Front face
			4, 5, 5, 6, 6, 7, 7, 4,
			// Connecting edges
			0, 4, 1, 5, 2, 6, 3, 7
		]);

		// Create vertex buffer
		this.vertexBuffer = this.device.createBuffer({
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
		this.vertexBuffer.unmap();

		// Create index buffer
		this.indexBuffer = this.device.createBuffer({
			size: indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});
		new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
		this.indexBuffer.unmap();

		this.indexCount = indices.length;
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
		if (this.vertexBuffer) this.vertexBuffer.destroy();
		if (this.indexBuffer) this.indexBuffer.destroy();
	}
}
