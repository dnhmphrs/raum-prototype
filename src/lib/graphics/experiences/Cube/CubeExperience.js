import Experience from '../Experience';
import RenderPipeline2D from './RenderPipeline2D.js';
import RenderPipeline3D from './RenderPipeline3D.js';

class CubeExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);
		
		// Store device and resource manager
		this.device = device;
		this.resourceManager = resourceManager;
		
		// Register this experience with the resource manager
		if (this.resourceManager) {
			if (!this.resourceManager.experiences) {
				this.resourceManager.experiences = {};
			}
			this.resourceManager.experiences.cube = this;
		}
		
		// Animation time
		this.time = 0;
		
		// Create uniform buffer for time
		this.uniformBuffer = this.device.createBuffer({
			size: 16, // 3 unused floats + 1 float for time
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Cube Uniforms Buffer'
		});
		
		// Expose this experience globally
		if (typeof window !== 'undefined') {
			window.cubeExperience = this;
		}
	}
	
	async initialize() {		
		try {
			// Create 2D pipeline first (renders behind)
			this.pipeline2D = new RenderPipeline2D(this.device, this.resourceManager);
			await this.pipeline2D.initialize();
			
			// Create 3D pipeline (renders on top)
			this.pipeline3D = new RenderPipeline3D(this.device, this.resourceManager);
			await this.pipeline3D.initialize();
			
			// Set camera position for better viewing
			if (this.resourceManager && this.resourceManager.camera) {
				// Position camera to look at the cube
				this.resourceManager.camera.position = [0, 0, 5];
				this.resourceManager.camera.updateView();
				
				// Set up camera controller if available
				if (this.resourceManager.cameraController) {
					this.resourceManager.cameraController.baseDistance = 5.0;
					this.resourceManager.cameraController.distance = 5.0;
					this.resourceManager.cameraController.updateCameraPosition();
				}
			}
			
			return true;
		} catch (error) {
			return false;
		}
	}
	
	render(commandEncoder, textureView) {
		if (!this.pipeline2D || !this.pipeline3D || !textureView) {
			return;
		}
		
		try {
			// Update time (for animation)
			this.time += 0.01;
			
			// Update uniform buffer with time
			this.device.queue.writeBuffer(
				this.uniformBuffer,
				0,
				new Float32Array([0, 0, 0, this.time])
			);
			
			// First render the 2D background (Jacobi theta function)
			this.pipeline2D.render(commandEncoder, textureView, this.time);
			
			// Get depth texture view for 3D rendering
			const depthTextureView = this.resourceManager.getDepthTextureView?.();
			if (!depthTextureView) {
				console.warn("Depth texture view not available for 3D rendering");
				return;
			}
			
			// Then render the 3D content on top with transparent background
			this.pipeline3D.render(
				commandEncoder,
				textureView,
				depthTextureView,
				this.uniformBuffer
			);
		} catch (error) {
			console.error('Error in Cube Experience render:', error);
		}
	}
	
	handleResize(width, height) {
		if (this.resourceManager.camera) {
			this.resourceManager.camera.updateAspect(width, height);
		}
		
		if (this.resourceManager.updateDepthTexture) {
			this.resourceManager.updateDepthTexture(width, height);
		}
	}
	
	cleanup() {
		if (this.pipeline2D) {
			this.pipeline2D.cleanup();
		}
		
		if (this.pipeline3D) {
			this.pipeline3D.cleanup();
		}
	}
}

export default CubeExperience;
