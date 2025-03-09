import Pipeline from '../../pipelines/Pipeline';
import shaderCode from './theta2D.wgsl';

export default class RenderPipeline2D extends Pipeline {
	constructor(device, resourceManager) {
		super(device);
		this.resourceManager = resourceManager;
		this.isInitialized = false;
		
		// Create a simple quad for the background
		this.createQuadBuffers();
		
		// Create uniform buffer for time and resolution
		this.uniformBuffer = this.device.createBuffer({
			size: 16, // 4 floats: time, resolution.x, resolution.y, unused
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Background Uniform Buffer'
		});
	}
	
	createQuadBuffers() {
		// Create a full-screen quad
		const vertices = new Float32Array([
			// Position (x, y)
			-1.0, -1.0,  // Bottom-left
			 1.0, -1.0,  // Bottom-right
			 1.0,  1.0,  // Top-right
			-1.0,  1.0,  // Top-left
		]);
		
		const indices = new Uint16Array([
			0, 1, 2,  // First triangle
			0, 2, 3,  // Second triangle
		]);
		
		// Create vertex buffer
		this.vertexBuffer = this.device.createBuffer({
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			label: 'Background Quad Vertex Buffer'
		});
		
		// Create index buffer
		this.indexBuffer = this.device.createBuffer({
			size: indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			label: 'Background Quad Index Buffer'
		});
		
		// Upload data to GPU
		this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
		this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
	}
	
	async initialize() {
		console.log("Initializing 2D Pipeline");
		
		try {
			// Create bind group layout
			this.bindGroupLayout = this.device.createBindGroupLayout({
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: { type: 'uniform' }
					}
				]
			});
			
			// Create pipeline layout
			this.pipelineLayout = this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout]
			});
			
			// Create shader module
			this.shaderModule = this.device.createShaderModule({
				label: 'Theta2D Shader',
				code: `
					struct Uniforms {
						time: f32,
						resolution: vec2<f32>,
						unused: f32,
					}
					
					@group(0) @binding(0) var<uniform> uniforms: Uniforms;
					
					@vertex
					fn vertexMain(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
						return vec4<f32>(position, 0.0, 1.0);
					}
					
					// Jacobi theta function (third theta function)
					fn theta3(z: f32, q: f32) -> f32 {
						var sum: f32 = 1.0;
						
						// Sum a few terms for efficiency
						for (var n: i32 = 1; n <= 5; n = n + 1) {
							let n_f32 = f32(n);
							let term = 2.0 * pow(q, n_f32 * n_f32) * cos(2.0 * 3.14159 * n_f32 * z);
							sum = sum + term;
						}
						
						return sum;
					}
					
					@fragment
					fn fragmentMain(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
						// Normalize coordinates
						let uv = fragCoord.xy / uniforms.resolution;
						
						// Map to [-2, 2] range
						let x = (uv.x * 2.0 - 1.0) * 2.0;
						let y = (uv.y * 2.0 - 1.0) * 2.0;
						
						// Animate parameters
						let time = uniforms.time * 0.1;
						let q = 0.3 + 0.2 * sin(time * 0.5);
						
						// Calculate theta function value
						// Use real part of complex input for simplicity
						let z_real = x * cos(time) - y * sin(time);
						let theta_value = theta3(z_real, q);
						
						// Normalize value for coloring
						let normalized_value = theta_value / 5.0; // Adjust divisor based on typical values
						
						// Create a color gradient
						let color1 = vec3<f32>(0.05, 0.05, 0.2); // Dark blue
						let color2 = vec3<f32>(0.0, 0.4, 0.8);   // Medium blue
						let color3 = vec3<f32>(0.0, 0.7, 1.0);   // Light blue
						
						// Multi-step gradient
						var color: vec3<f32>;
						if (normalized_value < 0.5) {
							color = mix(color1, color2, normalized_value * 2.0);
						} else {
							color = mix(color2, color3, (normalized_value - 0.5) * 2.0);
						}
						
						// Add subtle patterns
						let pattern = 0.05 * sin(x * 10.0 + time) * sin(y * 10.0 + time);
						color = color + vec3<f32>(pattern, pattern, pattern);
						
						// Add vignette effect
						let dist = length(vec2<f32>(x, y) / 2.0);
						let vignette = 1.0 - smoothstep(0.5, 1.5, dist);
						color = color * vignette;
						
						return vec4<f32>(color, 1.0);
					}
				`
			});
			
			// Create render pipeline
			this.pipeline = this.device.createRenderPipeline({
				layout: this.pipelineLayout,
				vertex: {
					module: this.shaderModule,
					entryPoint: 'vertexMain',
					buffers: [{
						arrayStride: 8, // 2 floats, 4 bytes each
						attributes: [{
							shaderLocation: 0,
							offset: 0,
							format: 'float32x2'
						}]
					}]
				},
				fragment: {
					module: this.shaderModule,
					entryPoint: 'fragmentMain',
					targets: [{
						format: navigator.gpu.getPreferredCanvasFormat()
					}]
				},
				primitive: {
					topology: 'triangle-list'
				}
			});
			
			// Create bind group
			this.bindGroup = this.device.createBindGroup({
				layout: this.bindGroupLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.uniformBuffer }
					}
				]
			});
			
			this.isInitialized = true;
			console.log("2D Pipeline initialized successfully");
			return true;
		} catch (error) {
			console.error("Error initializing 2D Pipeline:", error);
			return false;
		}
	}
	
	render(commandEncoder, textureView, time) {
		if (!this.isInitialized || !textureView) {
			return;
		}
		
		try {
			// Update uniform buffer with time and resolution
			const canvas = this.resourceManager.canvas;
			const width = canvas ? canvas.width : 800;
			const height = canvas ? canvas.height : 600;
			
			this.device.queue.writeBuffer(
				this.uniformBuffer,
				0,
				new Float32Array([time, width, height, 0.0])
			);
			
			// Create render pass
			const renderPassDescriptor = {
				colorAttachments: [{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
					loadOp: 'clear',
					storeOp: 'store'
				}]
			};
			
			// Begin render pass
			const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
			passEncoder.setPipeline(this.pipeline);
			passEncoder.setBindGroup(0, this.bindGroup);
			passEncoder.setVertexBuffer(0, this.vertexBuffer);
			passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
			passEncoder.drawIndexed(6); // 2 triangles = 6 indices
			passEncoder.end();
		} catch (error) {
			console.error("Error in 2D Pipeline render:", error);
		}
	}
	
	cleanup() {
		console.log("Cleaning up 2D Pipeline");
		this.isInitialized = false;
	}
}
