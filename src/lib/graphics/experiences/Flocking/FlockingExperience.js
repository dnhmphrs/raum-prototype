// FlockingExperience.js

import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import PredatorGeometry from './PredatorGeometry';
import GuidingLineGeometry from './GuidingLineGeometry'
import FlockingPipeline from './FlockingPipeline';
import ShaderRectPipeline from './ShaderRectPipeline';

class FlockingExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        this.birdCount = 4096; // Adjusted for performance
        this.lastTime = performance.now(); // Initialize lastTime
        
        // Performance tracking variables
        this.frameCount = 0;
        this.frameTimes = [];
        this.maxFrameHistory = 60; // Track last 60 frames for averaging
        this.performanceScaleFactor = 1.0; // Initial scale factor
        this.targetFrameTime = 4.0; // Target ~60fps (in ms)

        // Timer variables
        this.targetChangeInterval = 10000; // 10 seconds in milliseconds
        this.lastTargetChangeTime = this.lastTime;
        this.accumulatedTargetTime = 0; // Accumulated time for target changes

        // Separate storage for birds and predator
        this.birds = []; // Array to hold all bird geometries
        this.predator = null; // Single reference for the predator

        // Shader rectangle configuration
        this.shaderRectCount = 5; // Initial count of shader rectangles
        this.maxShaderRectCount = 12; // Maximum number of rectangles to show
        this.shaderRectChangeInterval = 3500; // 3.5 seconds for randomizing rectangles
        this.lastShaderRectChangeTime = this.lastTime;
        this.accumulatedShaderRectTime = 0;
        
        // Grid layout settings for potential shader rect placement
        this.gridCols = 5; // Number of columns in the virtual grid
        this.gridRows = 3; // Number of rows in the virtual grid

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

        // Initialize the ShaderRect pipeline
        this.shaderRectPipeline = new ShaderRectPipeline(
            this.device,
            resourceManager.camera,
            resourceManager.getViewportBuffer(),
            this.shaderRectCount,
            this.canvas ? this.canvas.width : 800,
            this.canvas ? this.canvas.height : 600
        );

        this.addBirds();
        this.addPredator();

        this.guidingLine = new GuidingLineGeometry(this.device);
        this.addObject(this.guidingLine);

        // Bind the visibility change handler and store the bound function
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
    }

    async initialize() {
        // Initialize the pipeline
        await this.pipeline.initialize();
        await this.shaderRectPipeline.initialize();

        // Generate initial positions and velocities for birds
        const initialPositions = [];
        const initialVelocities = [];
        const initialPhases = [];
        const bounds = 5000;
        const boundsHalf = bounds / 2;

        for (let i = 0; i < this.birdCount; i++) {
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

        // Initialize shader rectangles with randomized positions and dimensions
        this.updateShaderRects(true);
    }

    addBirds() {
        // Add multiple birds to the scene and store references
        for (let i = 0; i < this.birdCount; i++) {
            const bird = new BirdGeometry(this.device);
            this.birds.push(bird);
            this.addObject(bird);
        }
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

    updateShaderRects(forceUpdate = false) {
        // Determine whether to add, remove, or update rectangles
        if (forceUpdate || Math.random() < 0.3) { // 30% chance to change count
            const prevCount = this.shaderRectCount;
            
            // Adjust count (sometimes up, sometimes down)
            if (Math.random() < 0.5 && this.shaderRectCount < this.maxShaderRectCount) {
                this.shaderRectCount++;
            } else if (this.shaderRectCount > 1) {
                this.shaderRectCount--;
            }
            
            // If count changed, update the pipeline
            if (prevCount !== this.shaderRectCount || forceUpdate) {
                this.shaderRectPipeline.updateRectCount(this.shaderRectCount);
            }
        }
        
        // Generate randomized properties for each rectangle
        const rects = [];
        
        // Keep track of occupied grid cells to prevent overlap
        const occupiedCells = new Set();
        
        // Define cell size and padding
        const cellWidth = 1.0 / this.gridCols;
        const cellHeight = 1.0 / this.gridRows;
        const cellPadding = 0.02; // Padding within each cell
        
        for (let i = 0; i < this.shaderRectCount; i++) {
            // Use golden ratio (1.618) for aesthetically pleasing dimensions
            const goldenRatio = 1.618;
            
            // Try to find an unoccupied cell
            let cellX, cellY, attempts = 0;
            do {
                cellX = Math.floor(Math.random() * this.gridCols);
                cellY = Math.floor(Math.random() * this.gridRows);
                attempts++;
                
                // If we can't find an empty cell after many attempts, just use any cell
                if (attempts > 30) break;
            } while (occupiedCells.has(`${cellX},${cellY}`));
            
            // Mark this cell as occupied
            occupiedCells.add(`${cellX},${cellY}`);
            
            // Determine size within the cell (leave some padding)
            const maxWidth = cellWidth - cellPadding * 2;
            const maxHeight = cellHeight - cellPadding * 2;
            
            // Randomize size - some rectangles are full-cell, others are smaller
            let width, height;
            
            // Visual variety: sometimes use larger rectangles that span multiple cells
            if (Math.random() < 0.2 && cellX < this.gridCols - 1 && occupiedCells.has(`${cellX+1},${cellY}`) === false) {
                // Double-width rectangle
                width = maxWidth * 2 - cellPadding;
                height = maxHeight * (Math.random() < 0.5 ? 1 : 0.7);
                
                // Mark the second cell as occupied
                occupiedCells.add(`${cellX+1},${cellY}`);
            } else if (Math.random() < 0.2 && cellY < this.gridRows - 1 && occupiedCells.has(`${cellX},${cellY+1}`) === false) {
                // Double-height rectangle
                width = maxWidth * (Math.random() < 0.5 ? 1 : 0.7);
                height = maxHeight * 2 - cellPadding;
                
                // Mark the second cell as occupied
                occupiedCells.add(`${cellX},${cellY+1}`);
            } else {
                // Standard rectangle
                width = Math.max(0.05, Math.min(maxWidth, Math.random() * maxWidth * 0.9 + maxWidth * 0.1));
                
                // Sometimes use golden ratio for height, sometimes make it square-ish
                height = Math.random() < 0.6 ? width * goldenRatio : width;
                
                // Make sure height is within bounds
                height = Math.min(height, maxHeight);
            }
            
            // Calculate position within the cell
            const margin = cellPadding;
            const x = cellX * cellWidth + margin + (cellWidth - width - margin * 2) * Math.random();
            const y = cellY * cellHeight + margin + (cellHeight - height - margin * 2) * Math.random();
            
            // Shader type - randomize between available types
            // Get this from the pipeline to ensure we don't exceed available types
            const maxShaderTypes = this.shaderRectPipeline.shaderTypeCount || 1;
            const shaderType = Math.floor(Math.random() * maxShaderTypes);
            
            rects.push({
                position: [x, y],
                size: [width, height],
                shaderType
            });
        }
        
        // Update the rectangles in the pipeline
        this.shaderRectPipeline.updateRectangles(rects);
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
        
        // Handle shader rect changes
        this.accumulatedShaderRectTime += rawDeltaTime * 1000;
        if (this.accumulatedShaderRectTime >= this.shaderRectChangeInterval) {
            this.updateShaderRects();
            this.accumulatedShaderRectTime = 0;
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

        // Render main flocking scene
        this.pipeline.render(commandEncoder, passDescriptor, this.birds, this.predator, textureView, depthView);
        
        // Render shader rectangles on top
        this.shaderRectPipeline.render(commandEncoder, textureView);
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
        document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
        
        // Cleanup pipeline
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Cleanup shader rect pipeline
        if (this.shaderRectPipeline) {
            this.shaderRectPipeline.cleanup();
            this.shaderRectPipeline = null;
        }

        // Cleanup birds
        if (this.birds && this.birds.length > 0) {
            this.birds.forEach((bird) => {
                if (bird && typeof bird.cleanup === 'function') {
                    bird.cleanup();
                }
            });
            this.birds = [];
        }

        // Cleanup predator
        if (this.predator) {
            if (typeof this.predator.cleanup === 'function') {
                this.predator.cleanup();
            }
            this.predator = null;
        }
        
        // Cleanup guiding line
        if (this.guidingLine) {
            if (typeof this.guidingLine.cleanup === 'function') {
                this.guidingLine.cleanup();
            }
            this.guidingLine = null;
        }
        
        // Reset performance tracking
        this.frameCount = 0;
        this.frameTimes = [];
        this.performanceScaleFactor = 1.0;
        this.accumulatedTargetTime = 0;
        this.accumulatedShaderRectTime = 0;
        
        // Call parent cleanup to handle common resources and tracking
        super.cleanup();
    }

    handleResize(width, height) {
        // Update viewport dimensions in pipeline
        if (this.pipeline) {
            this.pipeline.updateViewportDimensions(width, height);
        }
        
        // Update shader rect pipeline dimensions
        if (this.shaderRectPipeline) {
            this.shaderRectPipeline.updateViewportDimensions(width, height);
        }
        
        // Update camera aspect ratio if needed
        if (this.resourceManager && this.resourceManager.camera) {
            this.resourceManager.camera.updateAspect(width, height);
        }
        
        // Update depth texture if needed - add null check like in GridCodeExperience
        if (this.resourceManager && typeof this.resourceManager.updateDepthTexture === 'function') {
            this.resourceManager.updateDepthTexture(width, height);
        }
        
        // Update the viewport buffer with new dimensions
        if (this.resourceManager && this.resourceManager.getViewportBuffer()) {
            const viewportArray = new Float32Array([width, height]);
            this.device.queue.writeBuffer(this.resourceManager.getViewportBuffer(), 0, viewportArray);
        }
    }
}

export default FlockingExperience;