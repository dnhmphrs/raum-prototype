// FlockingExperience.js

import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import PredatorGeometry from './PredatorGeometry';
import GuidingLineGeometry from './GuidingLineGeometry'
import FlockingPipeline from './FlockingPipeline';

class FlockingExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        this.birdCount = 4096; // Adjusted for performance
        this.initialBirdCount = this.birdCount; // Store initial count for recovery
        this.lastTime = performance.now(); // Initialize lastTime
        
        // Performance tracking variables
        this.frameCount = 0;
        this.frameTimes = [];
        this.maxFrameHistory = 60; // Track last 60 frames for averaging
        this.performanceScaleFactor = 1.0; // Initial scale factor
        this.targetFrameTime = 4.0; // Target ~60fps (in ms)
        
        // Memory throttling flags
        this.isMemoryThrottled = false;
        this.recoveryScheduled = false;

        // Timer variables
        this.targetChangeInterval = 10000; // 10 seconds in milliseconds
        this.lastTargetChangeTime = this.lastTime;
        this.accumulatedTargetTime = 0; // Accumulated time for target changes

        // Separate storage for birds and predator
        this.birds = []; // Array to hold all bird geometries
        this.predator = null; // Single reference for the predator

        // Get initial dimensions from the viewport buffer
        const viewportArray = new Float32Array(2);
        device.queue.writeBuffer(resourceManager.getViewportBuffer(), 0, viewportArray);

        // Initialize the Flocking pipeline with dimensions from ResourceManager
        this.pipeline = new FlockingPipeline(
            this.device,
            resourceManager.camera,
            resourceManager.getViewportBuffer(),
            resourceManager.getMouseBuffer(),
            this.birdCount,
            this.canvas ? this.canvas.width : 800,  // Default to 800 if canvas not available
            this.canvas ? this.canvas.height : 600  // Default to 600 if canvas not available
        );

        this.addBirds();
        this.addPredator();

        this.guidingLine = new GuidingLineGeometry(this.device);
        this.addObject(this.guidingLine);

        // Bind the visibility change handler and store the bound function
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
        
        // Listen for memory warning events
        this.handleMemoryWarningBound = this.handleMemoryWarning.bind(this);
        window.addEventListener('memory-warning', this.handleMemoryWarningBound);
    }
    
    // Handle memory warnings
    handleMemoryWarning(event) {
        const { percentUsed, isCritical } = event.detail;
        
        if (isCritical && !this.isMemoryThrottled) {
            // Drastic reduction for critical memory issues
            this.handleLowMemory(true);
        } else if (percentUsed > 90 && !this.isMemoryThrottled) {
            // Regular throttling for high memory usage
            this.handleLowMemory(false);
        }
    }
    
    // Handle low memory conditions by reducing bird count
    handleLowMemory(isCritical = false) {
        // Skip if already throttled
        if (this.isMemoryThrottled) return;
        
        // Store original bird count for later recovery
        if (this.initialBirdCount === undefined) {
            this.initialBirdCount = this.birdCount;
        }
        
        // Calculate reduced bird count
        const reductionFactor = isCritical ? 0.25 : 0.5; // 75% or 50% reduction
        const newBirdCount = Math.max(256, Math.floor(this.birdCount * reductionFactor));
        
        console.warn(`Reducing bird count from ${this.birdCount} to ${newBirdCount} due to ${isCritical ? 'critical' : 'high'} memory usage`);
        
        // Mark as throttled and update count
        this.isMemoryThrottled = true;
        this.birdCount = newBirdCount;
        
        // Update birds visibility - hide some birds instead of recreating them
        this.updateBirdVisibility();
        
        // Apply low-performance mode to the pipeline
        this.pipeline.updatePerformanceMode(true);
        
        // Schedule recovery after memory pressure subsides
        if (!this.recoveryScheduled) {
            this.recoveryScheduled = true;
            // Clear any existing recovery timer
            if (this._recoveryTimer) {
                clearTimeout(this._recoveryTimer);
            }
            // Store the timer reference so we can clean it up later
            this._recoveryTimer = setTimeout(() => this.attemptMemoryRecovery(), 30000); // Check after 30 seconds
        }
    }
    
    // Update bird visibility based on bird count
    updateBirdVisibility() {
        if (!this.birds || this.birds.length === 0) return;
        
        // Make sure only birdCount birds are visible
        for (let i = 0; i < this.birds.length; i++) {
            if (i < this.birdCount) {
                // These birds are active
                this.birds[i].isVisible = true;
            } else {
                // These birds are hidden
                this.birds[i].isVisible = false;
            }
        }
    }
    
    // Try to recover from memory throttling
    attemptMemoryRecovery() {
        this.recoveryScheduled = false;
        
        // Check if memory usage has improved
        if (window.performance && window.performance.memory) {
            const memUsage = window.performance.memory.usedJSHeapSize;
            const memLimit = window.performance.memory.jsHeapSizeLimit;
            const percentUsed = (memUsage / memLimit) * 100;
            
            // Only restore if memory usage is reasonable
            if (percentUsed < 75 && this.initialBirdCount && this.isMemoryThrottled) {
                console.info(`Restoring bird count to ${this.initialBirdCount}`);
                
                // Gradually increase bird count instead of jumping back to full
                const currentCount = this.birdCount;
                const targetCount = this.initialBirdCount;
                const step = Math.max(256, Math.floor((targetCount - currentCount) / 2));
                
                this.birdCount = Math.min(targetCount, currentCount + step);
                
                // Update birds visibility
                this.updateBirdVisibility();
                
                // If we're not fully recovered, schedule another recovery step
                if (this.birdCount < this.initialBirdCount) {
                    this.recoveryScheduled = true;
                    // Store the timer so we can clear it during cleanup
                    this._recoveryTimer = setTimeout(() => this.attemptMemoryRecovery(), 15000); // Check again sooner
                } else {
                    // We've recovered fully
                    this.isMemoryThrottled = false;
                    this.pipeline.updatePerformanceMode(false);
                }
            } else if (this.isMemoryThrottled) {
                // Memory still high, check again later
                this.recoveryScheduled = true;
                // Store the timer so we can clear it during cleanup
                this._recoveryTimer = setTimeout(() => this.attemptMemoryRecovery(), 30000);
            }
        }
    }
    
    async initialize() {
        // Initialize the pipeline
        await this.pipeline.initialize();

        // Generate initial positions and velocities for birds
        const initialPositions = [];
        const initialVelocities = [];
        const initialPhases = [];
        const bounds = 5000;
        const boundsHalf = bounds / 2;

        for (let i = 0; i < this.initialBirdCount; i++) {
            // Random positions within bounds
            const posX = Math.random() * bounds - boundsHalf;
            const posY = Math.random() * bounds - boundsHalf;
            const posZ = Math.random() * bounds - boundsHalf;
            initialPositions.push([posX, posY, posZ]);

            // Random velocities with a small magnitude
            const velX = (Math.random() - 0.5);
            const velY = (Math.random() - 0.5);
            const velZ = (Math.random() - 0.5);
            initialVelocities.push([velX, velY, velZ]);

            // Random wing phases
            initialPhases.push(0); // Initialize with 0 phase
        }

        // Initialize position and velocity buffers in the pipeline
        this.pipeline.initializeBirdBuffers(initialPositions, initialVelocities, initialPhases);

        const initialPredatorPosition = new Float32Array([0.0, 0.0, 0.0]); // Starting at origin
        const initialPredatorVelocity = new Float32Array([0.0, 0.0, 0.0]); // Initially stationary

        // Initialize predator position and velocity buffers in the pipeline
        this.pipeline.initializePredatorBuffers(initialPredatorPosition, initialPredatorVelocity);

        // Set initial targetIndex to a random bird
        const initialTargetIndex = Math.floor(Math.random() * this.birdCount);
        this.pipeline.updateTargetIndex(initialTargetIndex);
    }

    addBirds() {
        // Add multiple birds to the scene and store references - always create full set
        for (let i = 0; i < this.initialBirdCount; i++) {
            const bird = new BirdGeometry(this.device);
            this.birds.push(bird);
            this.addObject(bird);
        }
        
        // Set initial visibility
        this.updateBirdVisibility();
    }

    addPredator() {
        // Add a single predator to the scene and store its reference
        const predator = new PredatorGeometry(this.device);
        this.predator = predator;
        this.addObject(predator);
    }

    // Update performance metrics
    updatePerformanceMetrics(frameTime) {
        this.frameCount++;
        
        // Add current frame time to history
        this.frameTimes.push(frameTime);
        
        // Keep only the most recent frames
        if (this.frameTimes.length > this.maxFrameHistory) {
            this.frameTimes.shift();
        }
        
        // Calculate average frame time
        const avgFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
        
        // Update performance scale factor
        // If avgFrameTime > targetFrameTime, scale down (< 1.0)
        // If avgFrameTime < targetFrameTime, scale up (> 1.0), but cap at 1.0 to avoid too fast simulation
        this.performanceScaleFactor = Math.min(0.5, this.targetFrameTime / Math.max(1.0, avgFrameTime));

        // If performance is consistently poor, switch to low performance mode
        if (avgFrameTime > 50.0 && !this.pipeline.lowPerformanceMode) { // 50ms = ~20fps
            this.pipeline.updatePerformanceMode(true);
        } else if (avgFrameTime < 30.0 && this.pipeline.lowPerformanceMode) { // 30ms = ~33fps
            // If performance improves, switch back to high quality
            this.pipeline.updatePerformanceMode(false);
        }
    }

    render(commandEncoder, textureView) {
        // Calculate deltaTime
        const now = performance.now();
        const rawDeltaTime = (now - this.lastTime) / 1000; // in seconds
        this.lastTime = now;
        
        // Update performance metrics
        this.updatePerformanceMetrics(rawDeltaTime * 1000); // Convert to ms for metrics
        
        // Apply performance scaling to deltaTime
        let deltaTime = rawDeltaTime * this.performanceScaleFactor;
        
        // Cap maximum deltaTime to prevent large jumps after pauses
        const MAX_DELTA = 0.1; // 100ms maximum
        deltaTime = Math.min(deltaTime, MAX_DELTA);

        if (document.visibilityState !== 'visible') {
            // If not visible, set deltaTime to zero to pause updates
            deltaTime = 0;
        }

        // Update deltaTime in the compute shader
        this.pipeline.updateDeltaTime(deltaTime);

        // Handle target change using accumulated time approach
        this.accumulatedTargetTime += rawDeltaTime * 1000; // Use raw time for real-world timing
        if (this.accumulatedTargetTime >= this.targetChangeInterval) {
            this.changeTarget();
            this.accumulatedTargetTime = 0;
        }

        // Render the pipeline (includes compute pass and render pass)
        const depthView = this.resourceManager.getDepthTextureView();
        const passDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.2, g: 0.5, b: 0.9, a: 1.0 }
                }
            ],
            depthStencilAttachment: {
                view: depthView,
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'store'
            }
        };

        this.pipeline.render(commandEncoder, passDescriptor, this.birds, this.predator, textureView, depthView);
    }

    changeTarget() {
        // Select a new target index different from the current one
        let newTargetIndex = Math.floor(Math.random() * this.birdCount);

        // Update the target index in the pipeline
        this.pipeline.updateTargetIndex(newTargetIndex);
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Reset lastTime to prevent large deltaTime
            this.lastTime = performance.now();
        }
    }

    cleanup() {
        // Remove event listeners
        if (this.handleVisibilityChangeBound) {
            document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
            this.handleVisibilityChangeBound = null;
        }
        
        if (this.handleMemoryWarningBound) {
            window.removeEventListener('memory-warning', this.handleMemoryWarningBound);
            this.handleMemoryWarningBound = null;
        }
        
        // Destroy pipeline with explicit cleanup
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Cleanup birds with explicit destroy calls
        if (this.birds) {
            this.birds.forEach(bird => {
                if (typeof bird.cleanup === 'function') {
                    bird.cleanup();
                }
            });
            this.birds = [];
        }
        
        // Cleanup predator with explicit destroy calls
        if (this.predator) {
            if (typeof this.predator.cleanup === 'function') {
                this.predator.cleanup();
            }
            this.predator = null;
        }
        
        // Cleanup guiding line with explicit destroy calls
        if (this.guidingLine) {
            if (typeof this.guidingLine.cleanup === 'function') {
                this.guidingLine.cleanup();
            }
            this.guidingLine = null;
        }
        
        // Reset memory throttling variables
        this.isMemoryThrottled = false;
        this.recoveryScheduled = false;
        this.initialBirdCount = undefined;
        
        // Reset performance tracking
        this.frameCount = 0;
        this.frameTimes = [];
        this.performanceScaleFactor = 1.0;
        
        // Remove other references
        this.currentTargetIndex = null;
        this.lastTime = null;
        this.accumulatedTargetTime = 0;
        
        // Clear any timers
        if (this._recoveryTimer) {
            clearTimeout(this._recoveryTimer);
            this._recoveryTimer = null;
        }
        
        // Call parent cleanup to handle common resources
        super.cleanup();
    }

    onResize(width, height) {
        if (this.pipeline) {
            this.pipeline.updateViewportDimensions(width, height);
        }
    }
}

export default FlockingExperience;