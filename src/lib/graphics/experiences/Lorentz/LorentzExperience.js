import Experience from '../Experience';
import LorentzPipeline from './LorentzPipeline';
import Camera from '../../camera/Camera';
import CameraController from '../../camera/CameraController';

class LorentzExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        // Create camera and controller
        const width = resourceManager?.canvas?.width || 800;
        const height = resourceManager?.canvas?.height || 600;
        
        this.camera = new Camera(device, width, height);
        this.cameraController = new CameraController(this.camera);

        // Lorentz attractor parameters
        this.sigma = 10;
        this.rho = 28;
        this.beta = 8/3;
        this.dt = 0.001;
        
        // Number of points to render
        this.numPoints = 20000;

        // Initialize pipeline
        this.pipeline = new LorentzPipeline(
            this.device,
            this.numPoints,
            resourceManager.getViewportBuffer()
        );
    }

    async initialize() {
        await this.pipeline.initialize();
    }

    render(commandEncoder, textureView) {
        // Render the attractor with current parameters
        const passDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };

        this.pipeline.render(commandEncoder, passDescriptor, {
            sigma: this.sigma,
            rho: this.rho,
            beta: this.beta,
            dt: this.dt
        });
    }

    cleanup() {
        if (this.pipeline) {
            this.pipeline.cleanup();
        }
    }

    // Camera access methods
    getCamera() {
        return this.camera;
    }

    getCameraController() {
        return this.cameraController;
    }

    // Reset with parameters
    resetWithParameters(sigma, rho, beta, dt, initialPoint) {
        this.sigma = sigma;
        this.rho = rho;
        this.beta = beta;
        this.dt = dt;
        
        // No need to handle initial point as it's handled in the shader
    }
}

export default LorentzExperience; 