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
        console.log(`Updating KP scale to: ${scaleIndex}`);
        kpScaleIndex = scaleIndex;
        
        if (experience) {
            experience.updateKPScale(scaleIndex);
        } else if (window.gridCodeExperience) {
            window.gridCodeExperience.updateKPScale(scaleIndex);
        }
    }
    
    // Function to update KP distortion
    function updateKPDistortion(distortion, experience) {
        console.log(`Updating KP distortion to: ${distortion}`);
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
                    Θ-functions are built from structured sums of Fourier modes that naturally produce regular, periodic patterns.
                    They may provide a mathematical model of the mammalian grid code - with harmonic scaling ratios.
                </p>
              </div>
              <div class="tau">
                <p>
                    Future: τ-functions extend Θ-functions by adding non-linear interactions among the Fourier modes.
                    This will allow us the model how how the grid code captures the subtle complexities of real-life phenomena. As a start, we can model the grid code with shallow water waves (there are <i>big</i> complexities; see [Sato, 1981] and a whole literature that I am yet to learn), but the real maths for the first steps will take a year or so to figure out and I will need Türkü.
                    Ultimately, the τ-function will allow us to model the grid code in complex envrionments, e.g. [Carptener et al. 2015].
                </p>
            </div>
                <div class="psychosis">
                    <p>
                        As a final note, an impaired grid code has been implicated in schizophrenia [Convertino et al. 2023].
                        In pyschosis, we may expect the regular hexagonal grid patterns to become less stable (impaired fronto-tempporal connectivity [Friston and Frith, 1995] due to a 'noisy' projection from mPFC to the MEC [conjecture]). The MEC grid code will instead look chaotic: <i>a raging sea.</i>
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
    
    .info {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .highlight {
        color: #ff9900;
        font-weight: bold;
    }
    
    .theta, .tau {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
</style> 