<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js';
  import BirdExperience from './experiences/Flocking/FlockingExperience.js';
  import CubeExperience from './experiences/Cube/CubeExperience.js';
  import NeuralNetExperience from './experiences/NeuralNet/NeuralNetExperience.js';

  let canvas;
  let engine;
  let currentExperience = 'NeuralNet'; // Default experience

  const experiences = {
    Bird: BirdExperience,
    Cube: CubeExperience,
    NeuralNet: NeuralNetExperience
  };

  const startExperience = async (experienceName) => {
    currentExperience = experienceName;
    if (engine) {
      engine.cleanup();
    }
    const Experience = experiences[experienceName];
    engine = new Engine(canvas);
    await engine.start(Experience);
  };

  onMount(() => {
    startExperience(currentExperience);
  });
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

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

<style>
.geometry {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
  margin: 0;
  border: none;
  z-index: -1;
}

.button-container {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 10px;
}

.toggle-button {
  padding: 10px 20px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
}

.toggle-button.active {
  background-color: #0056b3;
  font-weight: bold;
}

.toggle-button:hover:not(.active) {
  background-color: #0056b3;
}
</style>
