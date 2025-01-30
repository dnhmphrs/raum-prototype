// FlockingExperience.js

import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import PredatorGeometry from './PredatorGeometry';
import FlockingPipeline from './FlockingPipeline';

class FlockingExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        this.birdCount = 8192; // Adjusted for performance
        this.lastTime = performance.now(); // Initialize lastTime

        // Separate storage for birds and predator
        this.birds = []; // Array to hold all bird geometries
        this.predator = null; // Single reference for the predator

        // Initialize the Flocking pipeline
        this.pipeline = new FlockingPipeline(
            this.device,
            resourceManager.camera,
            resourceManager.getViewportBuffer(),
            resourceManager.getMouseBuffer(),
            this.birdCount
        );

        this.addBirds();
        this.addPredator();
    }

    async initialize() {
        // Initialize the pipeline
        await this.pipeline.initialize();

        // Generate initial positions and velocities for birds
        const initialPositions = [];
        const initialVelocities = [];
        const bounds = 2500;
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
        }

        // Initialize position and velocity buffers in the pipeline
        this.pipeline.initializeBirdBuffers(initialPositions, initialVelocities);

        const initialPredatorPosition = new Float32Array([0.0, 0.0, 0.0]); // Starting at origin
        const initialPredatorVelocity = new Float32Array([0.0, 0.0, 0.0]); // Initially stationary

        // Initialize predator position and velocity buffers in the pipeline
        this.pipeline.initializePredatorBuffers(initialPredatorPosition, initialPredatorVelocity);

        // Set initial flocking parameters (if necessary)
        // this.pipeline.setFlockingParameters(15.0, 20.0, 20.0, [0.0, 0.0, 0.0, 0.0]);
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

    render(commandEncoder, textureView) {
        // Calculate deltaTime
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000; // in seconds
        this.lastTime = now;

        // Update deltaTime in the compute shader
        this.pipeline.updateDeltaTime(deltaTime);

        // Update wing phases
        this.pipeline.updatePhases(now);

        // Optionally, adjust flocking parameters dynamically here
        // Example: this.pipeline.setFlockingParameters(separation, alignment, cohesion, centerGravity);

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

        this.pipeline.render(commandEncoder, passDescriptor, this.birds, this.predator);
    }

    cleanup() {
        if (this.pipeline) {
            this.pipeline.cleanup();
        }

        // Cleanup birds
        this.birds.forEach((bird) => {
            if (bird.cleanup) {
                bird.cleanup();
            }
        });
        this.birds = [];

        // Cleanup predator
        if (this.predator) {
            this.predator.cleanup();
            this.predator = null;
        }
    }
}

export default FlockingExperience;