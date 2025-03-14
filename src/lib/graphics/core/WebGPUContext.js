// webgpu/WebGPUContext.js
export async function initializeWebGPU(canvas) {
	// Check if we're in a browser environment
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		console.error('Not in a browser environment, WebGPU is unavailable');
		return { device: null, context: null };
	}

	// Check if WebGPU is supported
	if (!navigator.gpu) {
		console.error('WebGPU is not supported in this browser.');
		return { device: null, context: null };
	}

	try {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			console.error('Failed to get GPU adapter.');
			return { device: null, context: null };
		}

		const device = await adapter.requestDevice();
		const context = canvas.getContext('webgpu');
		
		if (!context) {
			console.error('Failed to get WebGPU context from canvas.');
			return { device, context: null };
		}
		
		const format = navigator.gpu.getPreferredCanvasFormat();

		context.configure({
			device,
			format,
			alphaMode: 'opaque'
		});

		return { device, context };
	} catch (error) {
		console.error('Error initializing WebGPU:', error);
		return { device: null, context: null };
	}
}
