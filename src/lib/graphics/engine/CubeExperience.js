import Scene from './Scene';
import Cube from './objects/Cube';

class CubeExperience extends Scene {
	constructor(device, pipelineManager) {
		super(device, pipelineManager);

		this.addCubes();
	}

	addCubes() {
		// Create and position multiple cubes in the scene
		const gridSize = 5; // Number of cubes per row/column
		const spacing = 2; // Spacing between cubes

		for (let x = -gridSize; x <= gridSize; x++) {
			for (let y = -gridSize; y <= gridSize; y++) {
				for (let z = -gridSize; z <= gridSize; z++) {
					const cube = new Cube(this.device);
					// Set object transformation (if applicable)
					cube.transform = {
						position: [x * spacing, y * spacing, z * spacing],
						scale: [1, 1, 1]
					};
					this.addObject(cube);
				}
			}
		}
	}

	render(commandEncoder, textureView) {
		const pipeline = this.pipelineManager.getPipeline('3D');
		if (!pipeline || !pipeline.pipeline) {
			console.error('3D pipeline is not ready for rendering.');
			return;
		}

		const depthView = this.pipelineManager.getDepthTexture();

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

		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
		passEncoder.setPipeline(pipeline.pipeline);
		passEncoder.setBindGroup(0, pipeline.bindGroup);

		this.objects.forEach((object) => {
			passEncoder.setVertexBuffer(0, object.getVertexBuffer());
			passEncoder.setIndexBuffer(object.getIndexBuffer(), 'uint16');
			passEncoder.drawIndexed(object.getIndexCount(), 1, 0, 0);
		});

		passEncoder.end();
	}
}

export default CubeExperience;
