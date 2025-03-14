<!-- 
  ExperienceWrapper.svelte
  A common wrapper component for all WebGPU experiences that handles memory management
-->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import { getMemoryStats, formatBytes } from '$lib/graphics/utils/MemoryManager.js';
  
  // Props
  export let experienceClass; // The experience class to instantiate
  export let cameraConfig = {}; // Camera configuration
  export let showMemoryStats = false; // Whether to show memory stats
  export let autoCleanupInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Internal state
  let canvas;
  let engine;
  let experience;
  let isLoading = true;
  let loadingMessage = "Initializing WebGPU...";
  let memoryMonitorInterval;
  let memoryUsage = { current: 0, peak: 0 };
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Function to monitor memory usage
  function startMemoryMonitoring() {
    if (typeof window.performance !== 'undefined' && window.performance.memory) {
      memoryMonitorInterval = setInterval(() => {
        const currentUsage = window.performance.memory.usedJSHeapSize;
        memoryUsage.current = currentUsage;
        memoryUsage.peak = Math.max(memoryUsage.peak, currentUsage);
        
        // Dispatch memory stats event
        dispatch('memoryUpdate', { 
          current: formatBytes(currentUsage),
          peak: formatBytes(memoryUsage.peak),
          limit: formatBytes(window.performance.memory.jsHeapSizeLimit),
          stats: getMemoryStats()
        });
        
        // Log if memory usage is growing significantly
        if (currentUsage > 0.9 * window.performance.memory.jsHeapSizeLimit) {
          console.warn("Memory usage is approaching the limit!", formatBytes(currentUsage));
          
          // Try to force garbage collection
          if (engine && typeof engine.performGarbageCollection === 'function') {
            engine.performGarbageCollection();
          }
        }
      }, 5000); // Check every 5 seconds
    }
  }
  
  onMount(async () => {
    if (canvas && navigator.gpu) {
      // Start memory monitoring
      startMemoryMonitoring();
      
      // Initialize the engine with the canvas
      loadingMessage = "Initializing graphics engine...";
      engine = new Engine(canvas);
      
      // Configure auto cleanup interval
      engine.autoCleanupInterval = autoCleanupInterval;
      
      // Start the experience with the camera config
      loadingMessage = `Loading ${experienceClass.name} experience...`;
      experience = await engine.start(experienceClass, cameraConfig);
      
      // Dispatch the experience ready event
      dispatch('ready', { engine, experience });
      
      // Update loading message to indicate we're finalizing
      loadingMessage = "Finalizing...";
      
      // Hide loading screen immediately after the next frame renders
      requestAnimationFrame(() => {
        isLoading = false;
        dispatch('loaded');
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
        console.log("Component being destroyed, cleaning up resources");
        
        // Stop memory monitoring
        if (memoryMonitorInterval) {
          clearInterval(memoryMonitorInterval);
          memoryMonitorInterval = null;
        }
        
        // Log final memory usage
        if (typeof window.performance !== 'undefined' && window.performance.memory) {
          console.log("Final memory usage:", formatBytes(window.performance.memory.usedJSHeapSize));
          console.log("Peak memory usage:", formatBytes(memoryUsage.peak));
          console.log("Detailed memory stats:", getMemoryStats());
        }
        
        // First remove any global references
        // This is a common pattern in the experiences
        if (window.currentExperience) {
          window.currentExperience = null;
        }
        
        // Then stop the engine which will trigger all cleanup
        if (engine) {
          console.log("Stopping engine");
          engine.stop();
          engine = null;
        }
        
        // Clear experience reference
        if (experience) {
          experience = null;
        }
        
        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }
        
        // Dispatch cleanup event
        dispatch('cleanup');
      };
    } else if (!navigator.gpu) {
      loadingMessage = "WebGPU is not supported in your browser";
      dispatch('error', { message: "WebGPU is not supported in your browser" });
      setTimeout(() => {
        alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      }, 1000);
    }
  });
  
  // Function to get the current engine instance
  export function getEngine() {
    return engine;
  }
  
  // Function to get the current experience instance
  export function getExperience() {
    return experience;
  }
  
  // Function to force garbage collection
  export function forceCleanup() {
    if (engine) {
      engine.performGarbageCollection();
      return true;
    }
    return false;
  }
</script>

<div class="experience-container">
  <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
  
  <!-- Loading overlay -->
  {#if isLoading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <div class="loading-text">{loadingMessage}</div>
  </div>
  {/if}
  
  <!-- Memory stats display (if enabled) -->
  {#if showMemoryStats && !isLoading}
  <div class="memory-stats">
    <div>Current: {formatBytes(memoryUsage.current)}</div>
    <div>Peak: {formatBytes(memoryUsage.peak)}</div>
    {#if window.performance && window.performance.memory}
    <div>Limit: {formatBytes(window.performance.memory.jsHeapSizeLimit)}</div>
    {/if}
    <button on:click={forceCleanup}>Force GC</button>
  </div>
  {/if}
  
  <!-- Slot for experience-specific UI -->
  <slot {engine} {experience} {isLoading}></slot>
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
  
  /* Memory stats display */
  .memory-stats {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 100;
  }
  
  .memory-stats button {
    margin-top: 5px;
    background: #ff9900;
    border: none;
    color: black;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  }
</style> 