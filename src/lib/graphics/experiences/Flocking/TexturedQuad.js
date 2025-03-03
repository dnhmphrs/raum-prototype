export default class TexturedQuad {
    constructor(device, imagePath) {
        this.device = device;
        this.imagePath = imagePath;
        this.texture = null;
        this.sampler = null;
        this.vertexBuffer = null;
        this.bindGroup = null;
    }

    async initialize() {
        // Create a simple quad (two triangles)
        const vertices = new Float32Array([
            // positions (x, y, z), texture coords (u, v)
            -0.5, -0.5, 0.0,  0.0, 1.0,
             0.5, -0.5, 0.0,  1.0, 1.0,
             0.5,  0.5, 0.0,  1.0, 0.0,
            
            -0.5, -0.5, 0.0,  0.0, 1.0,
             0.5,  0.5, 0.0,  1.0, 0.0,
            -0.5,  0.5, 0.0,  0.0, 0.0,
        ]);

        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        // Load the texture
        await this.loadTexture();

        // Create sampler
        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
    }

    async loadTexture() {
        // Load the image
        const response = await fetch(this.imagePath);
        const blob = await response.blob();
        const imgBitmap = await createImageBitmap(blob);

        // Create the texture
        this.texture = this.device.createTexture({
            size: [imgBitmap.width, imgBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Copy the image data to the texture
        this.device.queue.copyExternalImageToTexture(
            { source: imgBitmap },
            { texture: this.texture },
            [imgBitmap.width, imgBitmap.height]
        );
    }

    createBindGroup(layout) {
        this.bindGroup = this.device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: this.sampler }
            ]
        });
        return this.bindGroup;
    }

    getVertexBuffer() {
        return this.vertexBuffer;
    }

    cleanup() {
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = null;
        }
    }
} 