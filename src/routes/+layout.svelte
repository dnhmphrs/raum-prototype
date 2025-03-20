<script>
	import './styles.css';

	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { webVitals } from '$lib/vitals';

	import { onMount, onDestroy } from 'svelte';
	import { screenType, isIframe, screenSize, showUI } from '$lib/store/store';
	import { getDeviceType, getScreenSize } from '$lib/functions/utils';
	import MemoryStats from '$lib/components/MemoryStats.svelte';

	export let data;
	let Geometry;
	
	// Memory stats
	let showMemoryStats = true;

	// Function to toggle UI visibility
	function toggleUIVisibility() {
		showUI.update(value => !value);
	}

	$: if (browser && data?.analyticsId) {
		webVitals({
			path: $page.url.pathname,
			params: $page.params,
			analyticsId: data.analyticsId
		});
	}

	function handleScreen() {
		// screen size
		screenSize.set(getScreenSize());

		// device type
		screenType.set(getDeviceType());
		isIframe.set(window.location !== window.parent.location);
	}

	// Get the current path
	$: currentPath = $page.url.pathname;
	
	// Only load the main graphics on the flocking experience
	$: shouldLoadGraphics = currentPath === '/experience/flocking';

	onMount(async () => {
		if (!navigator.gpu) {
			alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
			return;
		}
		
		// // Only load graphics component when needed
		// if (shouldLoadGraphics) {
		// 	const module = await import('$lib/graphics/main.svelte');
		// 	Geometry = module.default;
		// }

		handleScreen();
		window.addEventListener('resize', () => handleScreen());

		return () => {
			window.removeEventListener('resize', () => handleScreen());
		};
	});
</script>

<svelte:head>
	<title>AUFBAU // WEBGPU</title>
	<meta name="description" content="" />
	<meta name="keywords" content="webgpu developer web developer 3d developer webgpu developer graphics developer website developer" />
	<meta name="author" content="AUFBAU" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- <link
		rel="preload"
		href="/fonts/NB-Architekt-Pro-Light.woff"
		as="font"
		type="font/woff"
		crossorigin="anonymous"
	/> -->

	<!-- <link
		rel="preload"
		href="/fonts/NB-Architekt-Pro-Bold.woff"
		as="font"
		type="font/woff"
		crossorigin="anonymous"
	/> -->
</svelte:head>

<div class="app">
	<main>
		<!-- UI Toggle Button -->
		<button 
			class="ui-toggle-button" 
			on:click={toggleUIVisibility} 
			class:hidden={!$showUI}
			aria-label={$showUI ? "Hide UI" : "Show UI"}
		>
			{$showUI ? "○" : "●"}
		</button>
		
		<slot />
	</main>
	
	{#if shouldLoadGraphics}
		<svelte:component this={Geometry} />
	{/if}
	
	<!-- Memory stats display -->
	{#if showMemoryStats && browser && $showUI}
		<MemoryStats />
	{/if}
</div>

<style>
	.app {
		width: 100%;
		height: 100%;
		position: relative;
	}
	
	.ui-toggle-button {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 1000;
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
		transition: opacity 0.3s ease, transform 0.3s ease;
		padding: 0;
	}
	
	.ui-toggle-button:hover {
		background-color: rgba(0, 0, 0, 0.9);
		transform: scale(1.1);
	}
	
	.ui-toggle-button.hidden {
		opacity: 0.2;
	}
	
	.ui-toggle-button.hidden:hover {
		opacity: 0.8;
	}
</style>
