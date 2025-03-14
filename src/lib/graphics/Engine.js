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
		
		// Memory management
		this.memoryStats = {
			startTime: Date.now(),
			lastCleanupTime: 0,
			resourceCount: 0,
			cleanupCount: 0
		};
		
		// Auto cleanup interval (every 5 minutes)
		this.autoCleanupInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
		this.lastAutoCleanupTime = Date.now();
		
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
		console.log("Engine starting...");
		
		// Clean up any existing resources first
		if (this.device || this.context) {
			console.log("Cleaning up existing resources before starting");
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
			
			console.log("Engine started with experience:", this.experience);
	
			// Initialize Interaction Manager
			this.interactionManager = new InteractionManager(this.canvas, this);
			this.trackResource(this.interactionManager, 'others');
			this.interactionManager.initialize();
	
			// Start rendering loop
			this.render();
			
			return this.experience;
		} catch (error) {
			console.error("Error starting engine:", error);
			this.cleanup();
			return null;
		}
	}

	updateViewport(width, height) {
		if (!this.canvas || !this.device) {
			console.warn("Cannot update viewport: canvas or device is null");
			return;
		}
		
		if (width <= 0 || height <= 0) {
			console.warn(`Invalid viewport dimensions: ${width}x${height}`);
			return;
		}
		
		console.log(`Updating viewport to ${width}x${height}`);
		
		try {
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
		} catch (error) {
			console.error("Error updating viewport:", error);
		}
	}

	cleanup() {
		console.log("Engine cleanup called");
		
		// Stop animation frame if it's running
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		
		// Clean up experience
		if (this.experience) {
			console.log("Cleaning up experience");
			if (typeof this.experience.cleanup === 'function') {
				this.experience.cleanup();
			}
			this.experience = null;
		}
		
		// Clean up scene if different from experience
		if (this.scene && this.scene !== this.experience) {
			console.log("Cleaning up scene");
			if (typeof this.scene.cleanup === 'function') {
				this.scene.cleanup();
			}
			this.scene = null;
		}
		
		// Cleanup interaction manager
		if (this.interactionManager) {
			console.log("Cleaning up interaction manager");
			if (typeof this.interactionManager.destroy === 'function') {
				this.interactionManager.destroy();
			}
			this.interactionManager = null;
		}

		// Cleanup camera and controller
		if (this.camera) {
			console.log("Cleaning up camera");
			if (typeof this.camera.cleanup === 'function') {
				this.camera.cleanup();
			}
			this.camera = null;
		}
		
		if (this.cameraController) {
			console.log("Cleaning up camera controller");
			if (typeof this.cameraController.cleanup === 'function') {
				this.cameraController.cleanup();
			}
			this.cameraController = null;
		}
		
		// Clean up resource manager
		if (this.resourceManager) {
			console.log("Cleaning up resource manager");
			this.resourceManager.cleanup();
			this.resourceManager = null;
		}
		
		// Clean up WebGPU context
		if (this.webgpuContext) {
			console.log("Cleaning up WebGPU context");
			if (typeof this.webgpuContext.cleanup === 'function') {
				this.webgpuContext.cleanup();
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
				console.log(`Cleaning up ${resources.length} engine ${type}`);
				
				// Clean up each resource
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
		
		console.log("Engine cleanup complete");
	}

	render = () => {
		// Check if we have a valid device and context
		if (!this.device || !this.context) {
			console.error("Cannot render: WebGPU device or context is null");
			return;
		}
		
		// Check if auto cleanup is needed
		const now = Date.now();
		if (now - this.lastAutoCleanupTime > this.autoCleanupInterval) {
			console.log("Performing auto cleanup");
			this.performGarbageCollection();
			this.lastAutoCleanupTime = now;
		}
		
		try {
			// Get the current texture from the context
			const textureView = this.context.getCurrentTexture().createView();

			// Create a command encoder
			const commandEncoder = this.device.createCommandEncoder();

			// Render the scene
			if (this.scene) {
				this.scene.render(commandEncoder, textureView);
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
		console.log("Engine handleResize called");
		
		// Update canvas size
		if (this.canvas) {
			const width = this.canvas.clientWidth;
			const height = this.canvas.clientHeight;
			
			if (width > 0 && height > 0) {
				this.canvas.width = width;
				this.canvas.height = height;
				console.log(`Canvas resized to ${width}x${height}`);
				
				// Update context configuration if needed
				if (this.context && this.device) {
					try {
						this.context.configure({
							device: this.device,
							format: navigator.gpu.getPreferredCanvasFormat(),
							alphaMode: 'premultiplied'
						});
					} catch (error) {
						console.error("Error reconfiguring context:", error);
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
				console.warn(`Invalid canvas dimensions: ${width}x${height}`);
			}
		}
	}

	// Add a stop method that calls cleanup for compatibility
	stop() {
		console.log("Engine stop called");
		this.cleanup();
	}

	// Add a method to force garbage collection and memory cleanup
	performGarbageCollection() {
		console.log("Forcing garbage collection");
		
		// Update memory stats
		this.memoryStats.lastCleanupTime = Date.now();
		this.memoryStats.cleanupCount++;
		
		// Use the MemoryManager to get and log memory stats
		const memoryStats = getMemoryStats();
		console.log("Memory usage:", memoryStats);
		
		// Force garbage collection
		forceGarbageCollection();
	}
	
	// Helper method to format bytes to human-readable format
	formatBytes(bytes) {
		return formatBytes(bytes);
	}
	
	// Static method to clean up all WebGPU resources
	static cleanupAll() {
		console.log("Cleaning up all WebGPU resources");
		
		// Clean up all WebGPU contexts
		cleanupAllWebGPUContexts();
		
		// Clean up all tracked resources
		cleanupAllResources();
		
		// Force garbage collection
		forceGarbageCollection();
	}
}

export default Engine;
