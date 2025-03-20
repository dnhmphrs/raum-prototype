<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import NeuralNetExperience from '$lib/graphics/experiences/NeuralNet/NeuralNetExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  import BackButton from '$lib/components/BackButton.svelte';
  
  let canvas;
  let engine;
  let mounted = false;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1;
  
  // Experience accent color from store
  const accentColor = getExperienceColor('neuralnet');
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    // Initialize the engine with the canvas
    loadingMessage = "Initializing graphics engine...";
    loadingProgress = 30;
    engine = new Engine(canvas);
    
    // Start the Neural Network experience with camera config
    loadingMessage = "Loading Neural Network...";
    loadingProgress = 60;
    await engine.start(NeuralNetExperience, getCameraConfig('NeuralNet'));
    
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
  <title>Neural Network Visualization</title>
</svelte:head>

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  <LoadingOverlay 
    isLoading={!mounted} 
    message={loadingMessage} 
    accentColor={accentColor}
    progress={loadingProgress}
  />
  
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
</style> 