<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
    
    let canvas;
    let engine;
    let cleanup = null;
    
    // Parameters for the Lorentz attractor - standard butterfly
    let params = {
        sigma: 10.0,
        rho: 28.0,
        beta: 8/3,
        dt: 0.0006,
        lineWidth: 1.0,
        rotationSpeed: 0.002
    };
    
    // Function to update parameters
    function updateParameters() {
        if (engine && engine.scene) {
            engine.scene.updateParameters(params);
        }
    }
    
    onMount(() => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Lorentz experience
            engine.start(LorentzExperience).then(() => {
                console.log("Lorentz experience started successfully");
                
                // Apply initial parameters after a short delay
                setTimeout(() => {
                    updateParameters();
                }, 500);
            }).catch(error => {
                console.error("Error starting Lorentz experience:", error);
            });
            
            // Handle window resize
            const handleResize = () => {
                if (engine && typeof engine.handleResize === 'function') {
                    engine.handleResize();
                }
            };
            
            window.addEventListener('resize', handleResize);
            
            // Store cleanup function
            cleanup = () => {
                console.log("Cleaning up Lorentz experience");
                window.removeEventListener('resize', handleResize);
                
                // Properly clean up the engine
                if (engine) {
                    if (engine.scene) {
                        engine.scene.cleanup();
                    }
                    if (typeof engine.cleanup === 'function') {
                        engine.cleanup();
                    }
                    
                    // Explicitly null out references
                    engine = null;
                }
                
                // Force garbage collection if available
                if (window.gc) {
                    window.gc();
                }
            };
        } else if (!navigator.gpu) {
            alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
        }
    });
    
    // Set up cleanup function for component destruction
    onDestroy(() => {
        if (cleanup) {
            cleanup();
        }
    });
</script>

<svelte:head>
    <title>Lorentz Attractor</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    <a href="/" class="back-button">⏎ Back</a>
    
    <div class="control-panel">
        <h2>LORENTZ ATTRACTOR</h2>
        
        <div class="sliders">
            <h3>Parameters</h3>
            
            <div class="slider-group">
                <label>Sigma: {params.sigma.toFixed(1)}</label>
                <input type="range" min="0.1" max="20" step="0.1" bind:value={params.sigma} on:change={updateParameters} />
            </div>
            
            <div class="slider-group">
                <label>Rho: {params.rho.toFixed(1)}</label>
                <input type="range" min="0.1" max="120" step="0.1" bind:value={params.rho} on:change={updateParameters} />
            </div>
            
            <div class="slider-group">
                <label>Beta: {params.beta.toFixed(2)}</label>
                <input type="range" min="0.1" max="10" step="0.01" bind:value={params.beta} on:change={updateParameters} />
            </div>
            
            <div class="slider-group">
                <label>Time Step: {params.dt.toFixed(4)}</label>
                <input type="range" min="0.0001" max="0.001" step="0.0001" bind:value={params.dt} on:change={updateParameters} />
            </div>
            
            <div class="slider-group">
                <label>Rotation Speed: {params.rotationSpeed.toFixed(4)}</label>
                <input type="range" min="0" max="0.005" step="0.0001" bind:value={params.rotationSpeed} on:change={updateParameters} />
            </div>
        </div>
        
        <div class="info">
            <p>The Lorentz attractor is a set of chaotic solutions to the Lorentz system, which describes atmospheric convection.</p>
            <p class="small-text">The system exhibits sensitive dependence on initial conditions, the so-called "butterfly effect".</p>
        </div>
    </div>
</div>

<style>
    .experience-container {
        width: 100%;
        height: 100vh;
        position: relative;
        overflow: hidden;
        background-color: #000;
    }
    
    canvas {
        width: 100%;
        height: 100%;
        display: block;
    }
    
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
        max-height: 90vh;
        overflow-y: auto;
    }
    
    .control-panel h2 {
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 18px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #00ffff;
        text-align: center;
    }
    
    .control-panel h3 {
        font-size: 14px;
        margin: 15px 0 10px;
        color: #aaa;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 5px;
    }
    
    .slider-group {
        margin-bottom: 15px;
    }
    
    .slider-group label {
        display: block;
        margin-bottom: 5px;
        font-size: 12px;
    }
    
    .slider-group input {
        width: 100%;
        background: rgba(30, 30, 30, 0.5);
        -webkit-appearance: none;
        height: 6px;
        border-radius: 3px;
        outline: none;
    }
    
    .slider-group input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
    }
    
    .slider-group input::-moz-range-thumb {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
        border: none;
    }
    
    .info {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .info p {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.5;
        opacity: 0.9;
    }
    
    .info p.small-text {
        font-size: 11px;
        opacity: 0.7;
    }
</style>
