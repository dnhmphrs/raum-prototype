import Experience from '../Experience';
import NeuronGeometry from './NeuronGeometry';
import NeuralNetPipeline from './NeuralNetPipeline';

class NeuralNetExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		this.neuronCount = 2000; // Number of neurons in the network

		// Initialize the NeuralNet pipeline
		this.pipeline = new NeuralNetPipeline(
			this.device,
			resourceManager.camera,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer(),
			this.neuronCount
		);

		this.addNeurons();
	}

	async initialize() {
		// Initialize the pipeline
		await this.pipeline.initialize();

		// Set initial neuron positions
		const positions = Array.from({ length: this.neuronCount }, () => [
			Math.random() * 200 - 100,
			Math.random() * 200 - 100,
			Math.random() * 200 - 100
		]);
		this.pipeline.updatePositions(positions);
	}

	addNeurons() {
		// Add multiple neurons to the scene
		for (let i = 0; i < this.neuronCount; i++) {
			this.addObject(new NeuronGeometry(this.device));
		}
	}

	render(commandEncoder, textureView) {
		// Update neuron activity phases
		this.pipeline.updateActivity(performance.now());

		// Render the pipeline
		const depthView = this.resourceManager.getDepthTextureView();
		const passDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
				}
			],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store'
			}
		};

		// Pass the neuron count to enable instanced drawing
		this.pipeline.render(commandEncoder, passDescriptor, this.objects, this.neuronCount);
	}

	// cleanup() {
	// 	this.pipeline.cleanup();
	// 	super.cleanup();
	// }
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

export default NeuralNetExperience;
