<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js';
  import BirdExperience from './experiences/Flocking/FlockingExperience.js';
  import CubeExperience from './experiences/Cube/CubeExperience.js';
  import NeuralNetExperience from './experiences/NeuralNet/NeuralNetExperience.js';
  import PoincaréExperience from './experiences/Poincaré/PoincaréExperience.js';

  let canvas;
  let engine;
  let currentExperience = 'Bird'; // Default experience
  let showButtons = false; // Variable to control button visibility

  const experiences = {
    Bird: BirdExperience,
    Cube: CubeExperience,
    NeuralNet: NeuralNetExperience,
    Poincaré: PoincaréExperience,
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

  const toggleButtons = () => {
    showButtons = !showButtons;
  };
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

<div class="music">
  <iframe title="music" style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=1967289637/size=small/bgcol=333333/linkcol=ffffff/track=2440001588/transparent=true/" seamless><a href="https://masayoshifujita.bandcamp.com/album/bird-ambience">Bird Ambience by Masayoshi Fujita</a></iframe>
</div>

<!-- Toggle Visibility Button -->
<button class="toggle-visibility-button" on:click={toggleButtons}>
  {#if showButtons}Hide Buttons{:else}{/if}
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
<div class="predator-pov-border"></div>
<div class="predator-pov">
  Predator POV
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

  .music {
    position: absolute;
    padding: 0;
    margin: 0;
    border: none;
    z-index: 10;
    overflow: hidden;
  }

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

  /* Styles for the Toggle Visibility Button */
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

  /* Add this to your styles */
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
