// FlockingExperience.js

import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import PredatorGeometry from './PredatorGeometry';
import GuidingLineGeometry from './GuidingLineGeometry'
import FlockingPipeline from './FlockingPipeline';
import ShaderRectPipeline from './ShaderRectPipeline';
import DitherPostProcessPipeline from './DitherPostProcessPipeline';
import TextOverlayPipeline from './TextOverlayPipeline';

class FlockingExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        this.birdCount = 2048; // Adjusted for performance
        this.lastTime = performance.now(); // Initialize lastTime
        
        // Performance tracking variables
        this.frameCount = 0;
        this.frameTimes = [];
        this.maxFrameHistory = 60; // Track last 60 frames for averaging
        this.performanceScaleFactor = 0.5; // Initial scale factor - SLOWED DOWN from 1.0
        this.targetFrameTime = 4.0; // Target ~60fps (in ms)

        // Timer variables
        this.targetChangeInterval = 20000; // 20 seconds - SLOWED DOWN from 10 seconds
        this.lastTargetChangeTime = this.lastTime;
        this.accumulatedTargetTime = 0; // Accumulated time for target changes

        // Separate storage for birds and predator
        this.birds = []; // Array to hold all bird geometries
        this.predator = null; // Single reference for the predator

        // Shader rectangle configuration - more minimal, aesthetic approach
        this.shaderRectCount = 2; // Fewer, more intentional rectangles
        this.maxShaderRectCount = 5; // Keep max count lower for cleaner aesthetics
        
        // More frequent changes for dynamic visuals
        this.shaderRectChangeInterval = 3500; // 3.5 seconds - faster than previous 7 seconds
        this.lastShaderRectChangeTime = this.lastTime;
        this.accumulatedShaderRectTime = 0;
        
        // Orientation management with improved initialization
        this.orientationState = {
            isHorizontal: Math.random() > 0.5, // random starting orientation
            periodDuration: 8000, // how long to stay in one orientation (ms)
            glitchDuration: 1200,  // how long glitches last (ms) - increased from 300ms to 1.2s
            glitchProbability: 0.02, // probability of glitches per second (2%)
            lastMajorChange: performance.now(), // Initialize with current time
            lastGlitchEnd: 0  // No glitches at start
        };
        
        // Predator velocity tracking for bar variations
        this.predatorVelocity = {
            x: 0,
            y: 0, 
            magnitude: 0,
            raw: { x: 0, y: 0, z: 0 }
        };
        
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

        // Initialize the DitherPostProcess pipeline
        this.ditherPostProcessPipeline = new DitherPostProcessPipeline(
            this.device,
            resourceManager.getViewportBuffer(),
            this.canvas ? this.canvas.width : 800,
            this.canvas ? this.canvas.height : 600
        );

        // Initialize the TextOverlay pipeline
        this.textOverlayPipeline = new TextOverlayPipeline(
            this.device,
            resourceManager.getViewportBuffer(),
            this.pipeline ? this.pipeline.predatorVelocityBuffer : null,
            this.canvas ? this.canvas.width : 800,
            this.canvas ? this.canvas.height : 600
        );

        // Post-processing render textures
        this.intermediateTexture = null;
        this.intermediateTextureView = null;

        // Dither effect settings - optimized for extreme pixelation
        this.ditherSettings = {
            patternScale: 1.0,       // Controls pixel size (lower = larger pixels)
            thresholdOffset: -0.05,   // Slight negative offset for stronger contrast
            noiseIntensity: 0.08,     // Just a bit of noise to break up patterns
            colorReduction: 2.0,      // Very low value for extreme color banding 
            enabled: true             // Enabled by default
        };

        this.addBirds();
        this.addPredator();

        this.guidingLine = new GuidingLineGeometry(this.device);
        this.addObject(this.guidingLine);

        // Bind the visibility change handler and store the bound function
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
    }

    async initialize() {
        // Initialize the FlockingPipeline first
        await this.pipeline.initialize();
        
        // Now initialize the other pipelines
        await this.shaderRectPipeline.initialize();
        await this.ditherPostProcessPipeline.initialize();
        await this.textOverlayPipeline.initialize();

        // Create intermediate render textures for post-processing
        this.createPostProcessingTextures();

        // Apply initial dither settings
        this.updateDitherSettings();

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

        // Now that everything is initialized and the predator buffer is ready,
        // update the reference in the TextOverlayPipeline
        if (this.textOverlayPipeline && this.pipeline && this.pipeline.predatorVelocityBuffer) {
            this.textOverlayPipeline.updatePredatorVelocityBuffer(this.pipeline.predatorVelocityBuffer);
        } else {
            console.warn("Unable to update predatorVelocityBuffer in TextOverlayPipeline");
        }

        // Initialize shader rectangles with randomized positions and dimensions
        this.updateShaderRects(true);
    }

    createPostProcessingTextures() {
        // Get the canvas dimensions (or use defaults)
        const width = this.canvas ? this.canvas.width : 800;
        const height = this.canvas ? this.canvas.height : 600;
        
        // Create a texture for intermediate rendering
        this.intermediateTexture = this.device.createTexture({
            size: [width, height],
            format: navigator.gpu.getPreferredCanvasFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        
        // Create the texture view
        this.intermediateTextureView = this.intermediateTexture.createView();
    }

    updateDitherSettings() {
        if (this.ditherPostProcessPipeline && this.ditherPostProcessPipeline.isInitialized) {
            this.ditherPostProcessPipeline.setSettings(
                this.ditherSettings.patternScale,
                this.ditherSettings.thresholdOffset,
                this.ditherSettings.noiseIntensity,
                this.ditherSettings.colorReduction
            );
        }
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
        
        // Update performance scale factor - APPLY MAX SLOWDOWN FACTOR 
        // Reduced max value from 0.5 to 0.25 to slow everything down
        this.performanceScaleFactor = Math.min(0.25, this.targetFrameTime / Math.max(1.0, avgFrameTime));

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
    
        // Don't update if a buffer update is already in progress
        if (this.shaderRectPipeline.bufferUpdateInProgress) {
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
        
        // Try-catch the entire rect generation to prevent inconsistent state
        try {
            // Generate aesthetically pleasing rectangle arrangements
            const rects = [];
            
            // Safety check - ensure we have at least one rectangle
            if (this.shaderRectCount < 1) {
                this.shaderRectCount = 1;
            }
            
            // Get the current orientation using our orientation manager
            // This will consider both long-term orientation and glitches
            const useHorizontalBars = this.getCurrentOrientation(forceUpdate);
            
            // Generate golden ratio-based bar collection
            this.createGoldenRatioBars(rects, useHorizontalBars);
            
            // Update the rectangles in the pipeline only if we have rectangles to update
            if (rects.length > 0) {
                this.shaderRectPipeline.updateRectangles(rects);
            }
        } catch (err) {
            // Log error but don't crash
            console.error("Error in updateShaderRects:", err);
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
        // Now influenced by predator motion
        const timeNow = (performance.now() / 1000); // Normal speed time factor
        
        // Get predator velocity influence - default to base values if no predator data
        const predatorInfluence = this.predatorVelocity ? this.predatorVelocity.magnitude : 0;
        const predatorDirectionX = this.predatorVelocity ? this.predatorVelocity.x : 0;
        const predatorDirectionY = this.predatorVelocity ? this.predatorVelocity.y : 0;
        
        // Base animation values modified by predator movement
        // Increase wave/breathing effects when predator moves faster
        const predatorSpeedFactor = 0.5 + predatorInfluence * 0.5; // 0.5-1.0 range
        
        // Breathing effect increases with predator speed
        const breatheAmount = (Math.sin(timeNow * 0.35) * 0.10 + 0.85) * predatorSpeedFactor;
        
        // Wave amount influenced by predator's lateral movement (X for horizontal bars, Y for vertical)
        const waveMultiplier = useHorizontalBars ? Math.abs(predatorDirectionX) : Math.abs(predatorDirectionY);
        const waveAmount = Math.sin(timeNow * 0.5) * 0.05 * (1.0 + waveMultiplier);
        
        // Phase shift influenced by predator's movement direction
        const directionInfluence = useHorizontalBars ? predatorDirectionY : predatorDirectionX;
        const phaseShift = Math.cos(timeNow * 0.22) * 0.07 + directionInfluence * 0.05;
        
        if (useHorizontalBars) {
            // Create horizontal bars - full width
            // Nearly no gap - extremely tight packing like a diffraction grating
            const minimalGap = 0.0003; // Even smaller gap between strips
            
            // Calculate center of screen with movement influenced by predator's vertical movement
            const centerYOffset = Math.sin(timeNow * 0.3) * 0.02 + predatorDirectionY * 0.02;
            const centerY = 0.5 + centerYOffset;
            
            // Width of the center (largest) strip - with breathing influenced by predator speed
            const centerStripHeight = 0.065 * (breatheAmount + 0.10);
            
            // Place the center strip first - position influenced by predator movement
            const centerIndex = Math.floor(totalStrips / 2);
            rects.push({
                position: [0, centerY - centerStripHeight/2 + waveAmount * 0.5],
                size: [1.0, centerStripHeight],
                shaderType: shaderType
            });
            
            // Place strips above and below center, scaling by golden ratio
            let currentHeight = centerStripHeight;
            
            // Create strips above center (going up)
            let posY = centerY - centerStripHeight/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down with warping influenced by predator speed
                const warpFactor = 1.0 + Math.sin(i * 0.7 + timeNow * 1.2) * (0.05 + predatorInfluence * 0.05);
                // Shrinkage rate varies slightly with predator movement
                const shrinkRate = 0.75 + (predatorDirectionY * 0.05);
                currentHeight *= (shrinkRate * warpFactor);
                
                // Individual strip wave effect - influenced by predator motion
                const stripWave = waveAmount * 0.5 * Math.sin(i * 1.0 + timeNow * 0.8 + phaseShift);
                
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
                // Scale down with warping influenced by predator speed
                const warpFactor = 1.0 + Math.cos(i * 0.7 + timeNow * 1.2) * (0.05 + predatorInfluence * 0.05);
                // Shrinkage rate varies slightly with predator movement
                const shrinkRate = 0.75 + (predatorDirectionY * 0.05);
                currentHeight *= (shrinkRate * warpFactor);
                
                // Individual strip wave effect - influenced by predator motion
                const stripWave = waveAmount * 0.5 * Math.sin(i * 1.0 + timeNow * 0.8 - phaseShift);
                
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
            const minimalGap = 0.0003; // Even smaller gap between strips
            
            // Calculate center of screen with movement influenced by predator's horizontal movement
            const centerXOffset = Math.sin(timeNow * 0.3) * 0.02 + predatorDirectionX * 0.02;
            const centerX = 0.5 + centerXOffset;
            
            // Width of the center (largest) strip - with breathing influenced by predator speed
            const centerStripWidth = 0.065 * (breatheAmount + 0.10);
            
            // Place the center strip first - position influenced by predator movement
            const centerIndex = Math.floor(totalStrips / 2);
            rects.push({
                position: [centerX - centerStripWidth/2 + waveAmount * 0.5, 0],
                size: [centerStripWidth, 1.0],
                shaderType: shaderType
            });
            
            // Place strips to left and right of center, scaling by golden ratio
            let currentWidth = centerStripWidth;
            
            // Create strips to the left of center
            let posX = centerX - centerStripWidth/2;
            for (let i = 1; i <= centerIndex; i++) {
                // Scale down with warping influenced by predator speed
                const warpFactor = 1.0 + Math.sin(i * 0.7 + timeNow * 1.2) * (0.05 + predatorInfluence * 0.05);
                // Shrinkage rate varies slightly with predator movement
                const shrinkRate = 0.75 + (predatorDirectionX * 0.05);
                currentWidth *= (shrinkRate * warpFactor);
                
                // Individual strip wave effect - influenced by predator motion
                const stripWave = waveAmount * 0.5 * Math.sin(i * 1.0 + timeNow * 0.8 + phaseShift);
                
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
                // Scale down with warping influenced by predator speed
                const warpFactor = 1.0 + Math.cos(i * 0.7 + timeNow * 1.2) * (0.05 + predatorInfluence * 0.05);
                // Shrinkage rate varies slightly with predator movement
                const shrinkRate = 0.75 + (predatorDirectionX * 0.05);
                currentWidth *= (shrinkRate * warpFactor);
                
                // Individual strip wave effect - influenced by predator motion
                const stripWave = waveAmount * 0.5 * Math.sin(i * 1.0 + timeNow * 0.8 - phaseShift);
                
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

    // New method to update shader rectangles with predator velocity
    updateShaderRectsWithPredatorData() {
        // Safety check - make sure pipeline exists and is initialized
        if (!this.shaderRectPipeline || !this.shaderRectPipeline.isInitialized || this.bufferUpdateInProgress) {
            return;
        }
        
        // Get predator velocity from the pipeline's buffer
        if (!this.pipeline || !this.pipeline.predatorVelocityBuffer) {
            return;
        }
        
        // Create a buffer to read predator velocity data
        const readBuffer = this.device.createBuffer({
            size: 12, // 3 floats (vec3)
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        
        // Create command encoder
        const encoder = this.device.createCommandEncoder();
        
        // Copy data from predator velocity buffer to read buffer
        encoder.copyBufferToBuffer(
            this.pipeline.predatorVelocityBuffer, 0,
            readBuffer, 0,
            12
        );
        
        // Submit commands
        this.device.queue.submit([encoder.finish()]);
        
        // Map the buffer to read the data
        readBuffer.mapAsync(GPUMapMode.READ).then(() => {
            // Get data as Float32Array
            const data = new Float32Array(readBuffer.getMappedRange());
            
            // Normalize the velocity for use as Julia set parameters
            const length = Math.sqrt(data[0] * data[0] + data[1] * data[1] + data[2] * data[2]);
            
            // Default heading if velocity is near zero
            let headingX = 0;
            let headingY = 0;
            
            if (length > 0.001) {
                // Normalize and get just the X and Y components for the 2D Julia set
                headingX = data[0] / length;
                headingY = data[1] / length;
            }
            
            // Store the predator velocity data for bar variations
            this.predatorVelocity = {
                x: headingX,
                y: headingY,
                magnitude: Math.min(1.0, length), // Clamp magnitude to 1.0 maximum
                raw: {
                    x: data[0],
                    y: data[1],
                    z: data[2]
                }
            };
            
            // Create custom data with predator heading in the first two components
            const rectCount = this.shaderRectPipeline.rectCount;
            const customData = new Float32Array(rectCount * 4);
            
            // Set the same predator heading values for all rectangles
            for (let i = 0; i < rectCount; i++) {
                const dataIndex = i * 4;
                customData[dataIndex] = headingX;       // predator heading X
                customData[dataIndex + 1] = headingY;   // predator heading Y
                customData[dataIndex + 2] = Math.random(); // random parameter 3
                customData[dataIndex + 3] = Math.random(); // random parameter 4
            }
            
            // Update custom data in shader rect pipeline
            this.device.queue.writeBuffer(
                this.shaderRectPipeline.rectDataBuffer,
                0,
                customData
            );
            
            // Unmap the buffer
            readBuffer.unmap();
        }).catch(error => {
            console.error("Error mapping predator velocity buffer:", error);
            readBuffer.unmap();
        });
    }

    render(commandEncoder, textureView) {
        try {
            // Calculate deltaTime
            const now = performance.now();
            const rawDeltaTime = (now - this.lastTime) / 1000; // in seconds
            this.lastTime = now;
            
            // Update performance metrics
            this.updatePerformanceMetrics(rawDeltaTime * 1000); // Convert to ms for metrics
            
            // Apply performance scaling to deltaTime and ADDITIONAL SLOWDOWN factor
            let deltaTime = rawDeltaTime * this.performanceScaleFactor * 0.5; // SLOWED DOWN by applying additional 0.5 factor
            
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
            
            // First execute the compute passes (for both birds and predator)
            this.pipeline.runComputePasses(commandEncoder);
            
            // NEW: Update shader rects with predator velocity data 
            // This ensures the Julia set is influenced by the predator's actual heading
            this.updateShaderRectsWithPredatorData();
            
            // Handle shader rect changes - only if more than 3 frames have passed since last change
            this.accumulatedShaderRectTime += rawDeltaTime * 1000;
            if (this.accumulatedShaderRectTime >= this.shaderRectChangeInterval) {
                // Wrap in try/catch to prevent rendering issues if this fails
                try {
                    this.updateShaderRects(true); // Force update for major changes
                } catch (e) {
                    console.error("Error in shader rect update:", e);
                }
                this.accumulatedShaderRectTime = 0;
            } else {
                // Continuous updates for constant movement
                // Do this almost every frame for more dynamic movement
                if (this.accumulatedShaderRectTime > 33 && this.shaderRectPipeline && this.shaderRectPipeline.isInitialized) {
                    // Only update if not currently in a buffer update process
                    if (!this.shaderRectPipeline.bufferUpdateInProgress) {
                        const rects = [];
                        
                        // Get current orientation using our orientation manager
                        // This handles both lingering on orientations and occasional glitches
                        const useHorizontalBars = this.getCurrentOrientation(false);
                        
                        // Only update if we have a valid shader rect pipeline
                        try {
                            // Update with continuous movement
                            this.createGoldenRatioBars(rects, useHorizontalBars);
                            
                            if (rects.length > 0) {
                                this.shaderRectPipeline.updateRectangles(rects);
                            }
                        } catch (e) {
                            // Silently catch errors to prevent disruptions
                            // We'll just skip this frame's update
                        }
                    }
                }
            }

            // Get the depth texture view
            const depthView = this.resourceManager.getDepthTextureView();

            // Determine which texture view to render to (intermediate or final)
            const renderTarget = this.ditherSettings.enabled ? this.intermediateTextureView : textureView;

            // Setup render pass descriptor with a clear color
            const passDescriptor = {
                colorAttachments: [
                    {
                        view: renderTarget,
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
            
            // RENDERING ORDER:
            // 1. First render just the background
            this.pipeline.renderBackground(commandEncoder, passDescriptor);
            
            // 2. Now render shader rectangles on top of the background
            if (this.shaderRectPipeline && this.shaderRectPipeline.isInitialized && !this.shaderRectPipeline.bufferUpdateInProgress) {
                this.shaderRectPipeline.render(commandEncoder, renderTarget);
            }
            
            // 3. Render the birds and predator
            this.pipeline.renderEntities(commandEncoder, renderTarget, depthView, this.birds, this.predator);

            // 4. Apply post-processing dither effect if enabled
            if (this.ditherSettings.enabled && this.ditherPostProcessPipeline && this.ditherPostProcessPipeline.isInitialized) {
                this.ditherPostProcessPipeline.render(commandEncoder, this.intermediateTextureView, textureView);
            }

            // 5. Render the text overlay as the final layer (on top of everything)
            const finalTextureView = this.ditherSettings.enabled ? textureView : renderTarget;
            if (this.textOverlayPipeline && this.textOverlayPipeline.isInitialized) {
                this.textOverlayPipeline.render(commandEncoder, finalTextureView);
            }
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
        
        // Cleanup dither post-process pipeline
        if (this.ditherPostProcessPipeline) {
            this.ditherPostProcessPipeline.cleanup();
            this.ditherPostProcessPipeline = null;
        }
        
        // Cleanup text overlay pipeline
        if (this.textOverlayPipeline) {
            this.textOverlayPipeline.cleanup();
            this.textOverlayPipeline = null;
        }
        
        // Cleanup intermediate textures
        if (this.intermediateTexture) {
            this.intermediateTexture.destroy();
            this.intermediateTexture = null;
            this.intermediateTextureView = null;
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
        
        // Update dither post-process pipeline dimensions
        if (this.ditherPostProcessPipeline) {
            this.ditherPostProcessPipeline.updateViewportDimensions(width, height);
        }
        
        // Update text overlay pipeline dimensions
        if (this.textOverlayPipeline) {
            this.textOverlayPipeline.updateViewportDimensions(width, height);
        }
        
        // Update post-processing textures
        this.recreatePostProcessingTextures(width, height);
        
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

    recreatePostProcessingTextures(width, height) {
        // Clean up existing textures if they exist
        if (this.intermediateTexture) {
            this.intermediateTexture.destroy();
        }
        
        // Create new textures with updated dimensions
        this.intermediateTexture = this.device.createTexture({
            size: [width, height],
            format: navigator.gpu.getPreferredCanvasFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        
        // Create new texture view
        this.intermediateTextureView = this.intermediateTexture.createView();
    }

    // Method to toggle the dither effect on/off
    toggleDitherEffect(enabled) {
        this.ditherSettings.enabled = enabled;
    }

    // Method to update dither effect settings
    updateDitherEffectSettings(patternScale, thresholdOffset, noiseIntensity, colorReduction) {
        this.ditherSettings.patternScale = patternScale;
        this.ditherSettings.thresholdOffset = thresholdOffset;
        this.ditherSettings.noiseIntensity = noiseIntensity;
        this.ditherSettings.colorReduction = colorReduction;
        this.updateDitherSettings();
    }

    // Determine the current bar orientation based on long periods with occasional glitches
    getCurrentOrientation(forceUpdate = false) {
        const now = performance.now();
        const state = this.orientationState;
        
        // For forced updates (major changes), consider changing the base orientation
        if (forceUpdate) {
            // Only change base orientation if enough time has passed (at least one full period)
            const timeSinceLastMajorChange = now - state.lastMajorChange;
            
            if (timeSinceLastMajorChange > state.periodDuration) {
                // 30% chance to switch orientation on major updates
                if (Math.random() < 0.3) {
                    state.isHorizontal = !state.isHorizontal;
                    state.lastMajorChange = now;
                }
            }
            
            // Return the base orientation (no glitches during forced updates)
            return state.isHorizontal;
        }
        
        // For regular updates, calculate normal orientation cycle
        // Check which period we're in
        const periodIndex = Math.floor(now / state.periodDuration);
        const previousPeriodIndex = Math.floor(state.lastMajorChange / state.periodDuration);
        
        // If we've entered a new period, potentially change the base orientation
        if (periodIndex > previousPeriodIndex) {
            // 40% chance to change orientation when entering a new period
            if (Math.random() < 0.4) {
                state.isHorizontal = !state.isHorizontal;
                state.lastMajorChange = now;
            } else {
                // Even if we don't change orientation, update the lastMajorChange time
                // to prevent checking again until next period
                state.lastMajorChange = now;
            }
        }
        
        // Check if we're currently in the middle of a glitch
        // Fix: ensure the glitch end time is actually in the future
        const currentGlitchEndTime = state.lastGlitchEnd;
        if (currentGlitchEndTime > now) {
            // We're in an active glitch period - return opposite orientation
            return !state.isHorizontal;
        }
        
        // Calculate if we should start a new glitch
        // Only when we're not already in a glitch period
        
        // Fix: Use a more robust time-based random seed approach
        // Use the current second as seed, with a prime multiplier for better distribution
        const seconds = Math.floor(now / 1000);
        const glitchSeed = seconds * 31; // Prime number multiplier
        const glitchRandom = Math.abs(Math.sin(glitchSeed)) * 0.99; // 0-0.99 range
        
        // Determine if we should be in a glitch state (2% chance per second)
        const shouldGlitch = glitchRandom < 0.02;
        
        // Don't allow glitches too close to each other (at least 7 seconds between)
        // Or too close to a major orientation change (at least 4 seconds after)
        const timeSinceLastGlitch = now - state.lastGlitchEnd;
        const timeSinceLastMajorChange = now - state.lastMajorChange;
        const canGlitch = timeSinceLastGlitch > 7000 && timeSinceLastMajorChange > 4000;
        
        // If we should start a new glitch
        if (shouldGlitch && canGlitch) {
            // Set when the current glitch will end
            state.lastGlitchEnd = now + state.glitchDuration;
            
            // Return the opposite orientation
            return !state.isHorizontal;
        }
        
        // Otherwise return the base orientation
        return state.isHorizontal;
    }
}

export default FlockingExperience;