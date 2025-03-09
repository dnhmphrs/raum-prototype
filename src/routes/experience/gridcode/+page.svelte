<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import GridCodeExperience from '$lib/graphics/experiences/GridCode/GridCodeExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    
    let canvas;
    let engine;
    let experience;
    let isLoading = true; // Loading state
    let loadingMessage = "Initializing WebGPU..."; // Dynamic loading message
    
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
    
    // Function to stop event propagation
    function stopPropagation(event) {
        event.stopPropagation();
    }
    
    // Function to prevent default and stop propagation
    function preventDefaultAndStopPropagation(event) {
        event.preventDefault();
        event.stopPropagation();
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
        } else if (window.gridCodeExperience) {
            window.gridCodeExperience.updateKPScale(scaleIndex);
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
        } else if (window.gridCodeExperience) {
            window.gridCodeExperience.updateKPDistortion(distortion);
        }
    }
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            loadingMessage = "Initializing graphics engine...";
            engine = new Engine(canvas);
            
            // Get the Grid Code camera config
            const cameraConfig = getCameraConfig('GridCode');
            
            // Start the Grid Code experience with the camera config
            loadingMessage = "Loading Grid Code experience...";
            const result = await engine.start(GridCodeExperience, cameraConfig);
            
            // Try to get the experience reference in multiple ways
            if (engine.experience) {
                experience = engine.experience;
            } else if (engine.scene && engine.scene.currentExperience) {
                experience = engine.scene.currentExperience;
            } else if (window.gridCodeExperience) {
                experience = window.gridCodeExperience;
            }
            
            console.log("Experience initialized:", experience);
            
            // Initialize KP parameters
            if (experience) {
                experience.updateKPScale(kpScaleIndex);
                experience.updateKPDistortion(kpDistortion);
            }
            
            // Hide loading indicator
            setTimeout(() => {
                isLoading = false;
            }, 1000);
            
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
            loadingMessage = "WebGPU is not supported in your browser";
            setTimeout(() => {
                alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
            }, 1000);
        }
    });
</script>

<svelte:head>
    <title>τ-Function // Grid Code</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
    
    <a href="/" class="back-button">⏎ Back</a>
    
    <!-- Loading overlay -->
    {#if isLoading}
    <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">{loadingMessage}</div>
    </div>
    {/if}
    
    <div 
        class="control-panel"
        on:mousedown={stopPropagation}
        on:mouseup={stopPropagation}
        on:mousemove={stopPropagation}
        on:wheel={preventDefaultAndStopPropagation}
    >
        <h2>τ-FUNCTION // GRID CODE</h2>
        <p>Computational model of the grid code using a τ-function</p>
        
        <div class="controls">
            <h3>Parameters</h3>
            
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
        
        <div class="info">
            <p>The τ-function is a mathematical model that produces hexagonal grid patterns similar to those observed in grid cells in the mammalian brain.</p>
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
    
    /* Loading overlay styles */
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid rgba(255, 153, 0, 0.3);
        border-radius: 50%;
        border-top-color: #ff9900;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 20px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .loading-text {
        color: #ff9900;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        text-align: center;
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
        color: #ff9900;
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
    
    .controls {
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
    
    .info {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .highlight {
        color: #ff9900;
        font-weight: bold;
    }
</style> 