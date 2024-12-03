import Experience from '../Experience';
import NeuronGeometry from './NeuronGeometry';
import CubeGeometry from './CubeGeometry';
import NeuralNetPipeline from './NeuralNetPipeline';

class NeuralNetExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		this.neuronCount = 1600; // Number of neurons in the network
		this.connections = []; // Store connections between neurons
		this.dendriteCount = 0; // Initialize dendriteCount

		this.addNeurons(); // Add neuron geometries
	}

	async initialize() {
		const positions = Array.from({ length: this.neuronCount }, () => {
			// Skew factor less than 1 increases density towards edges
			const skewFactor = 1.125; // Adjust this value between 0 and 1

			const randomSkewedTowardsEdges = (min, max, skewFactor) => {
				const u = Math.random();
				const skewed_u =
					u < 0.5 ? 0.5 * Math.pow(2 * u, skewFactor) : 1 - 0.5 * Math.pow(2 * (1 - u), skewFactor);
				return min + (max - min) * skewed_u;
			};

			const x = randomSkewedTowardsEdges(-200, 200, skewFactor);
			const y = randomSkewedTowardsEdges(-50, 50, skewFactor); // Y is narrow
			const z = randomSkewedTowardsEdges(-200, 200, skewFactor);

			return [x, y, z];
		});

		// Generate random connections (~10 per neuron)
		this.connections = Array.from({ length: this.neuronCount }, (_, i) =>
			Array.from({ length: 5 }, () => ({
				source: i,
				target: Math.floor(Math.random() * this.neuronCount)
			}))
		).flat();

		const minPosition = [-200, -50, -200];
		const maxPosition = [200, 50, 200];

		// Create the cube geometry
		this.cube = new CubeGeometry(this.device, minPosition, maxPosition);

		const minLargerPosition = [-5000, -5000, -5000]; // Larger cube boundaries
		const maxLargerPosition = [5000, 5000, 5000];

		// Calculate 5% of the existing connections
		const extraConnectionCount = Math.floor(this.connections.length * 0.1);
		const extraDendritePositions = [];

		const skewFactor = 0.5; // Adjust this value between 0 and 1

		for (let i = 0; i < extraConnectionCount; i++) {
			const randomSkewedTowardsEdges = (min, max, skewFactor) => {
				const u = Math.random();
				const skewed_u =
					u < 0.5 ? 0.5 * Math.pow(2 * u, skewFactor) : 1 - 0.5 * Math.pow(2 * (1 - u), skewFactor);
				return min + (max - min) * skewed_u;
			};

			// Select a random source position from the existing neurons
			const sourcePosition = [
				randomSkewedTowardsEdges(minLargerPosition[0], maxLargerPosition[0], skewFactor),
				randomSkewedTowardsEdges(minLargerPosition[1], maxLargerPosition[1], skewFactor),
				randomSkewedTowardsEdges(minLargerPosition[2], maxLargerPosition[2], skewFactor)
			];

			// Generate a target position skewed towards the center of the larger cube
			const targetPosition = [
				randomSkewedTowardsEdges(minLargerPosition[0], maxLargerPosition[0], skewFactor),
				randomSkewedTowardsEdges(minLargerPosition[1], maxLargerPosition[1], skewFactor),
				randomSkewedTowardsEdges(minLargerPosition[2], maxLargerPosition[2], skewFactor)
			];

			// Store the positions of the source and target
			extraDendritePositions.push({
				sourcePosition: sourcePosition,
				targetPosition: targetPosition
			});
		}

		// 	// Store the positions of the source and target
		// 	extraDendritePositions.push({
		// 		sourcePosition: sourcePosition,
		// 		targetPosition: targetPosition
		// 	});
		// }

		this.dendriteCount = this.connections.length + extraDendritePositions.length;

		// Initialize the pipeline AFTER connections are generated
		this.pipeline = new NeuralNetPipeline(
			this.device,
			this.resourceManager.camera,
			this.resourceManager.getViewportBuffer(),
			this.resourceManager.getMouseBuffer(),
			this.neuronCount,
			this.dendriteCount,
			this.cube
		);
		await this.pipeline.initialize();

		// Pass positions and connections to the pipeline
		this.pipeline.updatePositions(positions);
		this.pipeline.updateConnections(this.connections, positions, extraDendritePositions);
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
