<script>
	import './styles.css';

	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { webVitals } from '$lib/vitals';

	import { onMount } from 'svelte';
	import { screenType, isIframe, screenSize } from '$lib/store/store';
	import { getDeviceType, getScreenSize } from '$lib/functions/utils';

	export let data;
	let Geometry;

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

	onMount(async () => {
		// webgl
		// const module = await import('$lib/graphics-webgl/webgl.svelte');
		const module = await import('$lib/graphics-webgpu/main.svelte');
		Geometry = module.default;

		handleScreen();
		window.addEventListener('resize', () => handleScreen());

		return () => {
			window.removeEventListener('resize', () => handleScreen());
		};
	});
</script>

<svelte:head>
	<title>Der logische Aufbau der Web</title>
	<meta name="description" content="" />
	<meta name="keywords" content="" />
	<meta name="author" content="AUFBAU" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- <link rel="preload" href="/aufbau.svg" as="image" type="image/svg+xml" crossorigin="anonymous" /> -->

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
</svelte:head>

{#if Geometry}
	<svelte:component this={Geometry} />
{:else}
	<div class="loading">loading.</div>
{/if}

<div class="app">
	<main>
		<slot />
	</main>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100dvh;
		max-height: 100vh;
		width: 100%;
		overflow: hidden;
	}

	.loading {
		position: absolute;
		font-style: italic;
		font-family: serif;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 10px;
		font-size: 12px;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		width: 100%;
		height: 100%;
	}
</style>
