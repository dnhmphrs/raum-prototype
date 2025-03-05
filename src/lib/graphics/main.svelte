<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js';
  import BirdExperience from './experiences/Flocking/FlockingExperience.js';
  import CubeExperience from './experiences/Cube/CubeExperience.js';
  import NeuralNetExperience from './experiences/NeuralNet/NeuralNetExperience.js';
  import PoincareExperience from './experiences/Poincare/PoincareExperience.js';
  import { getCameraConfig } from './config/cameraConfigs.js';

  let canvas;
  let engine;
  let currentExperience = 'Bird'; // Default experience
  let showButtons = false;
  let showImage = true;

  const experiences = {
    Bird: { class: BirdExperience, configKey: 'Flocking' },
    Cube: { class: CubeExperience, configKey: 'Cube' },
    NeuralNet: { class: NeuralNetExperience, configKey: 'NeuralNet' },
    Poincare: { class: PoincareExperience, configKey: 'Poincare' },
  };

  const startExperience = async (experienceName) => {
    currentExperience = experienceName;
    if (engine) {
      engine.cleanup();
    }
    const experience = experiences[experienceName];
    const config = getCameraConfig(experience.configKey);
    engine = new Engine(canvas);
    await engine.start(experience.class, config);
  };

  onMount(() => {
    startExperience(currentExperience);
  });

  const toggleButtons = () => {
    showButtons = !showButtons;
  };
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

<!-- Image overlay -->
{#if showImage}
  <div class="image-overlay">
    <img src="/notcrowded2.png" alt="Not Crowded" />
  </div>
{/if}

<!-- Toggle Visibility Button -->
<button class="toggle-visibility-button" on:click={toggleButtons}>
  {#if showButtons}Hide Buttons{:else}Show Buttons{/if}
</button>

<!-- Experience Buttons -->
{#if showButtons}
  <div class="button-container">
    {#each Object.keys(experiences) as experience}
      <button
        class="toggle-button"
        on:click={() => startExperience(experience)}
        class:active={currentExperience === experience}
      >
        {experience} Experience
      </button>
    {/each}
  </div>
{/if}

<!-- Add this right before the Predator POV Text -->
<!-- <div class="predator-pov-border"></div>
<div class="predator-pov">
  Predator POV - periodic target changes
</div> -->

<style>
  .geometry {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }
  
  .image-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    pointer-events: none;
  }
  
  .image-overlay img {
    max-height: 80vh;
    max-width: 90vw;
    opacity: 0.8;
  }
  
  .toggle-visibility-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    z-index: 100;
  }
  
  /* Remove unused music selector */

  .button-container {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    top: 10px;
    left: 10px;
    z-index: 10;
    display: flex;
    gap: 10px;
  }

  .toggle-button {
    padding: 10px 20px;
    background-color: transparent;
    color: #d0d0d0;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    border: solid 1px transparent;
  }

  .toggle-button.active {
    border-color: #d0d0d0;
    font-weight: bold;
  }

  .predator-pov-border {
    position: absolute;
    bottom: 10px;  /* matches padding */
    left: 10px;    /* matches padding */
    width: min(40vmin, 411.5px);   /* 40% of viewport min dimension */
    height: min(40vmin, 411.5px);  /* same as width */
    border: 1px solid rgba(255, 255, 255, 0.5);
    z-index: 9;
    pointer-events: none;
  }

  .predator-pov {
    position: absolute;
    bottom: 315px; /* Moved above the border - adjust as needed */
    left: 20px;
    color: white;
    font-size: 12px;
    z-index: 10;
  }
</style>
