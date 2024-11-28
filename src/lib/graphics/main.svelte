<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js';
  import BirdExperience from './engine/BirdExperience.js';

  let canvas;
  let engine;

  onMount(() => {
    engine = new Engine(canvas);
    engine.start(BirdExperience);

    return () => {
      engine.interactionManager.destroy(); // Clean up interactions
    };
  });
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

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
</style>
