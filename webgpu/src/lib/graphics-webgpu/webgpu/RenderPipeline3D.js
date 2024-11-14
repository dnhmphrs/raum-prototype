// RenderPipeline3D.js
import shaderCode from './shaders/theta3D.wgsl';

// RenderPipeline3D.js
export async function createRenderPipeline3D(device, camera, viewportBuffer, mouseBuffer) {
	const format = navigator.gpu.getPreferredCanvasFormat();
	const { projectionBuffer, viewBuffer, modelBuffer } = camera.getBuffers();

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

	const pipeline = device.createRenderPipeline({
		label: '3D Render Pipeline',
		layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
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
			format: 'depth24plus', // Match depth texture format
			depthWriteEnabled: true,
			depthCompare: 'less' // Objects closer to the camera will overwrite farther ones
		}
	});

	const bindGroup = device.createBindGroup({
		layout: bindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: projectionBuffer } },
			{ binding: 1, resource: { buffer: viewBuffer } },
			{ binding: 2, resource: { buffer: modelBuffer } },
			{ binding: 3, resource: { buffer: viewportBuffer } },
			{ binding: 4, resource: { buffer: mouseBuffer } }
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
