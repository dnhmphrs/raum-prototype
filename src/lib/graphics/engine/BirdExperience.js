import Scene from './Scene';
import BirdGeometry from './BirdGeometry';

class BirdExperience extends Scene {
	constructor(device, pipelineManager) {
		super(device, pipelineManager);

		this.addBirds();
	}

	addBirds() {
		for (let i = 0; i < 100; i++) {
			this.addObject(new BirdGeometry(this.device));
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
			passEncoder.draw(object.getVertexCount(), 1, 0, 0);
		});

		passEncoder.end();

		// Run the compute pipeline to update bird positions
		// const computePipeline = this.pipelineManager.getPipeline('Compute');
		// if (computePipeline) {
		// 	computePipeline.run();
		// }
	}
}

export default BirdExperience;
