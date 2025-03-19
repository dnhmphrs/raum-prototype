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

        // Shader rectangle configuration - more minimal, aesthetic approach
        this.shaderRectCount = 2; // Fewer, more intentional rectangles
        this.maxShaderRectCount = 5; // Keep max count lower for cleaner aesthetics
        
        // Much slower changes for more intentional, sustained visual impact
        this.shaderRectChangeInterval = 3500; // 3.5 seconds - more deliberate pacing
        this.lastShaderRectChangeTime = this.lastTime;
        this.accumulatedShaderRectTime = 0;
        
        // Design constants
        this.goldenRatio = 1.618; // Golden ratio for aesthetically pleasing proportions
        this.phi = 0.618; // 1/golden ratio, used for sizing and positioning
        
        // Grid layout - more refined placement using golden ratio divisions
        this.gridCols = 8; // More granular grid for precise positioning
        this.gridRows = 5; // Based on golden ratio proportions
        
        // Key points for rectangle positioning (rule of thirds + golden ratio points)
        this.keyPoints = [
            [this.phi * 0.5, this.phi * 0.3], // Left golden ratio point
            [1 - this.phi * 0.5, this.phi * 0.3], // Right golden ratio point
            [this.phi * 0.5, 1 - this.phi * 0.3], // Bottom left golden ratio
            [1 - this.phi * 0.5, 1 - this.phi * 0.3], // Bottom right golden ratio
            [1/3, 1/3], // Top left third
            [2/3, 1/3], // Top right third
            [1/3, 2/3], // Bottom left third
            [2/3, 2/3], // Bottom right third
            [0.5, this.phi], // Center golden point
            [this.phi, 0.5]  // Right golden point
        ];
        
        // Rectangle size variations - more precise proportions
        this.sizeVariations = [
            [0.38, 0.235], // Golden ratio width:height
            [0.235, 0.38], // Golden ratio height:width
            [0.5, 0.309], // Wider golden ratio
            [0.26, 0.158], // Smaller golden ratio
            [0.62, 0.062], // Very wide, thin bar
            [0.092, 0.42]  // Very tall, thin bar
        ];

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
        // Safety check - make sure pipeline exists and is initialized
        if (!this.shaderRectPipeline || !this.shaderRectPipeline.isInitialized) {
            // Schedule another attempt later
            setTimeout(() => this.updateShaderRects(true), 100);
            return;
        }
    
        // Determine if we should update rectangles based on fixed interval and randomness
        if (forceUpdate || Math.random() < 0.35) { // Lower chance of change for more stability
            const prevCount = this.shaderRectCount;
            
            // Use 10-14 rectangles for a tighter array of strips
            this.shaderRectCount = 10 + Math.floor(Math.random() * 5);
            
            // If count changed, update the pipeline
            if (prevCount !== this.shaderRectCount || forceUpdate) {
                try {
                    this.shaderRectPipeline.updateRectCount(this.shaderRectCount);
                } catch (e) {
                    console.error("Error updating rect count:", e);
                    return;
                }
            }
        }
        
        // Generate aesthetically pleasing rectangle arrangements
        const rects = [];
        
        // Safety check - ensure we have at least one rectangle
        if (this.shaderRectCount < 1) {
            this.shaderRectCount = 1;
        }
        
        // Choose a composition style - either horizontal bars or vertical bars
        const useHorizontalBars = Math.random() > 0.5;
        
        // Generate golden ratio-based bar collection
        this.createGoldenRatioBars(rects, useHorizontalBars);
        
        // Update the rectangles in the pipeline
        if (rects.length > 0) {
            this.shaderRectPipeline.updateRectangles(rects);
        }
    }
    
    createGoldenRatioBars(rects, useHorizontalBars) {
        // Golden ratio for proportions
        const phi = this.phi; // 0.618
        
        // Choose a unified shader type for consistency
        const shaderType = Math.floor(Math.random() * this.shaderRectPipeline.shaderTypeCount);
        
        // Calculate the number of strips for an extremely dense diffraction-like pattern
        // Far more strips for a really tight array - but keep odd number for center symmetry
        const totalStrips = this.shaderRectCount * 2 + 1; // Ensure odd number for center symmetry
        
        // Time-based warping factors - uses sine waves with different frequencies
        // to create subtle organic movement
        const timeNow = performance.now() / 1000;
        const breatheAmount = Math.sin(timeNow * 0.2) * 0.15 + 0.85; // 0.7-1.0 range for breathing
        const waveAmount = Math.sin(timeNow * 0.37) * 0.06; // Small sine wave for position warping
        const phaseShift = Math.cos(timeNow * 0.13) * 0.1; // Phase shift for asymmetric warping
        
        if (useHorizontalBars) {
            // Create horizontal bars - full width
            // Nearly no gap - extremely tight packing like a diffraction grating
            const minimalGap = 0.0005; // Extremely small gap between strips
            
            // Calculate center of screen
            const centerY = 0.5;
            
            // Width of the center (largest) strip - with subtle breathing
            const centerStripHeight = 0.065 * (breatheAmount + 0.1); // 6.5% - tighter size
            
            // Place the center strip first - with subtle position shift
            const centerIndex = Math.floor(totalStrips / 2);
            rects.push({
                position: [0, centerY - centerStripHeight/2 + waveAmount],
                size: [1.0, centerStripHeight],
                shaderType: shaderType
            });
            
            // Place strips above and below center, scaling by golden ratio
            let currentHeight = centerStripHeight;
            
            // Create strips above center (going up)
            let posY = centerY - centerStripHeight/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down more quickly - closer to original golden ratio
                const warpFactor = 1.0 + Math.sin(i * 0.7 + timeNow * 0.4) * 0.04;
                // Reduced shrinkage rate - more moderate
                currentHeight *= (0.7 * warpFactor); 
                
                // Individual strip wave effect - each strip moves differently
                const stripWave = waveAmount * Math.sin(i * 0.8 + timeNow * 0.3 + phaseShift);
                
                // Move up by previous height plus minimal gap
                posY -= (currentHeight + minimalGap);
                
                // Add the strip with position warping
                rects.push({
                    position: [0, posY + stripWave],
                    size: [1.0, currentHeight],
                    shaderType: shaderType
                });
            }
            
            // Reset for strips below center
            currentHeight = centerStripHeight;
            
            // Create strips below center (going down)
            posY = centerY + centerStripHeight/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down more quickly - closer to original golden ratio
                const warpFactor = 1.0 + Math.cos(i * 0.7 + timeNow * 0.4) * 0.04;
                // Reduced shrinkage rate - more moderate
                currentHeight *= (0.7 * warpFactor);
                
                // Individual strip wave effect - each strip moves differently
                const stripWave = waveAmount * Math.sin(i * 0.8 + timeNow * 0.3 - phaseShift);
                
                // Add the strip right after the previous one with position warping
                rects.push({
                    position: [0, posY + minimalGap + stripWave],
                    size: [1.0, currentHeight],
                    shaderType: shaderType
                });
                
                // Move down by current height plus minimal gap
                posY += (currentHeight + minimalGap);
            }
        } else {
            // Create vertical bars - full height
            // Nearly no gap - extremely tight packing like a diffraction grating
            const minimalGap = 0.0005; // Extremely small gap between strips
            
            // Calculate center of screen
            const centerX = 0.5;
            
            // Width of the center (largest) strip - with subtle breathing
            const centerStripWidth = 0.065 * (breatheAmount + 0.1); // 6.5% - tighter size
            
            // Place the center strip first - with subtle position shift
            const centerIndex = Math.floor(totalStrips / 2);
            rects.push({
                position: [centerX - centerStripWidth/2 + waveAmount, 0],
                size: [centerStripWidth, 1.0],
                shaderType: shaderType
            });
            
            // Place strips to left and right of center, scaling by golden ratio
            let currentWidth = centerStripWidth;
            
            // Create strips to the left of center
            let posX = centerX - centerStripWidth/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down more quickly - closer to original golden ratio
                const warpFactor = 1.0 + Math.sin(i * 0.7 + timeNow * 0.4) * 0.04;
                // Reduced shrinkage rate - more moderate
                currentWidth *= (0.7 * warpFactor);
                
                // Individual strip wave effect - each strip moves differently
                const stripWave = waveAmount * Math.sin(i * 0.8 + timeNow * 0.3 + phaseShift);
                
                // Move left by current width plus minimal gap
                posX -= (currentWidth + minimalGap);
                
                // Add the strip with position warping
                rects.push({
                    position: [posX + stripWave, 0],
                    size: [currentWidth, 1.0],
                    shaderType: shaderType
                });
            }
            
            // Reset for strips to the right
            currentWidth = centerStripWidth;
            
            // Create strips to the right of center
            posX = centerX + centerStripWidth/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down more quickly - closer to original golden ratio
                const warpFactor = 1.0 + Math.cos(i * 0.7 + timeNow * 0.4) * 0.04;
                // Reduced shrinkage rate - more moderate
                currentWidth *= (0.7 * warpFactor);
                
                // Individual strip wave effect - each strip moves differently
                const stripWave = waveAmount * Math.sin(i * 0.8 + timeNow * 0.3 - phaseShift);
                
                // Add the strip right after the previous one with position warping
                rects.push({
                    position: [posX + minimalGap + stripWave, 0],
                    size: [currentWidth, 1.0],
                    shaderType: shaderType
                });
                
                // Move right by current width plus minimal gap
                posX += (currentWidth + minimalGap);
            }
        }
        
        // Sometimes create oscillating alternating shader types for visual rhythm
        if (Math.random() > 0.5) {
            const alternateShaderType = Math.floor(Math.random() * this.shaderRectPipeline.shaderTypeCount);
            if (alternateShaderType !== shaderType) {
                // Use Fibonacci-like pattern (1,1,2,3,5,8...) for shader type alternation
                // to create a more interesting visual rhythm
                let a = 1, b = 1;
                for (let i = 0; i < rects.length; i++) {
                    // Time-based oscillation for shader types
                    const shaderOscillation = Math.sin(i * 0.5 + timeNow * 0.17) > 0;
                    
                    if (i === a && shaderOscillation) {
                        rects[i].shaderType = alternateShaderType;
                        const next = a + b;
                        a = b;
                        b = next;
                    }
                }
            }
        }
    }

    render(commandEncoder, textureView) {
        try {
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
            
            // Handle shader rect changes - only if more than 3 frames have passed since last change
            this.accumulatedShaderRectTime += rawDeltaTime * 1000;
            if (this.accumulatedShaderRectTime >= this.shaderRectChangeInterval) {
                // Wrap in try/catch to prevent rendering issues if this fails
                try {
                    this.updateShaderRects();
                } catch (e) {
                    console.error("Error in shader rect update:", e);
                }
                this.accumulatedShaderRectTime = 0;
            } else {
                // Continuous subtle updates between major changes
                // This creates constant micro-movements in the strips
                // Only do this if we have more than 10 frames since the last major update
                if (this.accumulatedShaderRectTime > 100 && this.shaderRectPipeline && this.shaderRectPipeline.isInitialized) {
                    const rects = [];
                    // Choose the same bar orientation
                    const useHorizontalBars = this.lastBarOrientation || Math.random() > 0.5;
                    this.lastBarOrientation = useHorizontalBars;
                    
                    // Update with subtle shifts only - no complete change
                    this.createGoldenRatioBars(rects, useHorizontalBars);
                    
                    if (rects.length > 0) {
                        this.shaderRectPipeline.updateRectangles(rects);
                    }
                }
            }

            // Render the pipeline (includes compute pass and render pass)
            const depthView = this.resourceManager.getDepthTextureView();

            // First execute the compute passes (for both birds and predator)
            this.pipeline.runComputePasses(commandEncoder);
            
            // Setup render pass descriptor with a clear color
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
            
            // NEW RENDERING ORDER:
            // 1. First render just the background
            this.pipeline.renderBackground(commandEncoder, passDescriptor);
            
            // 2. Now render shader rectangles on top of the background
            if (this.shaderRectPipeline && this.shaderRectPipeline.isInitialized && !this.shaderRectPipeline.bufferUpdateInProgress) {
                this.shaderRectPipeline.render(commandEncoder, textureView);
            }
            
            // 3. Finally render the birds and predator
            this.pipeline.renderEntities(commandEncoder, textureView, depthView, this.birds, this.predator);
        } catch (e) {
            console.error("Error in FlockingExperience render:", e);
        }
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