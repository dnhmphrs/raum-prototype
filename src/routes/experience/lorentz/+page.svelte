<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    
    let canvas;
    let engine;
    let mounted = false;
    
    // Lorentz parameters with wider ranges
    let sigma = 10;
    let rho = 28;
    let beta = 8/3;
    let dt = 0.001;
    let initialX = 0.1;
    let initialY = 0;
    let initialZ = 0;
    
    // Presets for interesting behaviors
    const presets = [
        { name: "Classic", sigma: 10, rho: 28, beta: 8/3, dt: 0.001, initialX: 0.1, initialY: 0, initialZ: 0 },
        { name: "Chaotic", sigma: 16, rho: 45, beta: 4, dt: 0.002, initialX: 0.1, initialY: 0.1, initialZ: 0.1 },
        { name: "Periodic", sigma: 10, rho: 160, beta: 8/3, dt: 0.001, initialX: 1, initialY: 1, initialZ: 1 },
        { name: "Unstable", sigma: 14, rho: 28, beta: 2.6, dt: 0.002, initialX: 0.1, initialY: 0, initialZ: 0 },
        { name: "Extreme", sigma: 40, rho: 80, beta: 5, dt: 0.001, initialX: -5, initialY: 5, initialZ: 10 },
        { name: "Wild", sigma: 28, rho: 99, beta: 10, dt: 0.001, initialX: 2, initialY: 3, initialZ: 4 },
        { name: "Spiral", sigma: 5, rho: 90, beta: 15, dt: 0.0005, initialX: 0, initialY: 1, initialZ: 0 },
        { name: "Crazy", sigma: 60, rho: 150, beta: 1, dt: 0.0001, initialX: 10, initialY: -10, initialZ: 5 }
    ];
    
    // Apply a preset
    function applyPreset(preset) {
        sigma = preset.sigma;
        rho = preset.rho;
        beta = preset.beta;
        dt = preset.dt;
        initialX = preset.initialX;
        initialY = preset.initialY;
        initialZ = preset.initialZ;
        
        // Apply immediately
        if (engine?.currentExperience?.resetWithParameters) {
            engine.currentExperience.resetWithParameters(
                sigma, rho, beta, dt, [initialX, initialY, initialZ]
            );
        }
    }
    
    // Update parameters in the experience
    function updateParams() {
        if (engine?.currentExperience) {
            // Update all parameters
            engine.currentExperience.sigma = sigma;
            engine.currentExperience.rho = rho;
            engine.currentExperience.beta = beta;
            engine.currentExperience.dt = dt;
            
            // Reset with new initial conditions
            engine.currentExperience.currentPoint = [initialX, initialY, initialZ];
            
            // Force regeneration of points with new parameters
            if (typeof engine.currentExperience.generatePoints === 'function') {
                engine.currentExperience.generatePoints();
            }
            
            console.log('Updated Lorentz parameters:', { sigma, rho, beta, dt, initialX, initialY, initialZ });
        }
    }
    
    // Add a reset function to see dramatic changes
    function resetAttractor() {
        if (engine?.currentExperience) {
            engine.currentExperience.currentPoint = [initialX, initialY, initialZ];
        }
    }
    
    // Use individual reactive statements for better performance
    $: if (mounted && engine?.currentExperience) engine.currentExperience.sigma = sigma;
    $: if (mounted && engine?.currentExperience) engine.currentExperience.rho = rho;
    $: if (mounted && engine?.currentExperience) engine.currentExperience.beta = beta;
    $: if (mounted && engine?.currentExperience) engine.currentExperience.dt = dt;
    
    onMount(async () => {
        if (!navigator.gpu) {
            alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
            return;
        }
        
        try {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Lorentz experience with camera config
            await engine.start(LorentzExperience, getCameraConfig('Lorentz'));
            
            mounted = true;
            
            // Handle window resize
            const handleResize = () => {
                if (engine) {
                    // Check if handleResize exists before calling it
                    if (typeof engine.handleResize === 'function') {
                        engine.handleResize();
                    } else if (engine.resourceManager && typeof engine.resourceManager.handleResize === 'function') {
                        engine.resourceManager.handleResize();
                    } else {
                        console.log('Resize handler not available');
                    }
                }
            };
            
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                if (engine) {
                    engine.cleanup();
                }
            };
        } catch (error) {
            console.error("Error initializing Lorentz experience:", error);
            mounted = true; // Set to true to hide loading screen
        }
    });
    
    onDestroy(() => {
        if (engine) {
            engine.cleanup();
        }
    });
</script>

<svelte:head>
    <title>Lorentz Attractor</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    {#if !mounted}
        <div class="loading">
            <p>Loading Lorentz Attractor...</p>
        </div>
    {/if}
    
    <div class="controls">
        <h3 class="controls-title">Presets</h3>
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

        <h3 class="controls-title">Parameters</h3>
        <div class="slider-group">
            <label>
                σ (sigma): {sigma.toFixed(1)}
                <input type="range" bind:value={sigma} min="0" max="100" step="0.1">
            </label>
        </div>
        <div class="slider-group">
            <label>
                ρ (rho): {rho.toFixed(1)}
                <input type="range" bind:value={rho} min="0" max="200" step="0.1">
            </label>
        </div>
        <div class="slider-group">
            <label>
                β (beta): {beta.toFixed(2)}
                <input type="range" bind:value={beta} min="0" max="20" step="0.1">
            </label>
        </div>
        <div class="slider-group">
            <label>
                dt: {dt.toFixed(4)}
                <input type="range" bind:value={dt} min="0.0001" max="0.01" step="0.0001">
            </label>
        </div>
        
        <h3 class="controls-title">Initial Conditions</h3>
        <div class="slider-group">
            <label>
                Initial X: {initialX.toFixed(2)}
                <input type="range" bind:value={initialX} min="-10" max="10" step="0.1">
            </label>
        </div>
        <div class="slider-group">
            <label>
                Initial Y: {initialY.toFixed(2)}
                <input type="range" bind:value={initialY} min="-10" max="10" step="0.1">
            </label>
        </div>
        <div class="slider-group">
            <label>
                Initial Z: {initialZ.toFixed(2)}
                <input type="range" bind:value={initialZ} min="-10" max="10" step="0.1">
            </label>
        </div>
        
        <button class="reset-button" on:click={resetAttractor}>Reset Attractor</button>
    </div>
    
    <a href="/" class="back-button">Back to Home</a>
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
    
    .loading {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 1.5rem;
    }
    
    .back-button {
        position: absolute;
        top: 20px;
        left: 20px;
        padding: 8px 16px;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-size: 14px;
        transition: background-color 0.3s;
        z-index: 100;
    }
    
    .back-button:hover {
        background-color: rgba(0, 0, 0, 0.8);
    }
    
    .controls {
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
    
    .slider-group {
        margin-bottom: 15px;
    }
    
    .slider-group label {
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
    
    .controls-title {
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 16px;
        letter-spacing: 2px;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 8px;
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
</style> 