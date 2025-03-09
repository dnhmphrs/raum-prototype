<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import RiemannExperience from '$lib/graphics/experiences/Riemann/RiemannExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    
    let canvas;
    let engine;
    let experience;
    
    // Available manifold functions
    const manifoldTypes = [
        { id: 'flat', name: 'Flat Surface' },
        { id: 'sine', name: 'Sine Wave' },
        { id: 'ripple', name: 'Ripple' },
        { id: 'complex', name: 'Complex Function' },
        { id: 'kp', name: '𝜏-Function / grid code' },
        { id: 'torus', name: 'Torus' }
    ];
    
    // Current selected manifold - set KP as default
    let selectedManifold = manifoldTypes.find(m => m.id === 'kp');
    
    // KP shader parameters
    let kpScaleIndex = 2; // Default scale index (middle scale)
    let kpDistortion = 0; // Default distortion (none)
    
    // Module options for KP shader
    const scaleOptions = [
        { value: 0, label: 'Module 1' },
        { value: 1, label: 'Module 2' },
        { value: 2, label: 'Module 3' },
        { value: 3, label: 'Module 4' },
        { value: 4, label: 'Module 5' },
        { value: 5, label: 'Module 6' }
    ];
    
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
    
    // Function to update KP scale
    function updateKPScale(scaleIndex) {
        console.log(`Updating KP scale to: ${scaleIndex}`);
        kpScaleIndex = scaleIndex;
        
        // Try multiple ways to find the experience
        if (experience) {
            experience.updateKPScale(scaleIndex);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            engine.scene.currentExperience.updateKPScale(scaleIndex);
        } else if (window.riemannExperience) {
            window.riemannExperience.updateKPScale(scaleIndex);
        }
    }
    
    // Function to update KP distortion
    function updateKPDistortion(distortion) {
        console.log(`Updating KP distortion to: ${distortion}`);
        kpDistortion = distortion;
        
        // Try multiple ways to find the experience
        if (experience) {
            experience.updateKPDistortion(distortion);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            engine.scene.currentExperience.updateKPDistortion(distortion);
        } else if (window.riemannExperience) {
            window.riemannExperience.updateKPDistortion(distortion);
        }
    }
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            engine = new Engine(canvas);
            
            // Get the Riemann camera config
            const cameraConfig = getCameraConfig('Riemann');
            
            // Start the Riemann experience with the camera config
            const result = await engine.start(RiemannExperience, cameraConfig);
            
            // Try to get the experience reference in multiple ways
            if (engine.experience) {
                experience = engine.experience;
            } else if (engine.scene && engine.scene.currentExperience) {
                experience = engine.scene.currentExperience;
            } else if (window.riemannExperience) {
                experience = window.riemannExperience;
            }
            
            console.log("Experience initialized:", experience);
            
            // Ensure KP is the selected manifold
            if (experience) {
                experience.updateSurface('kp');
                
                // Initialize KP parameters
                experience.updateKPScale(kpScaleIndex);
                experience.updateKPDistortion(kpDistortion);
            }
            
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
    <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
    
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
        
        {#if selectedManifold.id === 'kp'}
            <div class="kp-controls">
                <h2>KP Shader Controls</h2>
                
                <div class="control-group">
                    <label for="kp-scale">Module:</label>
                    <select 
                        id="kp-scale" 
                        bind:value={kpScaleIndex} 
                        on:change={() => updateKPScale(kpScaleIndex)}
                    >
                        {#each scaleOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
                
                <div class="control-group">
                    <label for="kp-distortion">Distortion: {kpDistortion.toFixed(2)}</label>
                    <input 
                        type="range" 
                        id="kp-distortion" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        bind:value={kpDistortion} 
                        on:input={() => updateKPDistortion(kpDistortion)}
                    />
                </div>
            </div>
        {/if}
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
    
    .webgpu-canvas {
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
    
    .kp-controls {
        border-top: 1px solid #444;
        padding-top: 15px;
        margin-top: 10px;
    }
    
    .control-group {
        margin-bottom: 15px;
    }
    
    label {
        display: block;
        margin-bottom: 5px;
    }
    
    select, input[type="range"] {
        width: 100%;
        padding: 5px;
        background-color: #333;
        color: white;
        border: 1px solid #555;
        border-radius: 4px;
    }
    
    select {
        height: 30px;
    }
</style> 