import { initializeWebGPU, cleanupAllWebGPUContexts } from './core/WebGPUContext';
import Camera from './camera/Camera';
import CameraController from './camera/CameraController';
import InteractionManager from './core/InteractionManager';
import ResourceManager from './core/ResourceManager';
import Experience from './experiences/Experience';
import { vec3 } from 'gl-matrix';
import { 
	getMemoryStats, 
	forceGarbageCollection, 
	formatBytes, 
	registerResource, 
	unregisterResource,
	cleanupAllResources
} from './utils/MemoryManager.js';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.webgpuContext = null;
		this.resourceManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;
		this.interactionManager = null;
		this.currentExperience = null;
		this.animationFrameId = null;
		
		// Resource tracking
		this.resources = {
			buffers: [],
			textures: [],
			bindGroups: [],
			pipelines: [],
			others: []
		};
		
		// Register with memory manager
		registerResource(this, 'others');
	}
	
	// Track a resource for automatic cleanup
	trackResource(resource, type = 'others') {
		if (!resource) return resource;
		
		// Add to appropriate resource list
		if (this.resources[type]) {
			this.resources[type].push(resource);
		} else {
			this.resources.others.push(resource);
		}
		
		// Register with global memory manager
		registerResource(resource, type);
		
		return resource;
	}

	async start(SceneClass, cameraConfig = {}) {
		// Clean up any existing resources first
		if (this.device || this.context) {
			this.cleanup();
		}
		
		try {
			// Reinitialize WebGPU context
			this.webgpuContext = await initializeWebGPU(this.canvas);
			
			if (!this.webgpuContext) {
				console.error("Failed to initialize WebGPU context");
				return null;
			}
			
			this.device = this.webgpuContext.device;
			this.context = this.webgpuContext.context;
			
			// Track the WebGPU context
			this.trackResource(this.webgpuContext, 'others');
	
			// Initialize Camera and Controller with config
			this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
			this.trackResource(this.camera, 'others');
			
			// Set camera position and fov from config if provided
			if (cameraConfig) {
				// Set position
				if (cameraConfig.position) {
					this.camera.position = vec3.fromValues(
						cameraConfig.position.x,
						cameraConfig.position.y,
						cameraConfig.position.z
					);
					this.camera.updateView();
				}
				
				// Set field of view
				if (cameraConfig.fov) {
					this.camera.updateProjection(cameraConfig.fov);
				}
			}
			
			this.cameraController = new CameraController(this.camera, vec3.fromValues(0, 0, 0), cameraConfig);
			this.trackResource(this.cameraController, 'others');
	
			// Initialize Shared Resource Manager
			this.resourceManager = new ResourceManager(this.device, this.camera);
			this.trackResource(this.resourceManager, 'others');
			
			// Make sure camera controller is available in the resource manager
			this.resourceManager.cameraController = this.cameraController;
			this.resourceManager.canvas = this.canvas;
			
			this.resourceManager.initialize(this.canvas.width, this.canvas.height);
	
			// Initialize Scene
			this.scene = new SceneClass(this.device, this.resourceManager);
			this.trackResource(this.scene, 'others');
			
			await this.scene.initialize();
			
			// Store the current experience for easier access
			if (this.scene && this.scene.currentExperience) {
				this.experience = this.scene.currentExperience;
				this.trackResource(this.experience, 'others');
			} else if (this.resourceManager && this.resourceManager.experiences) {
				// Try to find the experience in the resource manager
				const experienceKeys = Object.keys(this.resourceManager.experiences);
				if (experienceKeys.length > 0) {
					this.experience = this.resourceManager.experiences[experienceKeys[0]];
					this.trackResource(this.experience, 'others');
				}
			}
			
			// If we're starting a specific experience directly (not a scene with multiple experiences)
			if (!this.experience && SceneClass.prototype instanceof Experience) {
				this.experience = this.scene;
			}
			
			// Initialize Interaction Manager
			this.interactionManager = new InteractionManager(this.canvas, this);
			this.trackResource(this.interactionManager, 'others');
			this.interactionManager.initialize();
	
			// Start rendering loop
			this.render();
			
			return this.experience;
		} catch (error) {
			console.error("Error in Engine.start:", error);
			this.cleanup();
			return null;
		}
	}

	updateViewport(width, height) {
		if (!this.canvas || !this.device) {
			return;
		}
		
		if (width <= 0 || height <= 0) {
			return;
		}
		
		this.canvas.width = width;
		this.canvas.height = height;
	
		// Update ResourceManager with new viewport size
		if (this.resourceManager) {
			this.resourceManager.updateViewportSize(width, height);
		}

		// Update camera's aspect ratio
		if (this.cameraController) {
			this.cameraController.updateAspect(width, height);
		}

		// Update the scene if it has an onResize method
		if (this.scene && this.scene.onResize) {
			this.scene.onResize(width, height);
		}
	}

	async cleanup() {
		// Stop animation frame if it's running
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		
		// Properly shutdown experience if it exists
		if (this.experience) {
			try {
				// Check if the experience has a shutdown method
				if (typeof this.experience.shutdown === 'function') {
					// console.log(`Shutting down ${this.experience.constructor.name} experience...`);
					// Wait for shutdown to complete before proceeding with cleanup
					await this.experience.shutdown();
				}
				
				// Now perform cleanup
				if (typeof this.experience.cleanup === 'function') {
					// console.log(`Performing cleanup for ${this.experience.constructor.name} experience`);
					this.experience.cleanup();
				}
			} catch (error) {
				console.error("Error cleaning up experience:", error);
			}
			this.experience = null;
		}
		
		// Clean up scene if different from experience
		if (this.scene && this.scene !== this.experience) {
			if (typeof this.scene.cleanup === 'function') {
				try {
					this.scene.cleanup();
				} catch (error) {
					console.error("Error cleaning up scene:", error);
				}
			}
			this.scene = null;
		}
		
		// Cleanup interaction manager
		if (this.interactionManager) {
			if (typeof this.interactionManager.destroy === 'function') {
				try {
					this.interactionManager.destroy();
				} catch (error) {
					console.error("Error cleaning up interaction manager:", error);
				}
			}
			this.interactionManager = null;
		}

		// Cleanup camera and controller
		if (this.camera) {
			if (typeof this.camera.cleanup === 'function') {
				try {
					this.camera.cleanup();
				} catch (error) {
					console.error("Error cleaning up camera:", error);
				}
			}
			this.camera = null;
		}
		
		if (this.cameraController) {
			if (typeof this.cameraController.cleanup === 'function') {
				try {
					this.cameraController.cleanup();
				} catch (error) {
					console.error("Error cleaning up camera controller:", error);
				}
			}
			this.cameraController = null;
		}
		
		// Clean up resource manager
		if (this.resourceManager) {
			try {
				this.resourceManager.cleanup();
			} catch (error) {
				console.error("Error cleaning up resource manager:", error);
			}
			this.resourceManager = null;
		}
		
		// Clean up WebGPU context
		if (this.webgpuContext) {
			if (typeof this.webgpuContext.cleanup === 'function') {
				try {
					this.webgpuContext.cleanup();
				} catch (error) {
					console.error("Error cleaning up WebGPU context:", error);
				}
			}
			this.webgpuContext = null;
		}

		// Reset device and context
		this.device = null;
		this.context = null;
		
		// Clean up all tracked resources
		for (const type in this.resources) {
			const resources = this.resources[type];
			if (resources && resources.length > 0) {
				for (let i = resources.length - 1; i >= 0; i--) {
					const resource = resources[i];
					if (resource) {
						// Unregister from global memory manager
						unregisterResource(resource, type);
						
						// Explicitly nullify the resource
						resources[i] = null;
					}
				}
				
				// Clear the array
				this.resources[type] = [];
			}
		}
		
		// Remove any global references that might be causing memory leaks
		if (typeof window !== 'undefined') {
			if (window.gridCodeExperience) {
				window.gridCodeExperience = null;
			}
			// Force garbage collection if available (though this is rarely available in browsers)
			if (window.gc) {
				window.gc();
			}
		}
		
		// Unregister from memory manager
		unregisterResource(this, 'others');
	}

	render = () => {
		// Check if we have a valid device and context
		if (!this.device || !this.context) {
			console.warn("WebGPU device or context is null, stopping render loop");
			return;
		}
		
		try {
			// Get the current texture from the context
			const textureView = this.context.getCurrentTexture().createView();
			
			// Create a command encoder
			const commandEncoder = this.device.createCommandEncoder();
			
			// Render the scene
			if (this.scene) {
				this.scene.render(commandEncoder, textureView);
			} else {
				console.warn("No scene available to render");
			}
			
			// Submit the command buffer
			this.device.queue.submit([commandEncoder.finish()]);
		} catch (error) {
			console.error("Error in render loop:", error);
			// Don't stop the render loop on error, just log it
		}
		
		// Request the next frame
		this.animationFrameId = requestAnimationFrame(this.render);
	}

	handleResize() {
		// Update canvas size
		if (this.canvas) {
			const width = this.canvas.clientWidth;
			const height = this.canvas.clientHeight;
			
			if (width > 0 && height > 0) {
				this.canvas.width = width;
				this.canvas.height = height;
				
				// Update context configuration if needed
				if (this.context && this.device) {
					try {
						this.context.configure({
							device: this.device,
							format: navigator.gpu.getPreferredCanvasFormat(),
							alphaMode: 'premultiplied'
						});
					} catch (error) {
						// Error reconfiguring context
					}
				}
				
				// Update viewport if needed
				if (this.resourceManager && this.resourceManager.updateViewportSize) {
					this.resourceManager.updateViewportSize(width, height);
				}
				
				// Update camera aspect ratio
				if (this.camera) {
					this.camera.updateAspect(width, height);
				}
				
				// Call resize on scene if it exists
				if (this.scene && typeof this.scene.handleResize === 'function') {
					this.scene.handleResize(width, height);
				}
			} else {
				// Invalid canvas dimensions
			}
		}
	}

	// Add a stop method that calls cleanup for compatibility
	async stop() {
		await this.cleanup();
	}
	
	// Helper method to format bytes to human-readable format
	formatBytes(bytes) {
		return formatBytes(bytes);
	}
	
	// Static method to clean up all WebGPU resources
	static cleanupAll() {
		// Clean up all WebGPU contexts
		cleanupAllWebGPUContexts();
		
		// Clean up all tracked resources
		cleanupAllResources();
		
		// Force garbage collection
		forceGarbageCollection();
	}
}

export default Engine;
