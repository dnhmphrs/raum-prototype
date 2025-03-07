<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
    
    let canvas;
    let engine;
    
    // Simplified parameters with descriptive names
    let chaosLevel = 50; // 0-100 scale for rho parameter
    let speed = 50;      // 0-100 scale for dt parameter
    
    // Presets with descriptive names
    const presets = [
        { name: "Classic", chaosLevel: 50, speed: 50 },
        { name: "Chaotic", chaosLevel: 80, speed: 70 },
        { name: "Gentle", chaosLevel: 30, speed: 30 },
        { name: "Wild", chaosLevel: 95, speed: 90 }
    ];
    
    // Apply a preset
    function applyPreset(preset) {
        chaosLevel = preset.chaosLevel;
        speed = preset.speed;
        updateParams();
    }
    
    // Update parameters in the experience
    function updateParams() {
        if (engine?.currentExperience) {
            // Map simplified parameters to actual values
            const rho = 28 + (chaosLevel - 50) * 0.6; // Range ~0-60
            const dt = 0.001 + (speed / 100) * 0.009; // Range 0.001-0.01
            
            // Update the experience
            engine.currentExperience.resetWithParameters(
                10, // sigma (fixed)
                rho,
                8/3, // beta (fixed)
                dt
            );
        }
    }
    
    // Reset the attractor
    function resetAttractor() {
        if (engine?.currentExperience) {
            engine.currentExperience.resetWithParameters(
                10,
                28 + (chaosLevel - 50) * 0.6,
                8/3,
                0.001 + (speed / 100) * 0.009,
                [0.1, 0, 0] // Reset to initial position
            );
        }
    }
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Lorentz experience
            await engine.start(LorentzExperience);
            
            // Apply initial parameters
            updateParams();
            
            // Handle window resize
            const handleResize = () => {
                if (engine && typeof engine.handleResize === 'function') {
                    engine.handleResize();
                }
            };
            
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                if (engine) engine.stop();
            };
        }
    });
    
    // Update parameters when sliders change
    $: if (engine?.currentExperience) {
        updateParams();
    }
</script>

<svelte:head>
    <title>Lorentz Attractor</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    <div class="controls-panel">
        <h2 class="controls-title">LORENTZ ATTRACTOR</h2>
        
        <div class="preset-buttons">
            {#each presets as preset}
                <button 
                    class="preset-button" 
                    on:click={() => applyPreset(preset)}
                >
                    {preset.name}
                </button>
            {/each}
        </div>
        
        <div class="control-group">
            <label>
                Chaos Level: {chaosLevel}
                <input type="range" min="0" max="100" bind:value={chaosLevel} />
            </label>
        </div>
        
        <div class="control-group">
            <label>
                Speed: {speed}
                <input type="range" min="0" max="100" bind:value={speed} />
            </label>
        </div>
        
        <button class="reset-button" on:click={resetAttractor}>
            RESET ATTRACTOR
        </button>
    </div>
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
    
    .controls-panel {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        padding: 20px;
        border-radius: 4px;
        color: white;
        z-index: 100;
        font-family: 'Courier New', monospace;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(5px);
        max-width: 300px;
    }
    
    .controls-title {
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 16px;
        letter-spacing: 2px;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 8px;
    }
    
    .preset-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 15px;
    }
    
    .preset-button {
        flex: 1;
        min-width: calc(50% - 4px);
        padding: 6px 0;
        background: rgba(0, 255, 255, 0.15);
        border: 1px solid rgba(0, 255, 255, 0.3);
        color: white;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .preset-button:hover {
        background: rgba(0, 255, 255, 0.3);
    }
    
    .control-group {
        margin-bottom: 15px;
    }
    
    .control-group label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.9);
    }
    
    input[type="range"] {
        width: 100%;
        margin: 5px 0;
        -webkit-appearance: none;
        appearance: none;
        height: 2px;
        background: rgba(255, 255, 255, 0.3);
        outline: none;
    }
    
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        border: none;
    }
    
    .reset-button {
        width: 100%;
        padding: 8px;
        background: rgba(0, 255, 255, 0.2);
        border: 1px solid rgba(0, 255, 255, 0.5);
        color: white;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        margin-top: 10px;
        transition: background 0.2s;
    }
    
    .reset-button:hover {
        background: rgba(0, 255, 255, 0.4);
    }
</style> 