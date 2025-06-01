<!-- <script>
  import ExperienceWrapper from '$lib/components/ExperienceWrapper.svelte';
  import CubeExperience from '$lib/graphics/experiences/Cube/CubeExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  
  const accentColor = getExperienceColor('cube');
</script>

<svelte:head>
  <title>Theta Cube Experience</title>
</svelte:head>

<ExperienceWrapper 
  experienceClass={CubeExperience} 
  cameraConfig={getCameraConfig('Cube')}
  accentColor={accentColor}
>
  <div slot="default" let:engine let:experience let:isLoading>
      <a href="/" class="back-button">⏎ Back</a>
      
      {#if !isLoading}
      <div class="control-panel" style="--accent: {accentColor};">
          <h2>THETA CUBE</h2>
          <p>Interactive visualization of Jacobi theta functions on cube geometry</p>
          
          <div class="info">
              <p>
                  The Jacobi theta function is visualized both in 2D (background) and 3D (cube geometry).
                  Mouse interaction controls the tau parameter of the theta function.
              </p>
          </div>
      </div>
      {/if}
  </div>
</ExperienceWrapper>

<style>
  .back-button {
      position: absolute;
      top: 20px;
      left: 20px;
      padding: 8px 16px;
      background-color: rgba(0, 0, 0, 0.6);
      color: white;
      text-decoration: none;
      font-family: 'Courier New', monospace;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: background-color 0.3s;
      z-index: 100;
  }
  
  .back-button:hover {
      background-color: rgba(0, 0, 0, 0.8);
  }
  
  .control-panel {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      padding: 20px;
      border-radius: 8px;
      color: white;
      z-index: 100;
      font-family: 'Courier New', monospace;
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(5px);
      width: 300px;
  }
  
  .control-panel h2 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent, #ff6600);
  }
  
  .control-panel p {
      margin: 0 0 15px;
      font-size: 14px;
      line-height: 1.5;
      opacity: 0.9;
  }
  
  .info {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
</style> -->