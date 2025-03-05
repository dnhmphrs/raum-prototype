import Experience from '../Experience';
import RenderPipeline2D from './PoincarePipeline2D';

class PoincareExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		// Initialize 2D and 3D pipelines
		this.pipeline2D = new RenderPipeline2D(
			this.device,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer()
		);
	}

	async initialize() {
		await this.pipeline2D.initialize();
	}

	render(commandEncoder, textureView) {
		// Render the 2D pipeline with a `clear`
		const passDescriptor2D = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 }
				}
			]
		};
		this.pipeline2D.render(commandEncoder, passDescriptor2D);
	}

	cleanup() {
		// Cleanup pipelines
		if (this.pipeline2D) {
			this.pipeline2D.cleanup();
		}
	}
}

export default PoincareExperience;
