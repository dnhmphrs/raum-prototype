import Experience from '../Experience';
import NeuronGeometry from './NeuronGeometry';
import NeuralNetPipeline from './NeuralNetPipeline';

class NeuralNetExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		this.neuronCount = 10000; // Number of neurons in the network
		this.connections = []; // Store connections between neurons
		this.dendriteCount = 0; // Initialize dendriteCount

		this.addNeurons(); // Add neuron geometries
	}

	async initialize() {
		// Set initial neuron positions
		const positions = Array.from({ length: this.neuronCount }, (_, index) => {
			// Determine if the neuron is in the larger area (10% probability)
			const isInLargerArea = Math.random() < 0.01;

			if (isInLargerArea) {
				// Generate positions in a larger range
				return [
					Math.random() * 2000 - 1000, // X-coordinate in a larger range
					Math.random() * 2000 - 1000, // Y-coordinate in a larger range
					Math.random() * 2000 - 1000 // Z-coordinate in a larger range
				];
			} else {
				// Generate positions in the typical range
				return [
					Math.random() * 500 - 250, // X-coordinate in a typical range
					Math.random() * 500 - 250, // Y-coordinate in a typical range
					Math.random() * 500 - 250 // Z-coordinate in a typical range
				];
			}
		});

		// Generate random connections (~10 per neuron)
		this.connections = Array.from({ length: this.neuronCount }, (_, i) =>
			Array.from({ length: 5 }, () => ({
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
