<script>
  import { currentDitherSettings } from '$lib/store/ditherStore.js';
  import { showUI } from '$lib/store/store.js';

  export let engine = null;
  export let customStyle = '';

  // This reference is the entire store value in one object.
  // The $store syntax automatically subscribes and re-renders.
  $: dither = $currentDitherSettings;

  let showControls = false;

  // If you still need a toggle function
  function toggleDither() {
    // Just update the store property directly
    currentDitherSettings.update(settings => ({
      ...settings,
      enabled: !settings.enabled
    }));
    if (engine?.experience) {
      engine.experience.toggleDitherEffect(!dither.enabled);
    }
  }

  // If you need to do something once the user moves a slider
  // but do not want to spam calls on every “input,” call it
  // in on:change (fires after they release). Or use on:input
  // if you want real-time updates.
  function onSliderChange() {
    if (engine?.experience) {
      // Provide the new settings to your engine
      engine.experience.updateDitherEffectSettings(
        dither.patternScale,
        dither.thresholdOffset,
        dither.noiseIntensity,
        dither.colorReduction
      );
    }
  }
</script>

{#if $showUI}
  <div class="control-panel" style={customStyle}>
    <button class="control-toggle" on:click={() => (showControls = !showControls)}>
      {showControls ? '✕' : '⚙'}
    </button>

    {#if showControls}
      <div class="controls-container">
        <div class="control-group">
          <label class="control-label">
            <!-- Two-way bind directly to $currentDitherSettings.enabled -->
            <input
              type="checkbox"
              bind:checked={dither.enabled}
              on:change={toggleDither}
            />
            Dither Effect
          </label>
        </div>

        {#if dither.enabled}
          <div class="control-group">
            <label>
              Pattern Scale: {dither.patternScale.toFixed(1)}
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                bind:value={dither.patternScale}
                on:change={onSliderChange}
              />
            </label>
            <span class="control-hint">Lower = larger pixels</span>
          </div>

          <div class="control-group">
            <label>
              Threshold Offset: {dither.thresholdOffset.toFixed(2)}
              <input
                type="range"
                min="-0.2"
                max="0.2"
                step="0.01"
                bind:value={dither.thresholdOffset}
                on:change={onSliderChange}
              />
            </label>
            <span class="control-hint">Adjusts contrast in dither pattern</span>
          </div>

          <div class="control-group">
            <label>
              Noise: {dither.noiseIntensity.toFixed(2)}
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.01"
                bind:value={dither.noiseIntensity}
                on:change={onSliderChange}
              />
            </label>
            <span class="control-hint">Adds random variation</span>
          </div>

          <div class="control-group">
            <label>
              Color Reduction: {dither.colorReduction.toFixed(1)}
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.1"
                bind:value={dither.colorReduction}
                on:change={onSliderChange}
              />
            </label>
            <span class="control-hint">Lower = fewer colors</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .control-panel {
    position: absolute;
    top: 20px;
    right: 80px; /* Positioned to leave space for the UI toggle button */
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
    background-color: var(--background-80);
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