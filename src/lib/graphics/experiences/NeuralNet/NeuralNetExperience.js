import Experience from '../Experience';
import NeuronGeometry from './NeuronGeometry';
import NeuralNetPipeline from './NeuralNetPipeline';

class NeuralNetExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		this.neuronCount = 5000; // Number of neurons in the network
		this.connections = []; // Store connections between neurons
		this.dendriteCount = 0; // Initialize dendriteCount

		this.addNeurons(); // Add neuron geometries
	}

	async initialize() {
		// Set initial neuron positions
		const positions = Array.from({ length: this.neuronCount }, () => [
			Math.random() * 200 - 100,
			Math.random() * 200 - 100,
			Math.random() * 200 - 100
		]);

		// Generate random connections (~10 per neuron)
		this.connections = Array.from({ length: this.neuronCount }, (_, i) =>
			Array.from({ length: 10 }, () => ({
				source: i,
				target: Math.floor(Math.random() * this.neuronCount)
			}))
		).flat();

		this.dendriteCount = this.connections.length; // Calculate total dendrites

		// Initialize the pipeline AFTER connections are generated
		this.pipeline = new NeuralNetPipeline(
			this.device,
			this.resourceManager.camera,
			this.resourceManager.getViewportBuffer(),
			this.resourceManager.getMouseBuffer(),
			this.neuronCount,
			this.dendriteCount
		);
		await this.pipeline.initialize();

		// Pass positions and connections to the pipeline
		this.pipeline.updatePositions(positions);
		this.pipeline.updateConnections(this.connections, positions);
	}

	addNeurons() {
		// Add neurons to the scene
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
					clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 }
				}
			],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store'
			}
		};

		// Pass the neuron count and connections for instanced drawing
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
