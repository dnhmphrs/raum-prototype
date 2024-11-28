<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js';
  import BirdExperience from './experiences/Flocking/FlockingExperience.js';
  import CubeExperience from './experiences/Cube/CubeExperience.js';

  let canvas;
  let engine;
  let currentExperience = 'Bird'; // Toggle between "Bird" and "Cube"

  const startExperience = async () => {
    if (engine) {
      engine.cleanup();
    }
    const Experience = currentExperience === 'Bird' ? BirdExperience : CubeExperience;
    engine = new Engine(canvas);
    await engine.start(Experience);
  };

  onMount(() => {
    startExperience();
  });

  const switchExperience = () => {
    currentExperience = currentExperience === 'Bird' ? 'Cube' : 'Bird';
    startExperience();
  };
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

<button on:click={switchExperience} class="toggle-button">
  Switch to {currentExperience === 'Bird' ? 'Cube' : 'Bird'} Experience
</button>

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

.toggle-button {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  padding: 10px 20px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.toggle-button:hover {
  background-color: #0056b3;
}
</style>
