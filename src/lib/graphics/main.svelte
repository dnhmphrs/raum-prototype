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
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

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
    border-radius: 24px;
    z-index: 5;
    pointer-events: none;
  }
  
  .image-overlay img {
    max-height: 80vh;
    max-width: 90vw;
    opacity: 0.8;
  }
  
  .toggle-visibility-button {
    min-width: 150px;
    min-height: 35px;
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    padding: 10px 20px;
    background-color: transparent;
    color: #d0d0d0;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
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
</style>
