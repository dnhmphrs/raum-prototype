// Scene.js
import Cube from './objects/cube';

class Scene {
	constructor(device) {
		this.device = device;
		this.objects = []; // Store all objects to be rendered
		this.addDefaultObjects();
	}

	addDefaultObjects() {
		// Add a cube as a default object
		const cube = new Cube(this.device);
		this.addObject(cube);
	}

	addObject(object) {
		// Adds an object to the scene
		this.objects.push(object);
	}

	removeObject(object) {
		// Removes an object from the scene
		this.objects = this.objects.filter((obj) => obj !== object);
	}

	updateObjects() {
		// Any logic for updating scene objects goes here, e.g., animations
		this.objects.forEach((object) => object.update && object.update());
	}
}

export default Scene;
