<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
    
    let canvas;
    let engine;
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Lorentz experience
            await engine.start(LorentzExperience);
            
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
        } else if (!navigator.gpu) {
            alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
        }
    });
</script>

<svelte:head>
    <title>Lorentz Attractor</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    <a href="/" class="back-button">Back to Home</a>
    
    <div class="info-panel">
        <h2>LORENTZ ATTRACTOR</h2>
        <p>A visualization of the Lorentz strange attractor, a system of differential equations that exhibits chaotic behavior.</p>
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
</style> 