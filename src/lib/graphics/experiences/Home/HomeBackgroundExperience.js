import Experience from '../Experience.js';
import { createFullScreenQuad } from '../../utils/geometryUtils.js';
import Pipeline from '../../pipelines/Pipeline.js';
import DitherPostProcessPipeline from '../../pipelines/DitherPostProcessPipeline.js';
import { homeDitherSettings, setCurrentDitherSettings } from '../../../store/ditherStore.js';

// Simple fallback shader in case the imported one fails
const FALLBACK_SHADER = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5;
    return output;
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Apply subtle warping effect around mouse cursor
    var warped_uv = uv;
    let mouse_vector = uv - mouse;
    let mouse_dist = length(mouse_vector);
    let warp_strength = 0.03; // Very subtle warping
    let warp_radius = 0.3;    // Radius of influence
    
    // Only apply warping within the radius
    if (mouse_dist < warp_radius) {
        // Calculate warping factor - stronger closer to cursor, fading out to edge
        let warp_factor = smoothstep(warp_radius, 0.0, mouse_dist) * warp_strength;
        
        // Create a subtle swirl/lens effect
        let angle = atan2(mouse_vector.y, mouse_vector.x) + sin(time * 0.5) * 0.2;
        let swirl = vec2<f32>(cos(angle), sin(angle)) * mouse_dist;
        
        // Apply the warping
        warped_uv -= swirl * warp_factor;
    }
    
    // Simple gradient background
    var color = vec3<f32>(warped_uv.x * 0.1, warped_uv.y * 0.1, 0.1);
    
    // Add time-based animation
    color.g += sin(time) * 0.1 + 0.1;
    
    return vec4<f32>(color, 1.0);
}
`;

class HomeBackgroundPipeline extends Pipeline {
    constructor(device, resourceManager) {
        super(device);
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.shaderCode = null;
    }
    
    async initialize() {
        try {
            // Load the shader code
            this.shaderCode = await this.resourceManager.experiences.homeBackground.loadShader();
            
            // Create bind group layout
            const bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Time
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Resolution
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Mouse
                    }
                ]
            });
            
            // Create pipeline layout
            const pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
            });
            
            // Create shader module
            const shaderModule = this.createShaderModule({
                code: this.shaderCode
            });
            
            // Create render pipeline
            this.renderPipeline = this.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [
                        {
                            arrayStride: 3 * 4, // 3 floats, 4 bytes each
                            attributes: [
                                {
                                    shaderLocation: 0,
                                    offset: 0,
                                    format: 'float32x3'
                                }
                            ]
                        }
                    ]
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat()
                        }
                    ]
                },
                primitive: {
                    topology: 'triangle-list'
                },
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less'
                }
            });
            
            // Create bind group
            this.bindGroup = this.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.resourceManager.experiences.homeBackground.timeBuffer
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.resourceManager.experiences.homeBackground.resolutionBuffer
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.resourceManager.experiences.homeBackground.mouseBuffer
                        }
                    }
                ]
            });
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Error initializing HomeBackgroundPipeline:", error);
            return false;
        }
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, totalIndices) {
        try {
            const renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store'
                    }
                ],
                depthStencilAttachment: {
                    view: depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            };
            
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indexBuffer, 'uint16');
            passEncoder.drawIndexed(6); // Draw 2 triangles (6 indices)
            passEncoder.end();
        } catch (error) {
            console.error("Error in HomeBackgroundPipeline render:", error);
        }
    }
}

class HomeBackgroundExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store references
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Loading state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.loadingMessage = "Initializing...";
        
        // Create a full-screen quad geometry
        const { vertices, indices } = createFullScreenQuad();
        this.totalIndices = indices.length;
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
        
        // Create uniform buffers
        this.timeBuffer = this.device.createBuffer({
            size: 4, // single float
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Time Uniform Buffer'
        });
        
        this.resolutionBuffer = this.device.createBuffer({
            size: 8, // two floats
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Resolution Uniform Buffer'
        });
        
        this.mouseBuffer = this.device.createBuffer({
            size: 8, // two floats
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Mouse Uniform Buffer'
        });
        
        // Animation/time tracking
        this.time = 0;
        
        // Mouse position (normalized)
        this.mouse = { x: 0.5, y: 0.5 };
        
        // Register mouse move event
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        }
        
        // Dither effect settings
        this.ditherSettings = {
            enabled: true,
            patternScale: 1.0,
            thresholdOffset: -0.05,
            noiseIntensity: 0.08,
            colorReduction: 2.0
        };
        this.ditherEnabled = true; // convenience flag

        // Make "home" the active store settings
        setCurrentDitherSettings('home');
        
        // Subscribe to the store, but DO NOT re-update the store inside it:
        this.ditherSettingsUnsubscribe = homeDitherSettings.subscribe((settings) => {
            // Just copy them locally:
            this.ditherSettings = { ...settings };
            this.ditherEnabled = settings.enabled;
            
            // If pipeline is ready, update the pipeline's settings (no store writes):
            if (this.ditherPostProcess && this.ditherPostProcess.isInitialized) {
                this.ditherPostProcess.setSettings(
                    settings.patternScale,
                    settings.thresholdOffset,
                    settings.noiseIntensity,
                    settings.colorReduction
                );
            }
        });
        
        // For post-processing
        this.postProcessingTextures = null;
    }
    
    handleMouseMove(event) {
        if (typeof window !== 'undefined') {
            // Flip Y for WebGPU coordinate system
            this.mouse.x = event.clientX / window.innerWidth;
            this.mouse.y = 1.0 - (event.clientY / window.innerHeight);
        }
    }
    
    async loadShader() {
        let shaderCode = FALLBACK_SHADER;
        try {
            // Try to load MatrixShader.wgsl from /shaders/home
            const response = await fetch('/shaders/home/MatrixShader.wgsl');
            if (response.ok) {
                shaderCode = await response.text();
            } else {
                console.warn("Matrix shader not found in /shaders/home, using fallback", response.status, response.statusText);
                
                // Possibly try /static/shaders/home
                const staticResponse = await fetch('/static/shaders/home/MatrixShader.wgsl');
                if (staticResponse.ok) {
                    shaderCode = await staticResponse.text();
                } else {
                    console.warn("Matrix shader not found in /static/shaders/home either, using fallback");
                }
            }
        } catch (error) {
            console.error("Error loading Matrix shader:", error);
            console.warn("Using fallback shader");
        }
        return shaderCode;
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Register with ResourceManager if available
            if (this.resourceManager?.experiences) {
                this.resourceManager.experiences.homeBackground = this;
            } else {
                console.warn("ResourceManager or experiences not available for registration");
            }
            
            // Create + initialize pipeline
            this.pipeline = new HomeBackgroundPipeline(this.device, this.resourceManager);
            const success = await this.pipeline.initialize();
            if (!success) {
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
            // Create post-processing pipeline (dither)
            this.updateLoadingState(true, "Creating post-processing pipeline...", 60);
            await this.createPostProcessingPipeline();
            
            // Set up camera if available
            this.updateLoadingState(true, "Configuring camera...", 90);
            if (this.resourceManager?.camera) {
                this.resourceManager.camera.target = [0, 0, 0];
                this.resourceManager.camera.updateView();
                
                if (this.resourceManager.cameraController) {
                    this.resourceManager.cameraController.target = [0, 0, 0];
                }
            }
            
            this.updateLoadingState(false, "Initialization complete", 100);
            return true;
        } catch (error) {
            console.error("Error initializing Home Background Experience:", error);
            this.updateLoadingState(false, `Error: ${error.message}`, 100);
            return false;
        }
    }
    
    async createPostProcessingPipeline() {
        try {
            // Determine canvas dimensions
            let canvasWidth = 800;
            let canvasHeight = 600;
            
            if (this.resourceManager?.canvasSize) {
                canvasWidth = this.resourceManager.canvasSize.width;
                canvasHeight = this.resourceManager.canvasSize.height;
            } else if (typeof window !== 'undefined') {
                canvasWidth = window.innerWidth;
                canvasHeight = window.innerHeight;
            }
            
            // Create a viewport buffer for the dither pipeline
            this.viewportBuffer = this.device.createBuffer({
                size: 8, // 2 floats
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: 'Viewport Buffer'
            });
            this.device.queue.writeBuffer(
                this.viewportBuffer,
                0,
                new Float32Array([canvasWidth, canvasHeight])
            );
            
            // Create a post-processing texture
            this.createPostProcessingTextures(canvasWidth, canvasHeight);
            
            // Create the DitherPostProcess pipeline
            this.ditherPostProcess = new DitherPostProcessPipeline(
                this.device,
                this.viewportBuffer,
                canvasWidth,
                canvasHeight
            );
            
            // Initialize
            await this.ditherPostProcess.initialize();
            
            // Apply initial store-based settings (no store writes here)
            this.ditherPostProcess.setSettings(
                this.ditherSettings.patternScale,
                this.ditherSettings.thresholdOffset,
                this.ditherSettings.noiseIntensity,
                this.ditherSettings.colorReduction
            );
            
            return true;
        } catch (error) {
            console.error("Error creating post-processing pipeline:", error);
            return false;
        }
    }
    
    createPostProcessingTextures(width = 800, height = 600) {
        try {
            // Cleanup any old texture
            if (this.postProcessingTextures?.texture?.destroy) {
                this.postProcessingTextures.texture.destroy();
            }
            
            // Create a new texture for the scene
            const sceneTexture = this.device.createTexture({
                size: { width, height },
                format: navigator.gpu.getPreferredCanvasFormat(),
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
            
            this.postProcessingTextures = {
                texture: sceneTexture,
                view: sceneTexture.createView()
            };
            
            return true;
        } catch (error) {
            console.error("Error creating post-processing textures:", error);
            return false;
        }
    }
    
    handleResize(width, height) {
        // Recreate post-processing textures
        if (this.postProcessingTextures) {
            this.createPostProcessingTextures(width, height);
        }
        
        // Update dither pipeline
        if (this.ditherPostProcess) {
            this.ditherPostProcess.updateViewportDimensions(width, height);
            this.device.queue.writeBuffer(
                this.viewportBuffer,
                0,
                new Float32Array([width, height])
            );
        }
        return true;
    }
    
    render(commandEncoder, textureView) {
        if (!this.pipeline?.isInitialized) {
            return;
        }
        
        try {
            // Get the depth texture
            const depthTextureView = this.resourceManager.getDepthTextureView?.();
            if (!depthTextureView) return;
            
            // Update time
            this.time += 0.01;
            this.device.queue.writeBuffer(
                this.timeBuffer,
                0,
                new Float32Array([this.time])
            );
            
            // Update resolution uniform
            if (typeof window !== 'undefined') {
                this.device.queue.writeBuffer(
                    this.resolutionBuffer,
                    0,
                    new Float32Array([window.innerWidth, window.innerHeight])
                );
            }
            
            // Update mouse uniform
            this.device.queue.writeBuffer(
                this.mouseBuffer,
                0,
                new Float32Array([this.mouse.x, this.mouse.y])
            );
            
            if (
                this.ditherEnabled &&
                this.ditherPostProcess?.isInitialized &&
                this.postProcessingTextures
            ) {
                // 1) Render scene to intermediate texture
                this.pipeline.render(
                    commandEncoder,
                    this.postProcessingTextures.view,
                    depthTextureView,
                    this.vertexBuffer,
                    this.indexBuffer,
                    null,
                    this.totalIndices
                );
                
                // 2) Dither pass → final
                this.ditherPostProcess.render(
                    commandEncoder,
                    this.postProcessingTextures.view,
                    textureView
                );
            } else {
                // If dither disabled, render directly
                this.pipeline.render(
                    commandEncoder,
                    textureView,
                    depthTextureView,
                    this.vertexBuffer,
                    this.indexBuffer,
                    null,
                    this.totalIndices
                );
            }
        } catch (error) {
            console.error("Error in Home Background render:", error);
        }
    }
    
    // Called from UI or wherever you toggle dithering
    toggleDitherEffect(enabled) {
        this.ditherEnabled = enabled;
        this.ditherSettings.enabled = enabled;
        
        // Update the store once
        homeDitherSettings.update((old) => ({
            ...old,
            enabled
        }));
    }
    
    // Called from UI or wherever you change slider values
    updateDitherEffectSettings(patternScale, thresholdOffset, noiseIntensity, colorReduction) {
        // Update the local object
        this.ditherSettings.patternScale = patternScale;
        this.ditherSettings.thresholdOffset = thresholdOffset;
        this.ditherSettings.noiseIntensity = noiseIntensity;
        this.ditherSettings.colorReduction = colorReduction;
      
        // Update the store once
        homeDitherSettings.update((old) => ({
            ...old,
            patternScale,
            thresholdOffset,
            noiseIntensity,
            colorReduction
        }));
      
        // Also update pipeline if ready
        if (this.ditherPostProcess?.isInitialized) {
            this.ditherPostProcess.setSettings(
                patternScale,
                thresholdOffset,
                noiseIntensity,
                colorReduction
            );
        }
    }
    
    cleanup() {
        // Unsubscribe from store
        if (this.ditherSettingsUnsubscribe) {
            this.ditherSettingsUnsubscribe();
            this.ditherSettingsUnsubscribe = null;
        }
        
        // Remove mouse listener
        if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        }
        
        // Clean up pipeline
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Clean up dither pipeline
        if (this.ditherPostProcess) {
            this.ditherPostProcess.cleanup();
            this.ditherPostProcess = null;
        }
        
        // Clean up post-processing textures
        if (this.postProcessingTextures?.texture?.destroy) {
            this.postProcessingTextures.texture.destroy();
        }
        this.postProcessingTextures = null;
        
        // Null out buffers
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.timeBuffer = null;
        this.resolutionBuffer = null;
        this.mouseBuffer = null;
        this.viewportBuffer = null;
        
        // Reset state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.time = 0;
        
        // Remove from resource manager
        if (this.resourceManager?.experiences?.homeBackground === this) {
            this.resourceManager.experiences.homeBackground = null;
        }
        
        // Clear references
        this.device = null;
        this.resourceManager = null;
        
        // Parent cleanup
        super.cleanup();
    }
    
    updateLoadingState(isLoading, message, progress) {
        this.isLoading = isLoading;
        this.loadingMessage = message || this.loadingMessage;
        this.loadingProgress = progress !== undefined ? progress : this.loadingProgress;
        
        if (this.resourceManager?.updateLoadingState) {
            this.resourceManager.updateLoadingState(
                this.isLoading,
                this.loadingMessage,
                this.loadingProgress
            );
        }
    }
}

export default HomeBackgroundExperience;
