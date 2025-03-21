<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import PoincareExperience from '$lib/graphics/experiences/Poincare/PoincareExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import BackButton from '$lib/components/BackButton.svelte';
  
  let canvas;
  let engine;
  let mounted = false;
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    try {
      // Initialize the engine with the canvas
      engine = new Engine(canvas);
      
      // Start the Poincare experience with camera config
      await engine.start(PoincareExperience, getCameraConfig('Poincare'));
      
      mounted = true;
      
      // Handle window resize
      const handleResize = () => {
        if (engine) {
          try {
            engine.handleResize();
          } catch (error) {
            console.warn("Error during resize:", error);
          }
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (engine) {
          engine.cleanup();
        }
      };
    } catch (error) {
      console.error("Error loading Poincare experience:", error);
      alert("Failed to load Poincare experience: " + error.message);
    }
  });
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
</script>

<svelte:head>
  <title>Poincare Visualization</title>
</svelte:head>

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  {#if !mounted}
    <div class="loading">
      <p>Loading Poincare Visualization...</p>
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