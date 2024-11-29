import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import RenderPipeline3D from '../../pipelines/RenderPipeline3D';

class FlockingExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		// Initialize the 3D render pipeline
		this.pipeline3D = new RenderPipeline3D(
			this.device,
			resourceManager.camera,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer()
		);

		this.addBirds();
	}

	async initialize() {
		// Initialize the 3D pipeline
		await this.pipeline3D.initialize();
	}

	addBirds() {
		// Add multiple birds to the scene
		for (let i = 0; i < 100; i++) {
			this.addObject(new BirdGeometry(this.device));
		}
	}

	render(commandEncoder, textureView) {
		// Render the 3D pipeline
		const depthView = this.resourceManager.getDepthTextureView();

		const passDescriptor3D = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear', // Clear the screen for the first render
					storeOp: 'store',
					clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 } // Dark background
				}
			],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store'
			}
		};

		this.pipeline3D.render(commandEncoder, passDescriptor3D, this.objects);
	}

	cleanup() {
		// Cleanup pipelines
		if (this.pipeline2D) {
			this.pipeline2D.cleanup();
		}
		if (this.pipeline3D) {
			this.pipeline3D.cleanup();
		}

		// Cleanup objects
		this.objects.forEach((object) => {
			if (object.cleanup) {
				object.cleanup();
			}
		});
		this.objects = [];
	}
}

export default FlockingExperience;
