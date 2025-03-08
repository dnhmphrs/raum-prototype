<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import RiemannExperience from '$lib/graphics/experiences/Riemann/RiemannExperience.js';
    
    let canvas;
    let engine;
    let experience;
    
    // Available manifold functions
    const manifoldTypes = [
        { id: 'flat', name: 'Flat Surface' },
        { id: 'sine', name: 'Sine Wave' },
        { id: 'ripple', name: 'Ripple' },
        { id: 'saddle', name: 'Saddle' },
        { id: 'gaussian', name: 'Gaussian' },
        { id: 'complex', name: 'Complex Function' },
        { id: 'mobius', name: 'Möbius Strip' },
        { id: 'torus', name: 'Torus' }
    ];
    
    // Current selected manifold
    let selectedManifold = manifoldTypes[0];
    
    // Function to change the manifold
    function changeManifold(manifoldType) {
        console.log(`Changing manifold to: ${manifoldType}`);
        selectedManifold = manifoldTypes.find(m => m.id === manifoldType);
        
        // Try multiple ways to find the experience
        if (experience) {
            console.log("Using local experience reference");
            experience.updateSurface(manifoldType);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            console.log("Using engine.scene.currentExperience");
            engine.scene.currentExperience.updateSurface(manifoldType);
        } else if (window.riemannExperience) {
            console.log("Using global window.riemannExperience");
            window.riemannExperience.updateSurface(manifoldType);
        } else {
            console.error("Experience not initialized yet");
        }
    }
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Start the Riemann experience and store the reference
            const result = await engine.start(RiemannExperience);
            
            // Try to get the experience reference in multiple ways
            if (engine.experience) {
                experience = engine.experience;
            } else if (engine.scene && engine.scene.currentExperience) {
                experience = engine.scene.currentExperience;
            } else if (window.riemannExperience) {
                experience = window.riemannExperience;
            }
            
            console.log("Experience initialized:", experience);
            
            // Handle window resize
            const handleResize = () => {
                if (engine) {
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
    <title>Riemann Manifold</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    <a href="/" class="back-button">⏎ Back</a>
    
    <div class="control-panel">
        <h2>RIEMANN MANIFOLD</h2>
        <p>Visualizing 2D manifolds in 3D space</p>
        
        <div class="manifold-selector">
            <h3>Select Manifold</h3>
            <div class="button-group">
                {#each manifoldTypes as manifold}
                    <button 
                        class:active={selectedManifold.id === manifold.id}
                        on:click={() => changeManifold(manifold.id)}
                    >
                        {manifold.name}
                    </button>
                {/each}
            </div>
        </div>
        
        <div class="info">
            <p>Current: <span class="highlight">{selectedManifold.name}</span></p>
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
    }
    
    .control-panel h2 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 18px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #00ffff;
    }
    
    .control-panel h3 {
        font-size: 14px;
        margin: 15px 0 10px;
        color: #aaa;
    }
    
    .control-panel p {
        margin: 0 0 15px;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.9;
    }
    
    .button-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    button {
        background-color: rgba(30, 30, 30, 0.8);
        color: white;
        border: 1px solid rgba(100, 100, 100, 0.3);
        padding: 8px 12px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    button:hover {
        background-color: rgba(50, 50, 50, 0.8);
        border-color: rgba(150, 150, 150, 0.5);
    }
    
    button.active {
        background-color: rgba(0, 150, 150, 0.5);
        border-color: #00ffff;
    }
    
    .info {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .highlight {
        color: #00ffff;
        font-weight: bold;
    }
</style> 