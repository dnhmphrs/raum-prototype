<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import FlockingExperience from '$lib/graphics/experiences/Flocking/FlockingExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  import { showUI } from '$lib/store/store';
  import BackButton from '$lib/components/BackButton.svelte';
  
  let canvas;
  let engine;
  let mounted = false;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1;
  
  // Dither effect state
  let ditherEnabled = true;
  let showControls = false;
  let ditherSettings = {
    patternScale: 1.0,       // Controls pixel size (lower = larger pixels)
    thresholdOffset: -0.05,   // Slight negative offset for stronger contrast
    noiseIntensity: 0.08,     // Just a bit of noise to break up patterns
    colorReduction: 2.0,      // Very low value for extreme color banding
  };
  
  // Experience accent color from store
  const accentColor = getExperienceColor('flocking');
  
  // Function to toggle dither effect
  function toggleDither() {
    ditherEnabled = !ditherEnabled;
    if (engine && engine.experience) {
      engine.experience.toggleDitherEffect(ditherEnabled);
    }
  }
  
  // Function to toggle controls visibility
  function toggleControls() {
    showControls = !showControls;
  }
  
  // Function to update dither settings
  function updateDitherSettings() {
    if (engine && engine.experience) {
      engine.experience.updateDitherEffectSettings(
        ditherSettings.patternScale,
        ditherSettings.thresholdOffset,
        ditherSettings.noiseIntensity,
        ditherSettings.colorReduction
      );
    }
  }
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    // Initialize the engine with the canvas
    loadingMessage = "Initializing graphics engine...";
    loadingProgress = 30;
    engine = new Engine(canvas);
    
    // Start the Flocking experience with camera config
    loadingMessage = "Loading Flocking simulation...";
    loadingProgress = 60;
    await engine.start(FlockingExperience, getCameraConfig('Flocking'));
    
    // Initialize dither effect with our settings
    if (engine.experience) {
      // Apply our initial settings
      engine.experience.toggleDitherEffect(ditherEnabled);
      engine.experience.updateDitherEffectSettings(
        ditherSettings.patternScale,
        ditherSettings.thresholdOffset,
        ditherSettings.noiseIntensity,
        ditherSettings.colorReduction
      );
    }
    
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
  
  {#if $showUI}
    <!-- Dither Controls -->
    <div class="control-panel">
      <button class="control-toggle" on:click={toggleControls}>
        {showControls ? '✕' : '⚙'}
      </button>
      
      {#if showControls}
        <div class="controls-container">
          <div class="control-group">
            <label class="control-label">
              <input type="checkbox" checked={ditherEnabled} on:change={toggleDither} />
              Dither Effect
            </label>
          </div>
          
          {#if ditherEnabled}
            <div class="control-group">
              <label>
                Pattern Scale: {ditherSettings.patternScale.toFixed(1)}
                <input 
                  type="range" 
                  min="0.5" 
                  max="3.0" 
                  step="0.1" 
                  bind:value={ditherSettings.patternScale} 
                  on:change={updateDitherSettings}
                />
              </label>
              <span class="control-hint">Lower = larger pixels</span>
            </div>
            
            <div class="control-group">
              <label>
                Threshold Offset: {ditherSettings.thresholdOffset.toFixed(2)}
                <input 
                  type="range" 
                  min="-0.2" 
                  max="0.2" 
                  step="0.01" 
                  bind:value={ditherSettings.thresholdOffset} 
                  on:change={updateDitherSettings}
                />
              </label>
              <span class="control-hint">Adjusts contrast in dither pattern</span>
            </div>
            
            <div class="control-group">
              <label>
                Noise: {ditherSettings.noiseIntensity.toFixed(2)}
                <input 
                  type="range" 
                  min="0" 
                  max="0.3" 
                  step="0.01" 
                  bind:value={ditherSettings.noiseIntensity} 
                  on:change={updateDitherSettings}
                />
              </label>
              <span class="control-hint">Adds random variation</span>
            </div>
            
            <div class="control-group">
              <label>
                Color Reduction: {ditherSettings.colorReduction.toFixed(1)}
                <input 
                  type="range" 
                  min="1.5" 
                  max="5.0" 
                  step="0.1" 
                  bind:value={ditherSettings.colorReduction} 
                  on:change={updateDitherSettings}
                />
              </label>
              <span class="control-hint">Lower = fewer colors</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
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
  
  .control-panel {
    position: absolute;
    top: 20px;
    right: 80px; /* Positioned to leave space for the new UI toggle button */
    z-index: 100;
  }
  
  .control-toggle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s;
    margin-left: auto;
  }
  
  .control-toggle:hover {
    background-color: rgba(0, 0, 0, 0.9);
  }
  
  .controls-container {
    position: absolute;
    top: 50px;
    right: 0;
    width: 250px;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    padding: 15px;
    color: white;
    font-size: 12px;
  }
  
  .control-group {
    margin-bottom: 12px;
  }
  
  .control-group:last-child {
    margin-bottom: 0;
  }
  
  .control-group label {
    display: block;
    margin-bottom: 5px;
  }
  
  .control-group input[type="range"] {
    width: 100%;
    margin-top: 5px;
  }
  
  .control-hint {
    display: block;
    font-size: 10px;
    color: #aaa;
    margin-top: 3px;
  }
  
  .control-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style> 