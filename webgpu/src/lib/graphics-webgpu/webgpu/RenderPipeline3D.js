// RenderPipeline3D.js
import shaderCode from './shaders/theta3D.wgsl';

let mouseUniformBuffer;
let viewportUniformBuffer;
let depthTexture;
let renderPassDescriptor;
let canvasSize = { width: 0, height: 0 };

export async function createRenderPipeline3D(device, camera) {
	const format = navigator.gpu.getPreferredCanvasFormat();

	const bindGroupLayout = device.createBindGroupLayout({
		label: '3D Bind Group Layout',
		entries: [
			{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
			{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
			{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
			{ binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
			{ binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		bindGroupLayouts: [bindGroupLayout]
	});

	const pipeline = device.createRenderPipeline({
		label: '3D Render Pipeline',
		layout: pipelineLayout,
		vertex: {
			module: device.createShaderModule({ code: shaderCode }),
			entryPoint: 'vertex_main',
			buffers: [
				{
					arrayStride: 12,
					attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
				}
			]
		},
		fragment: {
			module: device.createShaderModule({ code: shaderCode }),
			entryPoint: 'fragment_main',
			targets: [{ format }]
		},
		depthStencil: {
			format: depthFormat,
			depthWriteEnabled: true,
			depthCompare: 'less' // Depth testing mode
		}
	});

	// Create uniform buffers for projection, view, and model matrices
	const projectionBuffer = device.createBuffer({
		label: 'Projection Buffer',
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	const viewBuffer = device.createBuffer({
		label: 'View Buffer',
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	const modelBuffer = device.createBuffer({
		label: 'Model Buffer',
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	// Create the viewport size uniform buffer (2 floats for width, height)
	viewportUniformBuffer = device.createBuffer({
		label: 'Viewport Uniform Buffer',
		size: 16,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	// Create the mouse position uniform buffer (2 floats for x, y)
	mouseUniformBuffer = device.createBuffer({
		label: 'Mouse Uniform Buffer',
		size: 16,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	// Pass buffers to the camera for updating
	camera.setBuffers(projectionBuffer, viewBuffer, modelBuffer);

	// Create bind group for the matrices
	const bindGroup = device.createBindGroup({
		layout: bindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: projectionBuffer } },
			{ binding: 1, resource: { buffer: viewBuffer } },
			{ binding: 2, resource: { buffer: modelBuffer } },
			{ binding: 3, resource: { buffer: viewportUniformBuffer } },
			{ binding: 4, resource: { buffer: mouseUniformBuffer } }
		]
	});

	return { pipeline, bindGroup, vertexBuffer: null, indexBuffer: null };
}

// Update mouse position in the uniform buffer
export function updateMousePosition3d(device, x, y) {
	// console.log(x, y);
	const mousePosition = new Float32Array([x, y]);
	device.queue.writeBuffer(mouseUniformBuffer, 0, mousePosition);
}

export function updateViewportSize3D(device, width, height) {
	canvasSize.width = width;
	canvasSize.height = height;

	const viewportSize = new Float32Array([width, height]);
	device.queue.writeBuffer(viewportUniformBuffer, 0, viewportSize);
}
