<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import CubeExperience from '$lib/graphics/experiences/Cube/CubeExperience.js';
  
  let canvas;
  let engine;
  let mounted = false;
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    // Initialize the engine with the canvas
    engine = new Engine(canvas);
    
    // Start the Cube experience
    await engine.start(CubeExperience);
    
    mounted = true;
    
    // Handle window resize
    const handleResize = () => {
      if (engine && engine.resourceManager) {
        engine.resourceManager.handleResize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (engine) {
        engine.cleanup();
      }
    };
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
  
  <a href="/" class="back-button">Back to Home</a>
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
  
  .back-button {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.3s;
    z-index: 100;
  }
  
  .back-button:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
</style> 