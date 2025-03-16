<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import FlockingExperience from '$lib/graphics/experiences/Flocking/FlockingExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  
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
    
    // Start the Flocking experience with camera config
    await engine.start(FlockingExperience, getCameraConfig('Flocking'));
    
    mounted = true;
    
    // Handle window resize
    const handleResize = () => {
      if (engine && engine.resourceManager) {
        engine.resourceManager.handleResize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Update image loading
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl; // Use the local path
    img.onload = () => {
      imageLoaded = true;
      showImage = true; // Show image after loading
      console.log("Image loaded successfully");
    };
    img.onerror = (e) => {
      console.error("Error loading image:", e);
    };
    
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
  <title>Flocking Simulation</title>
</svelte:head>

<!-- <div class="music">
  <iframe title="music" style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=1967289637/size=small/bgcol=333333/linkcol=ffffff/track=2440001588/transparent=true/" seamless><a href="https://masayoshifujita.bandcamp.com/album/bird-ambience">Bird Ambience by Masayoshi Fujita</a></iframe>
</div> -->

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  {#if !mounted}
    <div class="loading">
      <p>Loading Flocking Simulation...</p>
    </div>
  {/if}
  
  <a href="/" class="back-button">⏎ Back</a>
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
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.3s;
    z-index: 100;
  }
  
  .back-button:hover {
    background-color: rgba(0, 0, 0, 0.9);
  }
  
  .image-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
    pointer-events: none;
  }
  
  .image-overlay img {
    max-height: 80vh;
    max-width: 90vw;
    width: auto;
    opacity: 0.9;
  }
</style> 