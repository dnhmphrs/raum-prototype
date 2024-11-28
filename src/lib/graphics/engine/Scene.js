class Scene {
	constructor(device, pipelineManager) {
		this.device = device;
		this.pipelineManager = pipelineManager;
		this.objects = [];
	}

	addObject(object) {
		this.objects.push(object);
	}

	render(commandEncoder, textureView) {
		const pipeline = this.pipelineManager.getPipeline('3D');
		const depthView = this.pipelineManager.getDepthTexture();

		const passDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0, g: 0, b: 0, a: 1 }
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
	}
}

export default Scene;