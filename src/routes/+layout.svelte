<script>
	import './styles.css';

	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { webVitals } from '$lib/vitals';

	import { onMount } from 'svelte';
	import { screenType, isIframe, screenSize } from '$lib/store/store';
	import { getDeviceType, getScreenSize } from '$lib/functions/utils';
	import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';

	export let data;
	let Geometry;
	let canvas;
	let engine;
	let mounted = false;

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
		
		// Only load graphics component when needed
		if (shouldLoadGraphics) {
			const module = await import('$lib/graphics/main.svelte');
			Geometry = module.default;
		}

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
	<meta name="keywords" content="" />
	<meta name="author" content="AUFBAU" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<link rel="preload" href="https://raum-prototype-git-not-crowded-aufbau.vercel.app/notcrowded2.png" as="image" type="image/png" crossorigin="anonymous" />

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

	<!-- <link
	rel="preload"
	href="/fonts/Dahlia-Medium.woff2"
	as="font"
	type="font/woff2"
	crossorigin="anonymous"
/> -->

	<link rel="preload" href="/notcrowded2.png" as="image" type="image/png" fetchpriority="high" />
</svelte:head>

<div class="app">
	<main>
		<slot />
	</main>
	
	{#if shouldLoadGraphics}
		<svelte:component this={Geometry} />
	{/if}
</div>

<style>
	.app {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
