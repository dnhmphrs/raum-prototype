<script>
  import { onMount, onDestroy } from 'svelte';
  import { formatBytes } from '$lib/graphics/utils/MemoryManager.js';
  
  // Video capture state
  let showCapturePopup = false;
  let captureDuration = 5; // Default 5 seconds
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordingProgress = 0;
  let recordingTimer = null;
  let recordingStartTime = 0;
  
  // Quality presets for different recording modes
  const qualityPresets = {
    low: {
      fps: 30,
      bitrate: 15000000, // 20 Mbps
      fallbackBitrate: 10000000, // 12 Mbps
      lossless: true
    },
    medium: {
      fps: 60,
      bitrate: 30000000, // 35 Mbps
      fallbackBitrate: 15000000, // 20 Mbps
      lossless: true
    },
    high: {
      fps: 60,
      bitrate: 60000000, // 50 Mbps (near lossless)
      fallbackBitrate: 30000000, // 30 Mbps
      lossless: true
    }
  };
  
  // Default to medium quality
  let captureQuality = 'medium';
  
  // Function to toggle capture popup
  function toggleCapturePopup() {
    showCapturePopup = !showCapturePopup;
  }
  
  // Function to find the best canvas for capture
  function findCanvas() {
    // Try multiple selectors to find the canvas
    let canvas = document.querySelector('canvas.webgpu-canvas');
    
    // If not found, try other common selectors
    if (!canvas) {
      canvas = document.querySelector('.experience-container canvas');
    }
    
    // If still not found, try any canvas in the document
    if (!canvas) {
      const canvases = document.querySelectorAll('canvas');
      if (canvases.length > 0) {
        // Use the largest canvas by area as it's likely the main experience canvas
        let largestArea = 0;
        for (const c of canvases) {
          const area = c.width * c.height;
          if (area > largestArea) {
            largestArea = area;
            canvas = c;
          }
        }
      }
    }
    
    return canvas;
  }
  
  // Function to create a media recorder with optimal settings
  function createMediaRecorder(stream) {
    // Get quality settings based on selected preset
    const quality = qualityPresets[captureQuality];
    
    // Default options with high quality settings
    const options = { 
      mimeType: 'video/webm;codecs=vp9', // Use VP9 codec for better quality
      videoBitsPerSecond: quality.bitrate
    };
    
    // Try different lossless or near-lossless codec options
    const losslessOptions = [
      'video/webm;codecs=vp9.0 profile=3', // VP9 lossless profile
      'video/webm;codecs=vp9.2', // VP9 Profile 2 (10-bit)
      'video/webm;codecs=vp9'
    ];
    
    // Find the first supported lossless codec
    for (const codec of losslessOptions) {
      if (MediaRecorder.isTypeSupported(codec)) {
        options.mimeType = codec;
        break;
      }
    }
    
    // Fall back to standard options if preferred codec is not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.warn(`Lossless codec not supported, falling back to standard WebM`);
      return new MediaRecorder(stream, { 
        mimeType: 'video/webm',
        videoBitsPerSecond: quality.fallbackBitrate
      });
    } else {
      console.log(`Using codec: ${options.mimeType} with bitrate: ${options.videoBitsPerSecond}`);
      return new MediaRecorder(stream, options);
    }
  }
  
  // Function to update the recording progress display
  function updateRecordingProgress() {
    const elapsed = (Date.now() - recordingStartTime) / 1000;
    recordingProgress = Math.min(100, (elapsed / captureDuration) * 100);
  }
  
  // Function to start video capture
  async function startCapture() {
    try {
      // Find the canvas
      const canvas = findCanvas();
      if (!canvas) {
        console.error('No canvas found for capture');
        return;
      }
      
      // Get the actual canvas dimensions for high-resolution capture
      const width = canvas.width || canvas.clientWidth;
      const height = canvas.height || canvas.clientHeight;
      
      // Get quality settings
      const quality = qualityPresets[captureQuality];
      
      console.log(`Capturing canvas: ${width}x${height} at ${quality.fps} FPS (${captureQuality} quality)`);
      console.log(`Total duration: ${captureDuration}s`);
      
      // For all quality levels, try to use the canvas directly without scaling
      let stream;
      try {
        // Try to capture at native resolution first
        stream = canvas.captureStream(quality.fps);
        
        // If we're using OffscreenCanvas, we might need a different approach
        if (canvas instanceof OffscreenCanvas) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          
          // Set up a render loop to copy from the offscreen canvas
          const ctx = tempCanvas.getContext('2d');
          const renderLoop = () => {
            if (!isRecording) return;
            ctx.drawImage(canvas, 0, 0, width, height);
            requestAnimationFrame(renderLoop);
          };
          
          renderLoop();
          stream = tempCanvas.captureStream(quality.fps);
        }
      } catch (e) {
        console.warn(`Failed to capture at ${captureQuality} quality, falling back:`, e);
        stream = canvas.captureStream(quality.fps);
      }
      
      // Reset recording state
      recordedChunks = [];
      isRecording = true;
      recordingProgress = 0;
      
      // Create a single MediaRecorder for the entire duration
      mediaRecorder = createMediaRecorder(stream);
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`Data available: ${formatBytes(event.data.size)}`);
          recordedChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording completed');
        finalizeRecording(width, height, stream);
      };
      
      // For all quality levels, request data more frequently for better quality
      const dataInterval = 500; // 500ms for all quality levels
      
      // Start recording with appropriate data collection frequency
      mediaRecorder.start(dataInterval);
      
      // Store start time
      recordingStartTime = Date.now();
      
      // Start a timer to update the progress display
      recordingTimer = setInterval(() => {
        updateRecordingProgress();
      }, 100);
      
      // Schedule the stop after the specified duration
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          console.log('Stopping recording after duration');
          try {
            // Request data before stopping to ensure we get the last bit of data
            mediaRecorder.requestData();
            mediaRecorder.stop();
          } catch (error) {
            console.error('Error stopping recorder:', error);
            finalizeRecording(width, height, stream);
          }
        }
      }, captureDuration * 1000);
      
      // Close the popup
      showCapturePopup = false;
    } catch (error) {
      console.error('Error starting capture:', error);
      isRecording = false;
      recordingProgress = 0;
    }
  }
  
  // Function to finalize the recording and create the download
  function finalizeRecording(width, height, stream) {
    console.log(`Finalizing recording: ${recordedChunks.length} chunks collected`);
    
    if (recordedChunks.length === 0) {
      console.error('No chunks recorded, cannot create video');
      isRecording = false;
      recordingProgress = 0;
      return;
    }

    // Choose appropriate MIME type based on quality
    let mimeType = 'video/webm;codecs=vp9.0 profile=3'; // Try lossless profile first
    
    // Fall back to high quality VP9 if lossless not supported
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp9';
    }
    
    // Log each chunk size for debugging
    let totalSize = 0;
    recordedChunks.forEach((chunk, index) => {
      totalSize += chunk.size;
      console.log(`Chunk ${index + 1} size: ${formatBytes(chunk.size)}`);
    });
    
    console.log(`Total size before creating blob: ${formatBytes(totalSize)}`);
    
    // Create a blob from the recorded chunks
    const blob = new Blob(recordedChunks, { type: mimeType });
    
    console.log(`Combined video size: ${formatBytes(blob.size)}`);
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Include resolution and quality in filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quality = captureQuality.toUpperCase();
    a.download = `raum-capture-${width}x${height}-${quality}-${timestamp}.webm`;
    
    // Add to document, trigger download, and clean up
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Stop the recording timer
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      
      // Stop the stream tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Reset state
      recordedChunks = [];
      isRecording = false;
      recordingProgress = 0;
      mediaRecorder = null;
    }, 100);
  }
  
  // Function to cancel an ongoing recording
  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    
    recordedChunks = [];
    isRecording = false;
    recordingProgress = 0;
    mediaRecorder = null;
  }
  
  onDestroy(() => {
    // Stop any ongoing recording
    cancelRecording();
  });
