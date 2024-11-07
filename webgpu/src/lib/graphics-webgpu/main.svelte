<script>
  import { onMount } from 'svelte';
  import { initializeWebGPU } from './webgpu/WebGPUContext.js';
  import { createRenderPipeline2D, updateViewportSize2D, updateMousePosition } from './webgpu/RenderPipeline2D.js';
  import { createRenderPipeline3D, updateViewportSize3D, updateMousePosition3d } from './webgpu/RenderPipeline3D.js';
  import { createComputePipeline, initializeComputeBuffers, readBuffer, runComputePass } from './webgpu/ComputePipeline.js';
  import Camera from './webgpu/Camera.js';
  import CameraController from './webgpu/CameraController.js';
  import Scene from './webgpu/Scene.js';

  let canvas;
  let device, context, renderPipeline2DSetup, renderPipeline3DSetup, computePipeline;
  let camera; // Camera instance for 3D rendering
  let cameraController; // Controls the camera's movements
  let scene; // Scene object to manage 2D and 3D elements

  onMount(async () => {
    // Initialize WebGPU context
    ({ device, context } = await initializeWebGPU(canvas));

    // Initialize the camera and its controller
    camera = new Camera(device, canvas.clientWidth, canvas.clientHeight);
    cameraController = new CameraController(camera);

    // Initialize 2D and 3D render pipelines
    renderPipeline2DSetup = await createRenderPipeline2D(device);
    renderPipeline3DSetup = await createRenderPipeline3D(device, camera);
    
    // Initialize compute pipeline and buffers
    computePipeline = await createComputePipeline(device);
    initializeComputeBuffers(device);

    // Create and initialize the scene
    scene = new Scene(device, renderPipeline2DSetup, renderPipeline3DSetup, camera);

    if (device && context && computePipeline) {
      resizeCanvas();
      
      // Run compute pass before the first render
      await runComputePass(device, computePipeline); 
      await device.queue.onSubmittedWorkDone();

      // Map readBuffer for reading back data
      await readBuffer.mapAsync(GPUMapMode.READ);
      const mappedData = new Float32Array(readBuffer.getMappedRange());
      console.log("Computed data:", mappedData.slice(0, 10));
      readBuffer.unmap();

      // Start the rendering loop
      render();
    }

    // Add event listeners for resizing and mouse movement
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Clean up event listeners on component destruction
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  // Resize canvas and update viewport
  function resizeCanvas() {
    if (!canvas) return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.floor(canvas.clientHeight * devicePixelRatio);

    updateViewportSize2D(device, canvas.width, canvas.height);
    updateViewportSize3D(device, canvas.width, canvas.height);
    cameraController.updateAspect(canvas.width, canvas.height); // Update camera aspect and matrices
  }

  // Handle mouse down to start dragging for camera controls
  function handleMouseDown(event) {
    cameraController.startDrag(event.clientX, event.clientY);
  }

  // Handle mouse up to stop dragging
  function handleMouseUp() {
    cameraController.endDrag();
  }

  // Handle mouse move for both camera control and 2D renderer updates
  function handleMouseMove(event) {
    if (cameraController.isDragging) {
      cameraController.handleMouseMove(event.clientX, event.clientY);
    }
    // Existing functionality for updating 2D renderer uniforms
    if (!canvas || !device) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) / rect.width;
    const mouseY = (event.clientY - rect.top) / rect.height;
    updateMousePosition(device, mouseX, mouseY);
    updateMousePosition3d(device, mouseX, mouseY);
  }

  // Main render loop
  function render() {
    if (!device || !context || !scene) return;

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    // Update camera buffers each frame
    camera.updateBuffers();

    // Render the scene with both pipelines
    scene.render(commandEncoder, textureView);

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
  }
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

<style>
.geometry {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
  margin: 0;
  border: none;
  z-index: -1;
}
</style>
