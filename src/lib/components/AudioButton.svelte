<script>
  import { onMount } from 'svelte';
  import { showUI } from '$lib/store/store';
  
  // Props with default values
  export let customStyle = "";
  export let experience = null;
  
  // State variables
  let audioEnabled = false;
  let buttonVisible = true;
  let hideTimer;
  
  function toggleAudio() {
    if (!experience) return;
    
    if (audioEnabled) {
      // Mute the video
      if (experience.video) {
        experience.video.muted = true;
        audioEnabled = false;
      }
    } else {
      // Enable audio
      if (experience.video) {
        experience.video.muted = false;
        experience.video.volume = 0.5;
        audioEnabled = true;
        
        // Attempt to play if paused
        if (experience.video.paused && !experience.videoPlaying) {
          experience.playVideo().catch(err => {
            console.error("Error playing video with audio:", err);
          });
        }
      }
    }
  }
  
  // Update visibility when audio state changes
  $: if (audioEnabled) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      buttonVisible = false;
    }, 5000);
  }
  
  // Show button again on mousemove
  function handleMouseMove() {
    if (audioEnabled) {
      buttonVisible = true;
      
      // Hide again after 5 seconds
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        buttonVisible = false;
      }, 5000);
    }
  }
  
  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hideTimer) clearTimeout(hideTimer);
    };
  });
</script>

<svelte:window on:mousemove={handleMouseMove} />

{#if $showUI}
  <button
    class="audio-button"
    class:audio-on={audioEnabled}
    class:hidden={!buttonVisible && audioEnabled}
    on:click={toggleAudio}
    style={customStyle}
    aria-label={audioEnabled ? "Mute audio" : "Enable audio"}
  >
    {#if audioEnabled}
      <span class="icon">🔊</span>
    {:else}
      <span class="icon">🔈</span>
    {/if}
  </button>
{/if}

<style>
  .audio-button {
    position: absolute;
    z-index: 100;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }
  
  .audio-button:hover {
    background-color: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }
  
  .audio-button.audio-on {
    background-color: rgba(40, 167, 69, 0.7);
  }
  
  .audio-button.audio-on:hover {
    background-color: rgba(40, 167, 69, 0.9);
  }
  
  .audio-button.hidden {
    opacity: 0;
    pointer-events: none;
  }
  
  .icon {
    font-size: 18px;
  }
</style> 