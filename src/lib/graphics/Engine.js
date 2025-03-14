import { initializeWebGPU } from './core/WebGPUContext';
import Camera from './camera/Camera';
import CameraController from './camera/CameraController';
import InteractionManager from './core/InteractionManager';
import ResourceManager from './core/ResourceManager';
import Experience from './experiences/Experience';
import { vec3 } from 'gl-matrix';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.resourceManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;
		this.interactionManager = null;
		this.currentExperience = null;
		this.animationFrameId = null;
		
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
	}

	async start(SceneClass, cameraConfig = {}) {
		// Reinitialize WebGPU context
		const { device, context } = await initializeWebGPU(this.canvas);
		this.device = device;
		this.context = context;

		// Initialize Camera and Controller with config
		this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
		
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

		// Initialize Shared Resource Manager
		this.resourceManager = new ResourceManager(this.device, this.camera);
		
		// Make sure camera controller is available in the resource manager
		this.resourceManager.cameraController = this.cameraController;
		
		this.resourceManager.initialize(this.canvas.width, this.canvas.height);

		// Initialize Scene
		this.scene = new SceneClass(this.device, this.resourceManager);
		await this.scene.initialize();
		
		// Store the current experience for easier access
		if (this.scene && this.scene.currentExperience) {
			this.experience = this.scene.currentExperience;
		} else if (this.resourceManager && this.resourceManager.experiences) {
			// Try to find the experience in the resource manager
			const experienceKeys = Object.keys(this.resourceManager.experiences);
			if (experienceKeys.length > 0) {
				this.experience = this.resourceManager.experiences[experienceKeys[0]];
			}
		}
		
		// If we're starting a specific experience directly (not a scene with multiple experiences)
		if (!this.experience && SceneClass.prototype instanceof Experience) {
			this.experience = this.scene;
		}
		
		console.log("Engine started with experience:", this.experience);

		// Initialize Interaction Manager
		this.interactionManager = new InteractionManager(this.canvas, this);
		this.interactionManager.initialize();

		// Start rendering loop
		this.render();
		
		return this.experience;
	}

	updateViewport(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;

		// Update ResourceManager with new viewport size
		this.resourceManager.updateViewportSize(width, height);

		// Update camera's aspect ratio
		this.cameraController.updateAspect(width, height);

		// Update the scene if it has an onResize method
		if (this.scene && this.scene.onResize) {
			this.scene.onResize(width, height);
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
			this.experience.cleanup();
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
		
		// Clean up resource manager last
		if (this.resourceManager) {
			console.log("Cleaning up resource manager");
			this.resourceManager.cleanup();
			this.resourceManager = null;
		}

		// Reset device and context
		// Note: We don't destroy the device or context as they're managed by the browser
		this.device = null;
		this.context = null;
		
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
		
		console.log("Engine cleanup complete");
	}

	render() {
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
		this.animationFrameId = requestAnimationFrame(this.render.bind(this));
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
				if (this.context) {
					this.context.configure({
						device: this.device,
						format: navigator.gpu.getPreferredCanvasFormat(),
						alphaMode: 'premultiplied'
					});
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
		
		// Log memory usage if available
		if (window.performance && window.performance.memory) {
			const memoryInfo = window.performance.memory;
			console.log("Memory usage:", {
				totalJSHeapSize: this.formatBytes(memoryInfo.totalJSHeapSize),
				usedJSHeapSize: this.formatBytes(memoryInfo.usedJSHeapSize),
				jsHeapSizeLimit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
			});
		}
		
		// Force garbage collection if available
		if (typeof window !== 'undefined' && window.gc) {
			window.gc();
		}
	}
	
	// Helper method to format bytes to human-readable format
	formatBytes(bytes) {
		if (bytes === 0) return '0 Bytes';
		
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
}

export default Engine;
