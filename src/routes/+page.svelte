<!-- <script>
</script>

<img src="/aufbau.svg" alt="aufbau logo" width="76" height="20" />

<style>
	img {
		object-fit: contain;
	}
</style> -->

<script>
  import { onMount } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import LorentzExperience from '$lib/graphics/experiences/Lorentz/LorentzExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  
  const experiences = [
    {
      id: 'flocking',
      name: 'FLOCKING',
      description: 'Bird flocking behavior simulation using WebGPU',
      thumbnail: '/placeholder.png',
      color: '#00ff00'
    },
    {
      id: 'cube',
      name: 'CUBE',
      description: 'Interactive 3D cube visualization',
      thumbnail: '/placeholder.png',
      color: '#ff0000'
    },
    {
      id: 'neuralnet',
      name: 'NEURAL NET',
      description: 'Visual neural network simulation',
      thumbnail: '/placeholder.png',
      color: '#0000ff'
    },
    {
      id: 'poincare',
      name: 'POINCARE',
      description: 'Hyperbolic geometry visualization',
      thumbnail: '/placeholder.png',
      color: '#ffff00'
    },
    {
      id: 'lorentz',
      name: 'LORENTZ',
      description: 'Lorentz attractor visualization',
      thumbnail: '/placeholder.png',
      color: '#00ffff'
    }
  ];
  
  let selectedExp = null;
  let mounted = false;
  let canvas;
  let engine;
  let backgroundLoaded = false;
  
  onMount(async () => {
    mounted = true;
    
    // Terminal typing effect
    const terminalText = document.querySelector('.terminal-text');
    if (terminalText) {
      const text = terminalText.textContent;
      terminalText.textContent = '';
      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          terminalText.textContent += text.charAt(i);
          i++;
          setTimeout(typeWriter, Math.random() * 50 + 20);
        }
      };
      typeWriter();
    }
    
    // No WebGPU background on home page
    backgroundLoaded = true;
  });
</script>

<svelte:head>
  <title>WebGPU Experiences</title>
  <meta name="description" content="A collection of interactive WebGPU experiences" />
</svelte:head>

<div class="background-canvas">
  <canvas bind:this={canvas}></canvas>
</div>

<div class="container {mounted ? 'loaded' : ''}">
  <header>
    <div class="terminal">
      <div class="terminal-header">
        <span class="terminal-title">webgpu_experiences.exe</span>
        <div class="terminal-buttons">
          <span class="terminal-button"></span>
          <span class="terminal-button"></span>
          <span class="terminal-button"></span>
        </div>
      </div>
      <div class="terminal-body">
        <p class="terminal-text">
          > INITIALIZING WEBGPU EXPERIENCES...<br>
          > LOADING MODULES...<br>
          > SYSTEM READY.
        </p>
      </div>
    </div>
  </header>

  <main>
    <div class="experience-grid">
      {#each experiences as exp, i}
        <div 
          class="experience-item" 
          on:mouseenter={() => selectedExp = exp}
          on:mouseleave={() => selectedExp = null}
          style="--delay: {i * 150}ms; --accent: {exp.color};"
        >
          <a href="/experience/{exp.id}" class="experience-link">
            <span class="experience-index">[{i + 1}]</span>
            <span class="experience-name">{exp.name}</span>
            <span class="experience-arrow">→</span>
          </a>
        </div>
      {/each}
    </div>
    
    <div class="preview-panel">
      {#if selectedExp}
        <div class="preview-content" style="--accent: {selectedExp.color};">
          <div class="preview-image">
            <img src={selectedExp.thumbnail} alt={selectedExp.name} />
            <div class="scan-line"></div>
          </div>
          <div class="preview-info">
            <h2>{selectedExp.name}</h2>
            <p>{selectedExp.description}</p>
          </div>
        </div>
      {:else}
        <div class="preview-placeholder">
          <div class="placeholder-text">SELECT AN EXPERIENCE</div>
        </div>
      {/if}
    </div>
  </main>
  
  <footer>
    <div class="footer-text">[2025] AUFBAU WEBGPU EXPERIMENTS // SYSTEM V1.0</div>
  </footer>
</div>

<style>
  @font-face {
    font-family: 'VT323';
    src: url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
  }
  
  :global(body) {
    background-color: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  
  .loaded {
    opacity: 1;
  }
  
  .terminal {
    border: 1px solid #00ff00;
    margin-bottom: 2rem;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
  }
  
  .terminal-header {
    background-color: #000;
    border-bottom: 1px solid #00ff00;
    padding: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .terminal-title {
    color: #00ff00;
    font-weight: bold;
  }
  
  .terminal-buttons {
    display: flex;
    gap: 5px;
  }
  
  .terminal-button {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #333;
    border: 1px solid #00ff00;
  }
  
  .terminal-body {
    padding: 1rem;
    background-color: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
  }
  
  .terminal-text {
    margin: 0;
    line-height: 1.5;
  }
  
  main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  
  .experience-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .experience-item {
    border: 1px solid var(--accent, #00ff00);
    background-color: rgba(0, 0, 0, 0.8);
    transition: all 0.3s ease;
    animation: fadeIn 0.5s ease forwards;
    animation-delay: var(--delay);
    opacity: 0;
  }
  
  .experience-item:hover {
    background-color: rgba(0, 0, 0, 0.9);
    transform: translateX(5px);
    box-shadow: -5px 0 0 var(--accent, #00ff00);
  }
  
  .experience-link {
    display: flex;
    padding: 1rem;
    text-decoration: none;
    color: var(--accent, #00ff00);
    justify-content: space-between;
    align-items: center;
  }
  
  .experience-index {
    font-size: 0.8rem;
    opacity: 0.7;
  }
  
  .experience-name {
    font-weight: bold;
    letter-spacing: 2px;
  }
  
  .experience-arrow {
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  
  .experience-item:hover .experience-arrow {
    opacity: 1;
    transform: translateX(5px);
  }
  
  .preview-panel {
    border: 1px solid #00ff00;
    height: 100%;
    min-height: 300px;
    position: relative;
    overflow: hidden;
  }
  
  .preview-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .preview-image {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  .preview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(0.5) sepia(0.2) hue-rotate(90deg);
    opacity: 0.8;
  }
  
  .scan-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: rgba(0, 255, 0, 0.5);
    animation: scanLine 2s linear infinite;
  }
  
  .preview-info {
    padding: 1rem;
    background-color: #000;
    border-top: 1px solid var(--accent, #00ff00);
  }
  
  .preview-info h2 {
    margin: 0 0 0.5rem 0;
    color: var(--accent, #00ff00);
  }
  
  .preview-info p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.8;
  }
  
  .preview-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    background-color: #000;
    border: 1px dashed #00ff00;
  }
  
  .placeholder-text {
    color: #00ff00;
    opacity: 0.5;
    font-size: 1.2rem;
    letter-spacing: 2px;
    animation: blink 1s step-end infinite;
  }
  
  footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.7;
    letter-spacing: 1px;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scanLine {
    0% {
      top: 0%;
    }
    100% {
      top: 100%;
    }
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  
  @media (max-width: 768px) {
    main {
      grid-template-columns: 1fr;
    }
    
    .preview-panel {
      min-height: 200px;
    }
  }
  
  /* Add styles for the background canvas */
  .background-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    opacity: 0.3; /* Subtle background */
  }
  
  .background-canvas canvas {
    width: 100%;
    height: 100%;
  }
</style>