</script>

<div class="video-recorder">
  <!-- Video capture button -->
  <div class="capture-controls">
    {#if isRecording}
      <div class="recording-status">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {recordingProgress}%"></div>
        </div>
        <button class="cancel-btn" on:click={cancelRecording} title="Cancel recording">
          ✕
        </button>
      </div>
    {:else}
      <button 
        class="capture-btn" 
        on:click={toggleCapturePopup}
        title="Capture video of experience"
      >
        <p>Record Frames: 📹</p>
      </button>
    {/if}
  </div>
  
  <!-- Capture popup -->
  {#if showCapturePopup}
    <div class="capture-popup">
      <div class="capture-popup-content">
        <div class="popup-header">
          <h3>Capture Experience</h3>
          <button class="close-btn" on:click={toggleCapturePopup}>×</button>
        </div>
        <div class="capture-form">
          <label for="duration">Duration (seconds)</label>
          <input 
            type="number" 
            id="duration" 
            bind:value={captureDuration} 
            min="1" 
            max="60" 
            step="1"
          />
          
          <label for="quality" class="quality-label">Quality</label>
          <div class="quality-selector">
            <button 
              class="quality-btn {captureQuality === 'low' ? 'active' : ''}" 
              on:click={() => captureQuality = 'low'}
              title="Lossless 30 FPS"
            >
              Low
            </button>
            <button 
              class="quality-btn {captureQuality === 'medium' ? 'active' : ''}" 
              on:click={() => captureQuality = 'medium'}
              title="Lossless 60 FPS"
            >
              Medium
            </button>
            <button 
              class="quality-btn {captureQuality === 'high' ? 'active' : ''}" 
              on:click={() => captureQuality = 'high'}
              title="Maximum lossless quality (60 FPS)"
            >
              High
            </button>
          </div>
          
          <div class="quality-help">
            {#if captureQuality === 'low'}
              Lossless 30 FPS. Good balance of quality and file size.
            {:else if captureQuality === 'medium'}
              Lossless 60 FPS. Better for capturing motion and noise.
            {:else if captureQuality === 'high'}
              Maximum lossless quality (60 FPS). Best for Projection in large spaces such as clubs.
            {/if}
          </div>
        </div>
        <div class="capture-actions">
          <button class="primary-btn" on:click={startCapture}>Start Capture</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .video-recorder {
    width: 100%;
  }
  
  .capture-controls {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: center;
  }
  
  .capture-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 5px;
    transition: opacity 0.2s;
  }
  
  .capture-btn:hover {
    opacity: 0.8;
  }
  
  .recording-status {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .progress-bar {
    flex-grow: 1;
    height: 3px;
    background-color: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    transition: width 0.3s ease;
  }
  
  .cancel-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
    transition: opacity 0.2s;
  }
  
  .cancel-btn:hover {
    opacity: 0.8;
  }
  
  .capture-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }
  
  .capture-popup-content {
    background-color: rgba(20, 20, 20, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px;
    width: 280px;
    color: white;
  }
  
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .popup-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  
  .close-btn:hover {
    color: white;
  }
  
  .capture-form {
    margin-bottom: 20px;
  }
  
  .capture-form label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .quality-label {
    margin-top: 12px;
  }
  
  .quality-selector {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  
  .quality-btn {
    flex: 1;
    padding: 6px 0;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .quality-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .quality-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .quality-help {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 12px;
    min-height: 36px;
  }
  
  .capture-form input {
    width: 100%;
    padding: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 14px;
  }
  
  .capture-form input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .capture-actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .primary-btn {
    padding: 8px 16px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .primary-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
</style> 