// RenderPipeline2D.js
import shaderCode from './shaders/theta2D.wgsl';

export async function createRenderPipeline2D(device, viewportBuffer, mouseBuffer) {
	const format = navigator.gpu.getPreferredCanvasFormat();

	const bindGroupLayout = device.createBindGroupLayout({
		label: 'Uniform Bind Group Layout',
		entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
		]
	});

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

	const bindGroup = device.createBindGroup({
		label: 'Uniform Bind Group',
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: viewportBuffer } },
			{ binding: 1, resource: { buffer: mouseBuffer } }
		]
	});

	return {
		pipeline,
		bindGroup,
		updateMousePosition(device, x, y) {
			const mousePosition = new Float32Array([x, y]);
			device.queue.writeBuffer(mouseBuffer, 0, mousePosition);
		},
		updateViewportSize(device, width, height) {
			const viewportSize = new Float32Array([width, height]);
			device.queue.writeBuffer(viewportBuffer, 0, viewportSize);
		}
	};
}
