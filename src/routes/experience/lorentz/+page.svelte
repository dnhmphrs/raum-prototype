<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
    
    let canvas;
    let engine;
    let cleanup = null;
    
    onMount(() => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Lorentz experience
            engine.start(LorentzExperience).then(() => {
                console.log("Lorentz experience started successfully");
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
    
    <a href="/" class="back-button">← Back</a>
    
    <div class="info-panel">
        <h2>LORENTZ ATTRACTOR</h2>
        <p>A visualization of the Lorentz strange attractor, a system of differential equations that exhibits chaotic behavior.</p>
        <p class="small-text">The visualization uses WebGPU with depth testing to render the complete 3D structure.</p>
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
    
    .info-panel {
        position: absolute;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.7);
        padding: 15px;
        border-radius: 4px;
        color: white;
        z-index: 100;
        font-family: 'Courier New', monospace;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(5px);
        max-width: 400px;
    }
    
    .info-panel h2 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 16px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #00ffff;
    }
    
    .info-panel p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.9;
    }
    
    .info-panel p.small-text {
        font-size: 12px;
        opacity: 0.7;
        margin-top: 8px;
    }
</style>
