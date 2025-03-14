// webgpu/WebGPUContext.js
export async function initializeWebGPU(canvas) {
	if (!navigator.gpu) {
		console.error('WebGPU is not supported in this browser.');
		return;
	}

	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		console.error('Failed to get GPU adapter.');
		return;
	}

	const device = await adapter.requestDevice();
	const context = canvas.getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat(); // Updated here

	context.configure({
		device,
		format,
		alphaMode: 'opaque'
	});

	return { device, context };
}
