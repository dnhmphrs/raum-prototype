import Scene from '../../engine/Scene';
import Cube from './Cube';

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
		// Render the 2D pipeline first
		const pipeline2D = this.pipelineManager.getPipeline('2D');
		if (pipeline2D && pipeline2D.pipeline) {
			const passDescriptor2D = {
				colorAttachments: [
					{
						view: textureView,
						loadOp: 'clear',
						storeOp: 'store',
						clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 } // Background color
					}
				]
			};

			const passEncoder2D = commandEncoder.beginRenderPass(passDescriptor2D);
			passEncoder2D.setPipeline(pipeline2D.pipeline);
			passEncoder2D.setBindGroup(0, pipeline2D.bindGroup);
			passEncoder2D.draw(3, 1, 0, 0); // Fullscreen triangle for 2D pipeline
			passEncoder2D.end();
		} else {
			console.error('2D pipeline is not ready for rendering.');
		}

		// Render the 3D pipeline next
		const pipeline3D = this.pipelineManager.getPipeline('3D');
		if (pipeline3D && pipeline3D.pipeline) {
			const depthView = this.pipelineManager.getDepthTexture();

			const passDescriptor3D = {
				colorAttachments: [
					{
						view: textureView,
						loadOp: 'load', // Preserve the 2D render
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

			const passEncoder3D = commandEncoder.beginRenderPass(passDescriptor3D);
			passEncoder3D.setPipeline(pipeline3D.pipeline);
			passEncoder3D.setBindGroup(0, pipeline3D.bindGroup);

			this.objects.forEach((object) => {
				passEncoder3D.setVertexBuffer(0, object.getVertexBuffer());
				passEncoder3D.setIndexBuffer(object.getIndexBuffer(), 'uint16');
				passEncoder3D.drawIndexed(object.getIndexCount(), 1, 0, 0);
			});

			passEncoder3D.end();
		} else {
			console.error('3D pipeline is not ready for rendering.');
		}
	}
}

export default CubeExperience;
