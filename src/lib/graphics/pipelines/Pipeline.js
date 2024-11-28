class Pipeline {
	constructor(device) {
		this.device = device;
		this.pipeline = null;
		this.bindGroup = null;
	}

	async initialize() {
		throw new Error('initialize() must be implemented by subclasses');
	}

	render() {
		throw new Error('render() must be implemented by subclasses');
	}

	cleanup() {}
}

export default Pipeline;
