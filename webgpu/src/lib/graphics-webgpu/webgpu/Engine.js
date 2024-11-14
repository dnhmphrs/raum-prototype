// Engine.js
import { initializeWebGPU } from './WebGPUContext.js';
import { createRenderPipeline2D } from './RenderPipeline2D.js';
import { createRenderPipeline3D } from './RenderPipeline3D.js';
import {
	createComputePipeline,
	initializeComputeBuffers,
	runComputePass,
	readBuffer
} from './ComputePipeline.js';
import Camera from './Camera.js';
import CameraController from './CameraController.js';
import Scene from './Scene.js';
import { viewportSize, mousePosition } from '$lib/store/store.js';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.camera = null;
		this.cameraController = null;
		this.scene = null;
		this.renderPipeline2D = null;
		this.renderPipeline3D = null;
		this.computePipeline = null;
		this.viewportBuffer = null;
		this.mouseBuffer = null;

		// Bind interaction handlers to the Engine instance
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
	}

	async start() {
		await this.initializeWebGPU();
		await this.initializeBuffers();
		await this.initializePipelines();
		this.initializeScene();
		this.setupInteractions();
		this.render(); // Start the render loop
	}

	async initializeWebGPU() {
		({ device: this.device, context: this.context } = await initializeWebGPU(this.canvas));
		if (!this.device || !this.context)
			throw new Error('Failed to initialize WebGPU context or device.');
	}

	async initializeBuffers() {
		this.viewportBuffer = this.device.createBuffer({
			label: 'Viewport Uniform Buffer',
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.mouseBuffer = this.device.createBuffer({
			label: 'Mouse Uniform Buffer',
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
	}

	async initializePipelines() {
		this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
		this.cameraController = new CameraController(this.camera);

		this.renderPipeline2D = await createRenderPipeline2D(
			this.device,
			this.viewportBuffer,
			this.mouseBuffer
		);
		this.renderPipeline3D = await createRenderPipeline3D(
			this.device,
			this.camera,
			this.viewportBuffer,
			this.mouseBuffer
		);

		this.computePipeline = await createComputePipeline(this.device);
		initializeComputeBuffers(this.device);
		await runComputePass(this.device, this.computePipeline);
		await this.device.queue.onSubmittedWorkDone();

		await readBuffer.mapAsync(GPUMapMode.READ);
		const mappedData = new Float32Array(readBuffer.getMappedRange());
		console.log('Initial compute data:', mappedData.slice(0, 10));
		readBuffer.unmap();
	}

	initializeScene() {
		this.scene = new Scene(this.device);
	}

	setupInteractions() {
		// Subscribe to viewport and mouse position stores
		viewportSize.subscribe(({ width, height }) => {
			if (this.device) this.updateViewport(width, height);
		});

		mousePosition.subscribe(({ x, y }) => {
			if (this.device) {
				this.renderPipeline2D.updateMousePosition(this.device, x, y);
				this.renderPipeline3D.updateMousePosition(this.device, x, y);
			}
		});

		// Add event listeners for camera control
		window.addEventListener('mousedown', this.handleMouseDown);
		window.addEventListener('mousemove', this.handleMouseMove);
		window.addEventListener('mouseup', this.handleMouseUp);
	}

	handleMouseDown(event) {
		this.cameraController.startDrag(event.clientX, event.clientY);
	}

	handleMouseUp() {
		this.cameraController.endDrag();
	}

	handleMouseMove(event) {
		if (this.cameraController.isDragging) {
			this.cameraController.handleMouseMove(event.clientX, event.clientY);
		}
	}

	updateViewport(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.renderPipeline2D.updateViewportSize(this.device, width, height);
		this.renderPipeline3D.updateViewportSize(this.device, width, height);
		this.cameraController.updateAspect(width, height);
	}

	render() {
		if (!this.device || !this.context || !this.scene) return;

		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.context.getCurrentTexture().createView();

		this.camera.updateBuffers();

		const renderPassDescriptor2D = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0, g: 0, b: 0, a: 1 }
				}
			]
		};

		const passEncoder2D = commandEncoder.beginRenderPass(renderPassDescriptor2D);
		passEncoder2D.setPipeline(this.renderPipeline2D.pipeline);
		passEncoder2D.setBindGroup(0, this.renderPipeline2D.bindGroup);
		passEncoder2D.draw(3, 1, 0, 0);
		passEncoder2D.end();

		const renderPassDescriptor3D = {
			colorAttachments: [{ view: textureView, loadOp: 'load', storeOp: 'store' }]
		};

		const passEncoder3D = commandEncoder.beginRenderPass(renderPassDescriptor3D);
		passEncoder3D.setPipeline(this.renderPipeline3D.pipeline);
		passEncoder3D.setBindGroup(0, this.renderPipeline3D.bindGroup);

		this.scene.objects.forEach((object) => {
			passEncoder3D.setVertexBuffer(0, object.getVertexBuffer());
			passEncoder3D.setIndexBuffer(object.getIndexBuffer(), 'uint16');
			passEncoder3D.drawIndexed(object.getIndexCount(), 1, 0, 0, 0);
		});

		passEncoder3D.end();
		this.device.queue.submit([commandEncoder.finish()]);
		requestAnimationFrame(this.render.bind(this));
	}
}

export default Engine;
