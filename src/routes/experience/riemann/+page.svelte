<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import RiemannExperience from '$lib/graphics/experiences/Riemann/RiemannExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
    import { getExperienceColor } from '$lib/store/experienceStore.js';
    
    let canvas;
    let engine;
    let experience;
    let isLoading = true; // Loading state
    let loadingMessage = "Initializing WebGPU..."; // Dynamic loading message
    let loadingProgress = -1; // -1 means indeterminate
    
    // Experience accent color from store
    const accentColor = getExperienceColor('riemann');
    
    // Available manifold functions
    const manifoldTypes = [
        { id: 'flat', name: 'Flat Surface' },
        { id: 'sine', name: 'Sine Wave' },
        { id: 'ripple', name: 'Ripple' },
        { id: 'weird', name: 'Weird Function' },
        { id: 'torus', name: 'Torus' },
        { id: 'zeta', name: 'Zeta Function' }
    ];
    
    // Current selected manifold - set ripple as default
    let selectedManifold = manifoldTypes.find(m => m.id === 'ripple');
    
    // Zeta function parameters
    let zetaNumWaves = 5; // Number of waves for zeta function
    let zetaScale = 10.0; // Scale factor for zeta function frequencies
    
    // Function to stop event propagation
    function stopPropagation(event) {
        event.stopPropagation();
    }
    
    // Function to prevent default and stop propagation
    function preventDefaultAndStopPropagation(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Function to change the manifold
    function changeManifold(manifoldType) {
        selectedManifold = manifoldTypes.find(m => m.id === manifoldType);
        
        // Show loading indicator while changing surface
        isLoading = true;
        loadingMessage = `Loading ${selectedManifold.name}...`;
        
        // Try multiple ways to find the experience
        if (experience) {
            experience.updateSurface(manifoldType);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            engine.scene.currentExperience.updateSurface(manifoldType);
        } else if (window.riemannExperience) {
            window.riemannExperience.updateSurface(manifoldType);
        } else {
            console.error("Experience not initialized yet");
        }
        
        // Hide loading indicator after the surface is updated
        // Use requestAnimationFrame to ensure the new surface is rendered
        requestAnimationFrame(() => {
            isLoading = false;
        });
    }
    
    // Function to update zeta number of waves
    function updateZetaWaves() {
        if (experience) {
            experience.setZetaNumWaves(zetaNumWaves);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            engine.scene.currentExperience.setZetaNumWaves(zetaNumWaves);
        } else if (window.riemannExperience) {
            window.riemannExperience.setZetaNumWaves(zetaNumWaves);
        }
    }
    
    // Function to update zeta scale
    function updateZetaScale() {
        if (experience) {
            experience.setZetaScale(zetaScale);
        } else if (engine && engine.scene && engine.scene.currentExperience) {
            engine.scene.currentExperience.setZetaScale(zetaScale);
        } else if (window.riemannExperience) {
            window.riemannExperience.setZetaScale(zetaScale);
        }
    }
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            loadingMessage = "Initializing graphics engine...";
            loadingProgress = 20;
            engine = new Engine(canvas);
            
            // Get the Riemann camera config
            const cameraConfig = getCameraConfig('Riemann');
            
            // Start the Riemann experience with the camera config
            loadingMessage = "Loading Riemann experience...";
            loadingProgress = 40;
            const result = await engine.start(RiemannExperience, cameraConfig);
            
            // Try to get the experience reference in multiple ways
            if (engine.experience) {
                experience = engine.experience;
            } else if (engine.scene && engine.scene.currentExperience) {
                experience = engine.scene.currentExperience;
            } else if (window.riemannExperience) {
                experience = window.riemannExperience;
            }
            
            // Set initial surface to ripple
            if (experience) {
                loadingMessage = "Loading Ripple Surface...";
                loadingProgress = 70;
                experience.updateSurface('ripple');
                
                // Initialize zeta parameters
                experience.setZetaNumWaves(zetaNumWaves);
                experience.setZetaScale(zetaScale);
            }
            
            // Update loading message to indicate we're finalizing
            loadingMessage = "Finalizing...";
            loadingProgress = 90;
            
            // Hide loading screen immediately after the next frame renders
            // This ensures the experience is visible and ready
            requestAnimationFrame(() => {
                loadingProgress = 100;
                setTimeout(() => {
                    isLoading = false;
                }, 300); // Short delay to show 100% progress
            });
            
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
    <title>Riemann Manifold</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
    
    <a href="/" class="back-button">⏎ Back</a>
    
    <!-- Loading overlay -->
    <LoadingOverlay 
        isLoading={isLoading} 
        message={loadingMessage} 
        accentColor={accentColor}
        progress={loadingProgress}
    />
    
    <div 
        class="control-panel"
        on:mousedown={stopPropagation}
        on:mouseup={stopPropagation}
        on:mousemove={stopPropagation}
        on:wheel={preventDefaultAndStopPropagation}
        style="--accent: {accentColor};"
    >
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
        
        <!-- Zeta function controls -->
        {#if selectedManifold.id === 'zeta'}
            <div class="zeta-controls">
                <h3>Zeta Parameters</h3>
                <div class="control-group">
                    <label for="zeta-waves">Number of Waves: {zetaNumWaves}</label>
                    <input 
                        type="range" 
                        id="zeta-waves" 
                        min="1" 
                        max="20" 
                        step="1" 
                        bind:value={zetaNumWaves} 
                        on:input={updateZetaWaves}
                    />
                </div>
                <div class="control-group">
                    <label for="zeta-scale">Frequency Scale: {zetaScale.toFixed(2)}</label>
                    <input 
                        type="range" 
                        id="zeta-scale" 
                        min="0.1" 
                        max="100.0" 
                        step="1.0" 
                        bind:value={zetaScale} 
                        on:input={updateZetaScale}
                    />
                </div>
                <div class="zeta-info">
                    <p>Each wave n has:</p>
                    <ul>
                        <li>Frequency: log(n) × {zetaScale.toFixed(2)}</li>
                        <li>Amplitude: 1/n</li>
                    </ul>
                    <p>Surface shows sum of all {zetaNumWaves} waves.</p>
                    <p class="scale-help">Lower scale = zoomed out, higher scale = zoomed in</p>
                </div>
            </div>
        {/if}
        
        <div class="info">
            <p>Current: <span class="highlight">{selectedManifold.name}</span></p>
            {#if selectedManifold.id === 'zeta'}
                <p>The zeta surface demonstrates harmonic series behavior with logarithmic frequencies and harmonic amplitudes.</p>
            {/if}
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
        max-height: calc(100vh - 60px);
        overflow-y: auto;
    }
    
    .control-panel h2 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 18px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--accent, #00ffff);
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
    
    .button-group button {
        background-color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 8px 12px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }
    
    .button-group button:hover {
        background-color: rgba(0, 0, 0, 0.7);
        border-color: var(--accent, #00ffff);
    }
    
    .button-group button.active {
        background-color: rgba(0, 0, 0, 0.8);
        border-color: var(--accent, #00ffff);
        color: var(--accent, #00ffff);
    }
    
    .highlight {
        color: var(--accent, #00ffff);
        font-weight: bold;
    }
    
    .info {
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .zeta-controls {
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .control-group {
        margin-bottom: 15px;
    }
    
    .control-group label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #ccc;
    }
    
    .control-group input[type="range"] {
        width: 100%;
        -webkit-appearance: none;
        height: 6px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        outline: none;
    }
    
    .control-group input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--accent, #00ffff);
        cursor: pointer;
        box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }
    
    .control-group input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--accent, #00ffff);
        cursor: pointer;
        border: none;
        box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }
    
    .zeta-info {
        font-size: 12px;
        opacity: 0.8;
        margin-top: 10px;
    }
    
    .zeta-info ul {
        margin: 5px 0;
        padding-left: 20px;
    }
    
    .zeta-info li {
        margin: 2px 0;
        font-family: 'Courier New', monospace;
        font-size: 12px;
    }
    
    .scale-help {
        font-style: italic;
        color: #999;
        margin-top: 8px;
    }
    
    /* Custom scrollbar for control panel */
    .control-panel::-webkit-scrollbar {
        width: 6px;
    }
    
    .control-panel::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
    }
    
    .control-panel::-webkit-scrollbar-thumb {
        background-color: var(--accent, #00ffff);
        border-radius: 3px;
        opacity: 0.7;
    }
    
    .control-panel::-webkit-scrollbar-thumb:hover {
        opacity: 1;
    }
</style>