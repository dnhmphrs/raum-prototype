<script>
    import ExperienceWrapper from '$lib/components/ExperienceWrapper.svelte';
    import GridCodeExperience from '$lib/graphics/experiences/GridCode/GridCodeExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    
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
    
    // Function to handle wheel events in the control panel
    function handleControlPanelWheel(event) {
        // This function ensures that wheel events in the control panel
        // don't affect the 3D experience behind it
        
        // Check if scrolling is needed within the control panel
        const panel = event.currentTarget;
        const atTop = panel.scrollTop === 0;
        const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight;
        
        // Only prevent default if we're at the boundaries to avoid overscrolling
        // This allows natural scrolling within the panel
        if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
            event.preventDefault();
        }
        
        // Always stop propagation to prevent the event from reaching the canvas
        event.stopPropagation();
    }
    
    // Function to update KP scale
    function updateKPScale(scaleIndex, experience) {
        kpScaleIndex = scaleIndex;
        
        if (experience) {
            experience.updateKPScale(scaleIndex);
        } else if (window.gridCodeExperience) {
            window.gridCodeExperience.updateKPScale(scaleIndex);
        }
    }
    
    // Function to update KP distortion
    function updateKPDistortion(distortion, experience) {
        kpDistortion = distortion;
        
        if (experience) {
            experience.updateKPDistortion(distortion);
        } else if (window.gridCodeExperience) {
            window.gridCodeExperience.updateKPDistortion(distortion);
        }
    }
    
    // Handle experience ready event
    function handleExperienceReady(event) {
        const { experience } = event.detail;
        
        // Initialize KP parameters
        if (experience) {
            experience.updateKPScale(kpScaleIndex);
            experience.updateKPDistortion(kpDistortion);
        }
    }
</script>

<svelte:head>
    <title>Θ-Function // Grid Code</title>
</svelte:head>

<ExperienceWrapper 
    experienceClass={GridCodeExperience} 
    cameraConfig={getCameraConfig('GridCode')}
    showMemoryStats={true}
    on:ready={handleExperienceReady}
>
    <div 
        slot="default"
        let:experience
        let:isLoading
    >
        <a href="/" class="back-button">⏎ Back</a>
        
        <!-- Control panel with proper wheel event handling -->
        {#if !isLoading}
        <div 
            class="control-panel"
            on:mousedown={stopPropagation}
            on:mouseup={stopPropagation}
            on:mousemove={stopPropagation}
            on:wheel={handleControlPanelWheel}
        >
            <h2>Riemann Θ-FUNCTION // MEC GRID CODE</h2>
            <p>Computational model of the MEC grid code using the Riemannn Θ-function</p>
            
            <div class="controls">
                <h3>Parameters</h3>
                
                <div class="control-group">
                    <label for="kp-scale">Module:</label>
                    <select 
                        id="kp-scale" 
                        bind:value={kpScaleIndex} 
                        on:change={() => updateKPScale(kpScaleIndex, experience)}
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
                        on:input={() => updateKPDistortion(kpDistortion, experience)}
                    />
                </div>
            </div>
            
            <div class="theta">
                <p>
                    Θ-functions are built from structured sums of Fourier modes that generate regular, periodic patterns.
                    They might serve as a mathematical model of the mammalian grid code, with harmonic scaling ratios between grid modules.
                </p>
            </div>
            
            <div class="tau">
                <p>
                    Future: τ-functions [Sato, 1981] extend Θ-functions by introducing non-linear interactions among these Fourier modes.
                    τ-functions naturally model the dynamics of shallow wave waves.
                    This will allow us to model more realistic grid codes - fill the environment with water!.
                    The maths may take about a year to get clear, hopefully with guidance from Leipzig/Dresden.
                    τ-functions should allow us to model the grid code in more complex environments, e.g. [Carpenter et al. 2015].
                </p>
            </div>
            
            <div class="psychosis">
                <p>
                    Finally, an impaired grid code has been linked to schizophrenia [Convertino et al. 2023].
                    Grid cells have been suggested to implement an error-correction mechanism [Fiete, 2011], so in psychosis,
                    disruptions in fronto-temporal theta coordination or increased 'noise' in the projection from mPFC to MEC
                    may undermine the stability of otherwise regular hexagonal patterns. These disruptions could align in part
                    with the framework proposed by Friston and Frith [1995], though this remains partially conjectural.
                </p>
            </div>
            
            
        </div>
        {/if}
    </div>
</ExperienceWrapper>

<style>
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
        scrollbar-width: thin;
        scrollbar-color: #ff9900 rgba(0, 0, 0, 0.3);
    }
    
    /* Custom scrollbar styling */
    .control-panel::-webkit-scrollbar {
        width: 6px;
    }
    
    .control-panel::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
    }
    
    .control-panel::-webkit-scrollbar-thumb {
        background-color: #ff9900;
        border-radius: 3px;
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
    
    .theta, .tau {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
</style> 