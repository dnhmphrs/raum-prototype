<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import CubeExperience from '$lib/graphics/experiences/Cube/CubeExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import BackButton from '$lib/components/BackButton.svelte';
  
  let canvas;
  let engine;
  let mounted = false;
  
  onMount(async () => {
    if (canvas && navigator.gpu) {
      // Initialize the engine with the canvas
      engine = new Engine(canvas);
      
      // Start the Cube experience with camera config
      await engine.start(CubeExperience, getCameraConfig('Cube'));
      
      mounted = true;
      
      // Handle window resize
      const handleResize = () => {
        if (engine) {
          // Use engine.handleResize() instead of engine.resourceManager.handleResize()
          engine.handleResize();
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (engine) {
          engine.cleanup();
        }
      };
    } else if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
    }
  });
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
</script>

<svelte:head>
  <title>Cube Experience</title>
</svelte:head>

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  {#if !mounted}
    <div class="loading">
      <p>Loading Cube Experience...</p>
    </div>
  {/if}
  
  <BackButton />
</div>

<style>
  .experience-container {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }
  
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  
  .loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 1.5rem;
  }
</style> 