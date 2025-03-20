<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import Engine from '$lib/graphics/Engine.js';
  import BackButton from '$lib/components/BackButton.svelte';
  import { showUI } from '$lib/store/store';
  
  export let data;
  
  let canvas;
  let engine;
  let mounted = false;
  
  // Function to load the appropriate experience based on the URL parameter
  onMount(async () => {
    if (!data.experience || !canvas || !navigator.gpu) {
      if (!navigator.gpu) {
        alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      }
      return;
    }
    
    try {
      // Dynamically import the experience class
      const experienceModule = await import(`../../../lib/graphics/experiences/${data.experience}/${data.experience}Experience.js`);
      const ExperienceClass = experienceModule.default;
      
      // Import camera config
      const { getCameraConfig } = await import('../../../lib/graphics/config/cameraConfigs.js');
      
      // Initialize the engine with the canvas
      engine = new Engine(canvas);
      
      // Start the experience with camera config
      await engine.start(ExperienceClass, getCameraConfig(data.experience));
      
      mounted = true;
      
      // Handle window resize
      const handleResize = () => {
        if (engine) {
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
    } catch (error) {
      console.error(`Error loading ${data.experience} experience:`, error);
      alert(`Failed to load ${data.experience} experience: ${error.message}`);
    }
  });
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
</script>

<svelte:head>
  <title>{data.experience ? `${data.experience} Experience` : 'Experience Not Found'}</title>
</svelte:head>

{#if !data.experience}
  <div class="error-container">
    <h2>Experience Not Found</h2>
    <p>The experience "{$page.params.catchall}" doesn't exist or is not available.</p>
    <a href="/">Return to Home</a>
  </div>
{:else}
  <div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    {#if !mounted}
      <div class="loading">
        <p>Loading {data.experience} Experience...</p>
      </div>
    {/if}
    
    <BackButton />
  </div>
{/if}

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 2rem;
  }
  
  .error-container a {
    margin-top: 2rem;
    padding: 0.75rem 1.5rem;
    background-color: #ffffff;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }
  
  .error-container a:hover {
    background-color: #2d3748;
  }

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