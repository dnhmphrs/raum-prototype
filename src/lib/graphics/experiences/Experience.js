class Experience {
	constructor(device, resourceManager) {
		this.device = device;
		this.resourceManager = resourceManager;
		this.objects = [];
		this.pipelines = [];
	}

	addObject(object) {
		this.objects.push(object);
	}

	addPipeline(pipeline) {
		this.pipelines.push(pipeline);
	}
}

export default Experience;
