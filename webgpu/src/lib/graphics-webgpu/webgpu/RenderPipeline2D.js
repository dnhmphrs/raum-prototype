// webgpu/RenderPipeline2D.js
// import shaderCode from './shaders/basic2D.wgsl';
import shaderCode from './shaders/theta2D.wgsl';

let mouseUniformBuffer;
let viewportUniformBuffer;
let bindGroupLayout;
let bindGroup;

export async function createRenderPipeline2D(device) {
	const format = navigator.gpu.getPreferredCanvasFormat();

	// Define a bind group layout with two bindings
	bindGroupLayout = device.createBindGroupLayout({
		label: 'Uniform Bind Group Layout',
		entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
		]
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

	// Create the render pipeline with vertex and fragment shaders
	const pipeline = device.createRenderPipeline({
		label: 'Main Pipeline',
		layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
		vertex: {
			module: device.createShaderModule({ label: 'Vertex Shader', code: shaderCode }),
			entryPoint: 'vertex_main'
		},
		fragment: {
			module: device.createShaderModule({ label: 'Fragment Shader', code: shaderCode }),
			entryPoint: 'fragment_main',
			targets: [{ format }]
		}
	});

	// Create a bind group to pass the uniform buffers to the shaders
	bindGroup = device.createBindGroup({
		label: 'Uniform Bind Group',
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: viewportUniformBuffer } },
			{ binding: 1, resource: { buffer: mouseUniformBuffer } }
		]
	});

	return { pipeline, bindGroup };
}

// Function to update viewport size in the uniform buffer
export function updateViewportSize(device, width, height) {
	const viewportSize = new Float32Array([width, height]);
	device.queue.writeBuffer(viewportUniformBuffer, 0, viewportSize);
}

// Update mouse position in the uniform buffer
export function updateMousePosition(device, x, y) {
	// console.log(x, y);
	const mousePosition = new Float32Array([x, y]);
	device.queue.writeBuffer(mouseUniformBuffer, 0, mousePosition);
}
