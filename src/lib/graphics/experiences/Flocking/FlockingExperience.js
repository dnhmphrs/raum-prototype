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
            glitchDuration: 10,  // MUCH shorter glitch duration (50ms) - just a quick flash
            glitchProbability: 0.00, // Very low probability of glitches per second (1%)
            lastMajorChange: performance.now() - 7000, // Initialize near the end of a period to encourage early change
            lastGlitchEnd: 0,  // No glitches at start
            forceGlitchOnOrientationChange: true, // Always glitch during orientation changes
            // More chaotic timing with additional offsets based on irrational numbers
            goldenRatioOffsets: [0, 0.382, 0.618, 1.0, 0.276, 0.472, 0.786, 0.944], // Expanded offsets for more variation
            // Add Fibonacci sequence divisions for even more irregularity
            fibonacciOffsets: [1/2, 1/3, 2/3, 1/5, 2/5, 3/5, 4/5, 1/8, 3/8, 5/8, 7/8],
            primeOffsets: [1/2, 1/3, 1/5, 1/7, 1/11, 1/13, 1/17, 1/19],
            currentOffsetIndex: 0, // Current index in the offsets array
            currentFibIndex: Math.floor(Math.random() * 11), // Random start for fibonacci offsets
            currentPrimeIndex: Math.floor(Math.random() * 8), // Random start for prime offsets
            // Add randomness seeds that change occasionally
            chaosSeed: Math.random(),
            lastSeedChange: performance.now(),
            seedChangePeriod: 4230, // Odd period to avoid synchronization with other cycles
            orientationChangeOverdue: false, // Flag to force orientation change if it's been too long
            // Track short, medium and long glitch cooldowns with different timers
            shortCooldownEnd: 0,
            mediumCooldownEnd: 0,
            longCooldownEnd: 0,
            // Add glitch clustering behavior
            glitchClusterActive: false,
            glitchClusterEnd: 0,
            glitchClusterChance: 0.12, // Chance to enter cluster mode
            maxClusterGlitches: 4, // Maximum number of glitches in a cluster
            remainingClusterGlitches: 0,
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
            patternScale: 2.0,       // Controls pixel size (lower = larger pixels)
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

        // Adjust camera near and far planes to better handle the flocking space
        if (this.resourceManager && this.resourceManager.camera) {
            // Use a smaller near plane and larger far plane to prevent clipping
            this.resourceManager.camera.updateProjection(
                this.resourceManager.camera.fov || Math.PI / 4, 
                0.01,  // Smaller near plane (was 0.1)
                200000 // Larger far plane (was 100000)
            );
        }
        
        // Create intermediate render textures for post-processing
        this.createPostProcessingTextures();

        // Apply initial dither settings
        this.updateDitherSettings();

        // Generate initial positions and velocities for birds
        const initialPositions = [];
        const initialVelocities = [];
        const initialPhases = [];
        const bounds = 6000; // Increased from 5000
        const boundsHalf = bounds / 2;

        for (let i = 0; i < this.birdCount; i++) {
            // Random positions within bounds, but closer to camera position
            // This ensures birds don't initialize behind a viewable plane
            const posX = Math.random() * bounds - boundsHalf;
            
            // Create a spread of positions, but bias toward camera's field of view
            const posY = (Math.random() * bounds - boundsHalf) * 0.8; // Y positions biased toward center
            const posZ = (Math.random() * bounds - boundsHalf) * 0.8; // Z positions biased toward center
            
            initialPositions.push([posX, posY, posZ]);

            // Random velocities with a small magnitude
            const velX = (Math.random() - 0.5);
            const velY = (Math.random() - 0.5);
            const velZ = (Math.random() - 0.5);
            initialVelocities.push([velX, velY, velZ]);

            // Random wing phases
            initialPhases.push(Math.random() * Math.PI * 2); // Randomize initial wing flap positions
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
            
            // Check if we're in a glitch - just for debugging
            const now = performance.now();
            const isInGlitchTransition = this.orientationState.lastGlitchEnd > now;
            
            // Generate golden ratio-based bar collection
            // The glitch effect is already handled by useHorizontalBars being temporarily flipped
            this.createGoldenRatioBars(rects, useHorizontalBars, isInGlitchTransition);
            
            // Update the rectangles in the pipeline only if we have rectangles to update
            if (rects.length > 0) {
                this.shaderRectPipeline.updateRectangles(rects);
            }
        } catch (err) {
            // Log error but don't crash
            console.error("Error in updateShaderRects:", err);
        }
    }
    
    createGoldenRatioBars(rects, useHorizontalBars, isInGlitchTransition = false) {
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
        
        // Determine if this is a glitch-induced temporary orientation
        // If we're in a glitch, check if the current orientation is the opposite of the base orientation
        const now = performance.now();
        const isGlitchState = this.orientationState.lastGlitchEnd > now;
        const isBaseOrientation = this.orientationState.isHorizontal === useHorizontalBars;
        const isTemporaryOrientation = isGlitchState && !isBaseOrientation;
        
        // Create bars with the current orientation
        if (useHorizontalBars) {
            // Create horizontal bars - full width
            const minimalGap = 0.0003; // Even smaller gap between strips
            
            // Calculate center of screen with movement influenced by predator's vertical movement
            const centerYOffset = Math.sin(timeNow * 0.3) * 0.02 + predatorDirectionY * 0.02;
            
            // For temporary glitch orientations, shift bars toward top and bottom of screen
            let centerY = 0.5 + centerYOffset;
            if (isTemporaryOrientation) {
                // Determine if we should favor top or bottom - alternate based on time
                const favorTop = Math.sin(timeNow * 0.7) > 0;
                centerY = favorTop ? 0.25 + centerYOffset * 0.5 : 0.75 + centerYOffset * 0.5;
            }
            
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
            const minimalGap = 0.0003; // Even smaller gap between strips
            
            // Calculate center of screen with movement influenced by predator's horizontal movement
            const centerXOffset = Math.sin(timeNow * 0.3) * 0.02 + predatorDirectionX * 0.02;
            
            // For temporary glitch orientations, shift bars toward sides of screen
            let centerX = 0.5 + centerXOffset;
            if (isTemporaryOrientation) {
                // Determine if we should favor left or right side - alternate based on time
                const favorLeft = Math.sin(timeNow * 0.7) > 0;
                centerX = favorLeft ? 0.25 + centerXOffset * 0.5 : 0.75 + centerXOffset * 0.5;
            }
            
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
            
            // Update shader rects with predator velocity data 
            // This ensures the Julia set is influenced by the predator's actual heading
            this.updateShaderRectsWithPredatorData();
            
            // Check if we're in a glitch - these should be very brief
            const isInGlitch = this.orientationState.lastGlitchEnd > now;
            
            // Harmonically balanced glitch transitions based on golden ratio timing
            if (!isInGlitch) {
                // Base probability is very low
                const baseProbability = 0.0015; // 0.15% base chance per frame
                
                // Calculate a time-based harmonic factor using phi
                const phi = this.phi; // 0.618...
                const timeFactor = Math.abs(Math.sin(now * 0.0003)); // Very slow oscillation
                
                // Use the golden offsets to create natural fibonacci-like timing
                const offsetIndex = this.orientationState.currentOffsetIndex;
                const offset = this.orientationState.goldenRatioOffsets[offsetIndex];
                
                // Calculate probability with golden ratio influence
                const harmonicFactor = phi + (1-phi) * Math.sin(now * 0.0005 + offset * Math.PI * 2);
                const glitchProbability = baseProbability * harmonicFactor;
                
                // Check if a glitch should occur
                if (Math.random() < glitchProbability) {
                    // Only if enough time has passed since last glitch
                    const timeSinceLastGlitch = now - this.orientationState.lastGlitchEnd;
                    if (timeSinceLastGlitch > 1000) { // At least 1 second between glitches
                        // Schedule a quick glitch
                        this.orientationState.lastGlitchEnd = now + this.orientationState.glitchDuration;
                        
                        // Move to the next offset in the sequence for next glitch
                        this.orientationState.currentOffsetIndex = 
                            (this.orientationState.currentOffsetIndex + 1) % 
                            this.orientationState.goldenRatioOffsets.length;
                    }
                }
            }
            
            // Handle shader rect changes - either on regular interval or during glitches
            this.accumulatedShaderRectTime += rawDeltaTime * 1000;
            
            // Always update during glitches for more responsive orientation changes
            if (isInGlitch || this.accumulatedShaderRectTime >= this.shaderRectChangeInterval) {
                // Wrap in try/catch to prevent rendering issues if this fails
                try {
                    // Only force update rect count on scheduled intervals, not during glitches
                    const forceUpdate = !isInGlitch && this.accumulatedShaderRectTime >= this.shaderRectChangeInterval;
                    
                    // Update the shader rectangles
                    this.updateShaderRects(forceUpdate);
                    
                    // Reset timer only for scheduled updates, not glitches
                    if (forceUpdate) {
                        this.accumulatedShaderRectTime = 0;
                    }
                } catch (e) {
                    console.error("Error in shader rect update:", e);
                }
            } else {
                // Continuous updates for constant movement
                // Do this almost every frame for more dynamic movement
                if (this.accumulatedShaderRectTime > 33 && this.shaderRectPipeline && this.shaderRectPipeline.isInitialized) {
                    // Only update if not currently in a buffer update process
                    if (!this.shaderRectPipeline.bufferUpdateInProgress) {
                        const rects = [];
                        
                        // Get current orientation using our orientation manager
                        // This handles both dominant orientation and brief glitches
                        const useHorizontalBars = this.getCurrentOrientation(false);
                        
                        // Only update if we have a valid shader rect pipeline
                        try {
                            // Update with continuous movement
                            this.createGoldenRatioBars(rects, useHorizontalBars, false);
                            
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

            // 4. Render the text overlay BEFORE the dither effect
            if (this.textOverlayPipeline && this.textOverlayPipeline.isInitialized) {
                this.textOverlayPipeline.render(commandEncoder, renderTarget);
            }

            // 5. Apply post-processing dither effect if enabled
            if (this.ditherSettings.enabled && this.ditherPostProcessPipeline && this.ditherPostProcessPipeline.isInitialized) {
                this.ditherPostProcessPipeline.render(commandEncoder, this.intermediateTextureView, textureView);
            }

            // Don't render text overlay again if dithering is enabled
            // If dithering is disabled, still render text overlay as the final layer
            if (!this.ditherSettings.enabled && this.textOverlayPipeline && this.textOverlayPipeline.isInitialized) {
                this.textOverlayPipeline.render(commandEncoder, renderTarget);
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
        
        // Check if we're currently in the middle of a very brief glitch
        // A glitch is active if lastGlitchEnd is in the future
        if (state.lastGlitchEnd > now) {
            // During a glitch, ALWAYS return the opposite orientation
            return !state.isHorizontal;
        }
        
        // Update chaos seed periodically for unpredictable patterns
        if (now - state.lastSeedChange > state.seedChangePeriod) {
            state.chaosSeed = Math.random();
            state.lastSeedChange = now;
            // Also randomly change the seed change period itself for even more chaos
            state.seedChangePeriod = 3000 + Math.random() * 2000;
        }
        
        // For forced updates (major changes), consider changing the base orientation
        if (forceUpdate) {
            // Only change base orientation if enough time has passed (at least one full period)
            const timeSinceLastMajorChange = now - state.lastMajorChange;
            
            // Higher chance to switch if it's been a long time since last change
            // This ensures we don't get stuck in one orientation
            const baseProb = timeSinceLastMajorChange > state.periodDuration * 2 ? 0.8 : 0.5;
            
            if (timeSinceLastMajorChange > state.periodDuration) {
                // Use golden ratio to determine probability of switch - more naturalistic
                const switchProbability = baseProb * (1 + this.phi * Math.sin(now * 0.0001)) / 2;
                
                if (Math.random() < switchProbability || state.orientationChangeOverdue) {
                    // Change the dominant orientation
                    state.isHorizontal = !state.isHorizontal;
                    state.lastMajorChange = now;
                    state.orientationChangeOverdue = false;
                    
                    console.log(`Orientation changed to ${state.isHorizontal ? 'horizontal' : 'vertical'}`);
                }
            }
            
            // Return the base orientation
            return state.isHorizontal;
        }
        
        // For regular updates, calculate normal orientation cycle
        // Check which period we're in
        const periodIndex = Math.floor(now / state.periodDuration);
        const previousPeriodIndex = Math.floor(state.lastMajorChange / state.periodDuration);
        
        // If we've entered a new period, potentially change the base orientation
        if (periodIndex > previousPeriodIndex) {
            // Higher base probability for orientation changes
            // Especially if it's been multiple periods since last change
            const periodsElapsed = periodIndex - previousPeriodIndex;
            const baseProb = periodsElapsed > 2 ? 0.9 : 0.65;
            
            // Use golden ratio to determine probability - more naturalistic rhythm
            const switchProbability = baseProb * (1 + this.phi * Math.sin(now * 0.0001)) / 2;
            
            if (Math.random() < switchProbability || state.orientationChangeOverdue) {
                // Change the dominant orientation
                state.isHorizontal = !state.isHorizontal;
                state.lastMajorChange = now;
                state.orientationChangeOverdue = false;
                
                console.log(`Orientation changed to ${state.isHorizontal ? 'horizontal' : 'vertical'}`);
            } else {
                // Even if we don't change orientation, update the lastMajorChange time
                // to prevent checking again until next period
                state.lastMajorChange = now;
                
                // If we've gone too many periods without a change, force one next time
                if (periodsElapsed >= 3) {
                    state.orientationChangeOverdue = true;
                    console.log("Orientation change flagged as overdue");
                }
            }
        }
        
        // CHAOTIC GLITCH TIMING LOGIC
        
        // Check if we're in a glitch cluster mode (multiple glitches in quick succession)
        if (state.glitchClusterActive && now < state.glitchClusterEnd) {
            // In cluster mode, higher probability of glitches
            if (state.remainingClusterGlitches > 0 && now > state.shortCooldownEnd) {
                // Create a rhythmic yet chaotic pattern within the cluster
                const clusterPulse = Math.sin(now * 0.01 * state.chaosSeed) * 0.5 + 0.5;
                if (Math.random() < 0.15 * clusterPulse) {
                    // Trigger another glitch in the cluster - use config duration as the base
                    // Scale random component by the configured duration
                    const durationBase = state.glitchDuration;
                    const randomComponent = (durationBase * 0.6) * Math.random(); // Random component up to 60% of base duration
                    const glitchDuration = durationBase * 0.7 + randomComponent; // 70-130% of configured duration
                    
                    state.lastGlitchEnd = now + glitchDuration;
                    state.remainingClusterGlitches--;
                    
                    // Short cooldown between cluster glitches scales with glitch duration
                    state.shortCooldownEnd = now + glitchDuration + (durationBase * 0.5) + (durationBase * Math.random());
                    
                    // Return opposite orientation during this glitch
                    return !state.isHorizontal;
                }
            } else if (state.remainingClusterGlitches <= 0) {
                // End of cluster, reset cluster state
                state.glitchClusterActive = false;
                // Set a medium cooldown before next possible glitch
                state.mediumCooldownEnd = now + 1000 + Math.random() * 1500;
            }
        } else if (!state.glitchClusterActive) {
            // Check if we should start a new glitch cluster - scale by config probability
            // Higher probability values lead to more frequent clusters
            const clusterChance = state.glitchClusterChance * (state.glitchProbability / 0.001) / 60; // Scale by config probability
            if (now > state.longCooldownEnd && Math.random() < clusterChance) {
                // Start a new glitch cluster
                state.glitchClusterActive = true;
                state.remainingClusterGlitches = 1 + Math.floor(Math.random() * state.maxClusterGlitches);
                state.glitchClusterEnd = now + 500 + Math.random() * 1000; // Cluster lasts 0.5-1.5 seconds
                state.longCooldownEnd = now + 3000 + Math.random() * 4000; // Long cooldown after clusters (3-7 seconds)
            }
        }
        
        // Check for regular isolated glitches outside of clusters
        if (!state.glitchClusterActive && now > state.mediumCooldownEnd) {
            // Create chaotic yet aesthetically pleasing timing using multiple layers
            
            // Layer 1: Basic probability directly scales with configuration value
            const baseLayer = state.glitchProbability / 60; // Convert to per-frame probability
            
            // Layer 2: Multiple oscillations at different irrational frequencies
            const oscillation1 = (Math.sin(now * 0.00027) * 0.5 + 0.5); // ~23 second cycle
            const oscillation2 = (Math.sin(now * 0.00041) * 0.5 + 0.5); // ~15 second cycle
            const oscillation3 = (Math.sin(now * 0.00069) * 0.5 + 0.5); // ~9 second cycle
            
            // Layer 3: Use selected offsets from our arrays to create irregular patterns
            // Cycle through our offset arrays in different orders
            let offsetIndex = (Math.floor(now / 111) % state.goldenRatioOffsets.length);
            let fibIndex = (Math.floor(now / 173) % state.fibonacciOffsets.length);
            let primeIndex = (Math.floor(now / 137) % state.primeOffsets.length);
            
            // Get values from each array
            const goldenOffset = state.goldenRatioOffsets[offsetIndex];
            const fibOffset = state.fibonacciOffsets[fibIndex];
            const primeOffset = state.primeOffsets[primeIndex];
            
            // Combine the three offsets in a non-linear way
            const combinedOffset = (goldenOffset * fibOffset + primeOffset) / (1 + goldenOffset); 
            
            // Layer 4: Add phase shifting based on our chaos seed
            const phaseShift = Math.sin(now * 0.0002 * state.chaosSeed + combinedOffset * Math.PI * 2);
            
            // Combine all layers into a final probability
            // Weight oscillations differently for complex, unpredictable patterns
            const finalProbability = baseLayer * 
                (oscillation1 * 0.4 + oscillation2 * 0.3 + oscillation3 * 0.3) * 
                (0.7 + phaseShift * 0.3) * 
                (0.8 + combinedOffset * 0.4);
            
            // Add "dry spell" and "active period" patterns - long stretches with different behaviors
            const longCycle = Math.sin(now * 0.0001); // Very slow cycle (~63 second period)
            const activeMultiplier = longCycle > 0 ? 1.5 : 0.5; // More active in positive half of cycle
            
            // Final chaotic probability that still has aesthetic rhythm
            if (Math.random() < finalProbability * activeMultiplier) {
                // Check there's been enough time since the last glitch
                const timeSinceLastGlitch = now - state.lastGlitchEnd;
                const timeSinceLastMajorChange = now - state.lastMajorChange;
                
                // Allow glitches if enough time has passed
                if (timeSinceLastGlitch > 400 && timeSinceLastMajorChange > 400) {
                    // Variable glitch duration based on config value
                    const durationBase = state.glitchDuration;
                    const randomComponent = (durationBase * 0.5) * Math.random(); // Random component up to 50% of base
                    let glitchDuration = durationBase * 0.7 + randomComponent; // 70-120% of configured duration
                    
                    // Small chance (5%) of slightly longer glitches
                    if (Math.random() < 0.05) {
                        glitchDuration = durationBase * 2 + durationBase * Math.random(); // 200-300% of configured duration
                    }
                    
                    // Set when the current glitch will end
                    state.lastGlitchEnd = now + glitchDuration;
                    
                    // Set a short cooldown period that scales with duration
                    state.shortCooldownEnd = now + glitchDuration + durationBase * 6 + durationBase * 8 * Math.random();
                    
                    // Return opposite orientation for a brief moment
                    return !state.isHorizontal;
                }
            }
        }
        
        // Otherwise return the base orientation
        return state.isHorizontal;
    }
}

export default FlockingExperience;