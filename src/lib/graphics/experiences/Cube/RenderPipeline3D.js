import Pipeline from '../../pipelines/Pipeline';
import shaderCode from './theta3D.wgsl';

export default class RenderPipeline3D extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer) {
		super(device);
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
	}

	async initialize() {
		console.log("Initializing 3D Pipeline");
		
		try {
			// Create bind group layout
			this.bindGroupLayout = this.device.createBindGroupLayout({
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: 'uniform' } // Projection matrix
					},
					{
						binding: 1,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: 'uniform' } // View matrix
					},
					{
						binding: 2,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: { type: 'uniform' } // Time uniform
					}
				]
			});
			
			// Create pipeline layout
			this.pipelineLayout = this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout]
			});
			
			// Create shader module
			this.shaderModule = this.device.createShaderModule({
				label: 'Cube Shader',
				code: `
					struct VertexOutput {
						@builtin(position) position: vec4<f32>,
						@location(0) color: vec3<f32>
					};
					
					struct TimeUniform {
						unused: vec3<f32>,
						time: f32,
					}
					
					@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
					@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
					@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;
					
					@vertex
					fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
						var output: VertexOutput;
						
						// Rotate the cube
						let time = timeUniform.time;
						let rotationX = mat4x4<f32>(
							1.0, 0.0, 0.0, 0.0,
							0.0, cos(time * 0.5), -sin(time * 0.5), 0.0,
							0.0, sin(time * 0.5), cos(time * 0.5), 0.0,
							0.0, 0.0, 0.0, 1.0
						);
						
						let rotationY = mat4x4<f32>(
							cos(time), 0.0, sin(time), 0.0,
							0.0, 1.0, 0.0, 0.0,
							-sin(time), 0.0, cos(time), 0.0,
							0.0, 0.0, 0.0, 1.0
						);
						
						// Apply rotation and transform
						let rotatedPosition = rotationY * rotationX * vec4<f32>(position, 1.0);
						output.position = projection * view * rotatedPosition;
						
						// Generate color based on position
						output.color = normalize(abs(position)) * 0.5 + 0.5;
						
						return output;
					}
					
					@fragment
					fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
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
						arrayStride: 12, // 3 floats, 4 bytes each
						attributes: [{
							shaderLocation: 0,
							offset: 0,
							format: 'float32x3'
						}]
					}]
				},
				fragment: {
					module: this.shaderModule,
					entryPoint: 'fragmentMain',
					targets: [{
						format: navigator.gpu.getPreferredCanvasFormat(),
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							}
						}
					}]
				},
				primitive: {
					topology: 'triangle-list',
					cullMode: 'back'
				},
				depthStencil: {
					format: 'depth24plus',
					depthWriteEnabled: true,
					depthCompare: 'less'
				}
			});
			
			this.isInitialized = true;
			console.log("3D Pipeline initialized successfully");
			return true;
		} catch (error) {
			console.error("Error initializing 3D Pipeline:", error);
			return false;
		}
	}

	render(commandEncoder, textureView, depthTextureView, uniformBuffer) {
		if (!this.isInitialized || !textureView || !depthTextureView) {
			return;
		}
		
		try {
			// Get camera buffers
			const { projectionBuffer, viewBuffer } = this.camera.getBuffers();
			
			// Create bind group for this render pass
			const bindGroup = this.device.createBindGroup({
				layout: this.bindGroupLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: projectionBuffer }
					},
					{
						binding: 1,
						resource: { buffer: viewBuffer }
					},
					{
						binding: 2,
						resource: { buffer: uniformBuffer }
					}
				]
			});
			
			// Create render pass with explicit depth testing
			// IMPORTANT: Use 'load' instead of 'clear' to preserve the background
			const renderPassDescriptor = {
				colorAttachments: [{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, // Transparent clear color
					loadOp: 'load', // Use 'load' to preserve background
					storeOp: 'store'
				}],
				depthStencilAttachment: {
					view: depthTextureView,
					depthClearValue: 1.0,
					depthLoadOp: 'clear', // Clear depth buffer
					depthStoreOp: 'store'
				}
			};
			
			// Begin render pass
			const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
			passEncoder.setPipeline(this.pipeline);
			passEncoder.setBindGroup(0, bindGroup);
			passEncoder.setVertexBuffer(0, this.vertexBuffer);
			passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
			passEncoder.drawIndexed(36); // 12 triangles = 36 indices for a cube
			passEncoder.end();
		} catch (error) {
			console.error("Error in 3D Pipeline render:", error);
		}
	}

	cleanup() {
		console.log("Cleaning up 3D Pipeline");
		this.isInitialized = false;
	}
}
