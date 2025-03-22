<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import FlockingExperience from '$lib/graphics/experiences/Flocking/FlockingExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  import { showUI } from '$lib/store/store';
  import { flockingDitherSettings, setCurrentDitherSettings } from '$lib/store/ditherStore.js';
  import BackButton from '$lib/components/BackButton.svelte';
  import DitherControls from '$lib/components/DitherControls.svelte';
  
  let canvas;
  let engine;
  let mounted = false;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1;
  
  // Experience accent color from store
  const accentColor = getExperienceColor('flocking');
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    // Make sure the flocking experience's dither settings are current
    setCurrentDitherSettings('flocking');
    
    // Initialize the engine with the canvas
    loadingMessage = "Initializing graphics engine...";
    loadingProgress = 30;
    engine = new Engine(canvas);
    
    // Start the Flocking experience with camera config
    loadingMessage = "Loading Flocking simulation...";
    loadingProgress = 60;
    await engine.start(FlockingExperience, getCameraConfig('Flocking'));
    
    loadingMessage = "Finalizing...";
    loadingProgress = 90;
    
    // Hide loading screen after a short delay
    setTimeout(() => {
      loadingProgress = 100;
      setTimeout(() => {
        mounted = true;
      }, 300);
    }, 500);
    
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
  <iframe title="music" style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=1967289637/size=small/bgcol=333333/linkcol=ffffff/track=2440001588/transparent=true/" seamless><a href="https://masayoshifujita.bandcamp.com/album/bird-ambience">Bird Ambience by Masayoshi</a></iframe>
</div> -->

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  <LoadingOverlay 
    isLoading={!mounted} 
    message={loadingMessage} 
    accentColor={accentColor}
    progress={loadingProgress}
  />
  
  <BackButton />
  
  <!-- Use our new component instead of inline controls -->
  <DitherControls {engine} />
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
</style> 