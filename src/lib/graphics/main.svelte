<script>
  import { onMount } from 'svelte';
  import Engine from './Engine.js'; // Import the Engine module
  import { mousePosition, viewportSize } from '$lib//store/store.js'; // Import interaction store
  import BirdExperience from './engine/BirdExperience.js'; // Import the BirdExperience module

  let canvas;
  let engine;

  onMount(() => {
    // Initialize the WebGPU engine and start the render loop
    engine = new Engine(canvas);
    engine.start(BirdExperience);

    // Set up interaction listeners to update the central store
    const handleResize = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.clientWidth * devicePixelRatio);
      const height = Math.floor(canvas.clientHeight * devicePixelRatio);
      viewportSize.set({ width, height });
    };

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / rect.width;
      const mouseY = (event.clientY - rect.top) / rect.height;
      mousePosition.set({ x: mouseX, y: mouseY });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    handleResize(); // Initial resize to set the viewport size

    // Cleanup listeners on component destroy
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
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
