import { registerResource, unregisterResource, cleanupResource } from '../utils/MemoryManager.js';

class Experience {
	constructor(device, resourceManager) {
		this.device = device;
		this.resourceManager = resourceManager;
		this.objects = [];
		this.pipelines = [];
		
		// Register this experience with the memory manager
		registerResource(this, 'experiences');
	}

	addObject(object) {
		this.objects.push(object);
	}

	addPipeline(pipeline) {
		this.pipelines.push(pipeline);
	}

	cleanup() {
		console.log("Base Experience cleanup called");
		
		// Clean up any resources specific to this experience
		if (this.objects && this.objects.length > 0) {
			console.log(`Cleaning up ${this.objects.length} objects`);
			for (let i = 0; i < this.objects.length; i++) {
				const object = this.objects[i];
				if (object && typeof object.cleanup === 'function') {
					object.cleanup();
				}
			}
			this.objects = [];
		}
		
		// Clean up pipelines
		if (this.pipelines && this.pipelines.length > 0) {
			console.log(`Cleaning up ${this.pipelines.length} pipelines`);
			for (let i = 0; i < this.pipelines.length; i++) {
				const pipeline = this.pipelines[i];
				if (pipeline && typeof pipeline.cleanup === 'function') {
					pipeline.cleanup();
				}
			}
			this.pipelines = [];
		}
		
		// Clear device and resource manager references
		this.device = null;
		this.resourceManager = null;
		
		// Unregister this experience from the memory manager
		unregisterResource(this, 'experiences');
		
		console.log("Base Experience cleanup complete");
	}
}

export default Experience;
