import { mat4 } from 'gl-matrix';
import { createShaderProgram, setupBuffer } from './UtilFunctions';

const simpleVertShaderSource = `
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const simpleFragShaderSource = `
  precision highp float;
  uniform vec4 color;
  void main() {
    gl_FragColor = color;
  }
`;

export function setupBox(gl) {
	const program = createShaderProgram(gl, simpleVertShaderSource, simpleFragShaderSource);

	// Define a simple 3D cube
	const cubeVertices = [
		// Front face
		-0.5,
		-0.5,
		0.5, // 0
		0.5,
		-0.5,
		0.5, // 1
		0.5,
		0.5,
		0.5, // 2
		-0.5,
		0.5,
		0.5, // 3

		// Back face
		-0.5,
		-0.5,
		-0.5, // 4
		-0.5,
		0.5,
		-0.5, // 5
		0.5,
		0.5,
		-0.5, // 6
		0.5,
		-0.5,
		-0.5, // 7

		// Top face
		-0.5,
		0.5,
		-0.5, // 5
		-0.5,
		0.5,
		0.5, // 3
		0.5,
		0.5,
		0.5, // 2
		0.5,
		0.5,
		-0.5, // 6

		// Bottom face
		-0.5,
		-0.5,
		-0.5, // 4
		0.5,
		-0.5,
		-0.5, // 7
		0.5,
		-0.5,
		0.5, // 1
		-0.5,
		-0.5,
		0.5, // 0

		// Right face
		0.5,
		-0.5,
		-0.5, // 7
		0.5,
		0.5,
		-0.5, // 6
		0.5,
		0.5,
		0.5, // 2
		0.5,
		-0.5,
		0.5, // 1

		// Left face
		-0.5,
		-0.5,
		-0.5, // 4
		-0.5,
		-0.5,
		0.5, // 0
		-0.5,
		0.5,
		0.5, // 3
		-0.5,
		0.5,
		-0.5 // 5
	];

	const cubeIndices = [
		0,
		1,
		2,
		0,
		2,
		3, // Front
		4,
		5,
		6,
		4,
		6,
		7, // Back
		8,
		9,
		10,
		8,
		10,
		11, // Top
		12,
		13,
		14,
		12,
		14,
		15, // Bottom
		16,
		17,
		18,
		16,
		18,
		19, // Right
		20,
		21,
		22,
		20,
		22,
		23 // Left
	];
	const boxBuffer = setupBuffer(gl, cubeVertices);

	// Create and bind the element array buffer for cube indices
	const cubeIndexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);

	const positionAttributeLocation = gl.getAttribLocation(program, 'position');
	const colorUniformLocation = gl.getUniformLocation(program, 'color');
	const modelViewMatrixUniformLocation = gl.getUniformLocation(program, 'modelViewMatrix');
	const projectionMatrixUniformLocation = gl.getUniformLocation(program, 'projectionMatrix');

	return {
		program,
		boxBuffer,
		positionAttributeLocation,
		colorUniformLocation,
		modelViewMatrixUniformLocation,
		projectionMatrixUniformLocation,
		cubeIndexBuffer
	};
}

export function drawBox(gl, box, color, time, aspectRatio) {
	gl.useProgram(box.program);

	// Set up the model view matrix for rotation
	let modelViewMatrix = mat4.create();
	mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -6]); // Move the cube back in Z so we can see it

	// Rotate the cube
	mat4.rotate(modelViewMatrix, modelViewMatrix, time * 0.0005, [1, 0, 0]); // Rotate around x-axis
	mat4.rotate(modelViewMatrix, modelViewMatrix, time * 0.0005, [0, 1, 0]); // Rotate around y-axis
	mat4.rotate(modelViewMatrix, modelViewMatrix, time * 0.0005, [0, 0, 1]); // Rotate around z-axis

	// Set up a perspective projection matrix
	let projectionMatrix = mat4.create();
	mat4.perspective(projectionMatrix, Math.PI / 4, aspectRatio, 0.1, 100.0);

	gl.uniformMatrix4fv(box.modelViewMatrixUniformLocation, false, modelViewMatrix);
	gl.uniformMatrix4fv(box.projectionMatrixUniformLocation, false, projectionMatrix);

	// Bind the vertex and index buffers
	gl.bindBuffer(gl.ARRAY_BUFFER, box.boxBuffer);
	gl.vertexAttribPointer(box.positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(box.positionAttributeLocation);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, box.cubeIndexBuffer);

	// Set the color uniform and draw the cube
	gl.uniform4f(box.colorUniformLocation, ...color, 1.0);
	gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

export function cleanupBox(gl, box) {
	gl.deleteBuffer(box.boxBuffer);
	gl.deleteBuffer(box.cubeIndexBuffer);
	gl.deleteProgram(box.program);
}
