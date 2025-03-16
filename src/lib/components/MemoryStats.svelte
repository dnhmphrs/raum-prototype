<script>
  import { onMount, onDestroy } from 'svelte';
  import { getMemoryStats, formatBytes } from '$lib/graphics/utils/MemoryManager.js';
  import { page } from '$app/stores';
  import VideoRecorder from './VideoRecorder.svelte';
  
  // Props
  export let showResourceCounts = false;
  
  // Memory usage state
  let memoryUsage = { current: 0, peak: 0 };
  let memoryMonitorInterval;
  let resourceCounts = { buffers: 0, textures: 0, total: 0 };
  
  // Check if we're on the homepage
  $: isHomepage = $page && $page.url.pathname === '/';
  
  // Function to monitor memory usage
  function startMemoryMonitoring() {
    if (typeof window.performance !== 'undefined' && window.performance.memory) {
      memoryMonitorInterval = setInterval(() => {
        const currentUsage = window.performance.memory.usedJSHeapSize;
        memoryUsage.current = currentUsage;
        memoryUsage.peak = Math.max(memoryUsage.peak, currentUsage);
        
        // Get resource counts from MemoryManager
        const stats = getMemoryStats();
        if (stats && stats.resourceCounts) {
          resourceCounts = stats.resourceCounts;
        }
        
        // Log if memory usage is growing significantly
        if (currentUsage > window.performance.memory.jsHeapSizeLimit * 0.8) {
          console.warn("Memory usage is approaching the limit!", formatBytes(currentUsage));
        }
      }, 2000); // Check every 2 seconds
    }
  }
  
  onMount(() => {
    // Start memory monitoring
    startMemoryMonitoring();
  });
  
  onDestroy(() => {
    // Stop memory monitoring
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = null;
    }
  });
</script>

{#if !isHomepage}
<div class="memory-stats">
  <div>Current: {formatBytes(memoryUsage.current)}</div>
  <div>Peak: {formatBytes(memoryUsage.peak)}</div>
  {#if window.performance && window.performance.memory}
  <div>Limit: {formatBytes(window.performance.memory.jsHeapSizeLimit)}</div>
  {/if}
  
  <!-- Additional resource stats from MemoryManager -->
  {#if showResourceCounts && resourceCounts}
    <div class="resource-counts">
      <div>Buffers: {resourceCounts.buffers}</div>
      <div>Textures: {resourceCounts.textures}</div>
      <div>Total: {resourceCounts.total}</div>
    </div>
  {/if}
  
  <!-- Video recorder component -->
  <VideoRecorder />
</div>
{/if}

<style>
  .memory-stats {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 4px;
    z-index: 100;
  }
  
  .resource-counts {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
  }
</style> 