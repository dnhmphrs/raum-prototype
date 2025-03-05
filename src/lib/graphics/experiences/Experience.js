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

	cleanup() {
		// Clean up any resources specific to this experience
		this.objects = [];
		
		// Any additional cleanup specific to the experience
		// ...
	}
}

export default Experience;
