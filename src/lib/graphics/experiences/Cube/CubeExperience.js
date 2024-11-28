import BaseExperience from '../BaseExperience';
import Cube from './Cube';
import RenderPipeline3D from '../../pipelines/RenderPipeline3D';
import RenderPipeline2D from '../../pipelines/RenderPipeline2D';

class CubeExperience extends BaseExperience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		// Initialize 2D and 3D pipelines
		this.pipeline2D = new RenderPipeline2D(
			this.device,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer()
		);

		this.pipeline3D = new RenderPipeline3D(
			this.device,
			resourceManager.camera,
			resourceManager.getViewportBuffer(),
			resourceManager.getMouseBuffer()
		);

		this.addCubes();
	}

	async initialize() {
		await this.pipeline2D.initialize();
		await this.pipeline3D.initialize();
	}

	addCubes() {
		const gridSize = 5; // Number of cubes in a grid
		const spacing = 2; // Distance between cubes

		for (let x = -gridSize; x <= gridSize; x++) {
			for (let y = -gridSize; y <= gridSize; y++) {
				for (let z = -gridSize; z <= gridSize; z++) {
					const cube = new Cube(this.device);
					cube.transform = { position: [x * spacing, y * spacing, z * spacing] };
					this.addObject(cube);
				}
			}
		}
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

		// Render the 3D pipeline with a `load`
		const depthView = this.resourceManager.getDepthTextureView();
		const passDescriptor3D = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'load',
					storeOp: 'store'
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

export default CubeExperience;
