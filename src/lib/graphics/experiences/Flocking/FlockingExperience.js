import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import FlockingPipeline from './FlockingPipeline';

class FlockingExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		this.birdCount = 2000;

		// Initialize the Flocking pipeline
		this.pipeline = new FlockingPipeline(
			this.device,
			resourceManager.camera,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer(),
			this.birdCount
		);

		this.addBirds();
	}

	async initialize() {
		// Initialize the pipeline
		await this.pipeline.initialize();

		// Set initial bird positions
		const positions = Array.from({ length: this.birdCount }, () => [
			Math.random() * 2.0 * this.birdCount - 1.0 * this.birdCount,
			Math.random() * 2.0 * this.birdCount - 1.0 * this.birdCount,
			Math.random() * 2.0 * this.birdCount - 1.0 * this.birdCount
		]);
		this.pipeline.updatePositions(positions);
	}

	addBirds() {
		// Add multiple birds to the scene
		for (let i = 0; i < this.birdCount; i++) {
			this.addObject(new BirdGeometry(this.device));
		}
	}

	render(commandEncoder, textureView) {
		// Update wing phases
		this.pipeline.updatePhases(performance.now());

		// Render the pipeline
		const depthView = this.resourceManager.getDepthTextureView();
		const passDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }
				}
			],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store'
			}
		};

		// Pass the bird count to enable instanced drawing
		this.pipeline.render(commandEncoder, passDescriptor, this.objects, this.birdCount);
	}

	cleanup() {
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
