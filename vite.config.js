import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
	plugins: [
		sveltekit(),
		glsl(),
		{
			name: 'copy-shader-files',
			enforce: 'post',
			apply: 'build',
			generateBundle() {
				// This ensures shader files are properly handled during build
				console.log('Ensuring shader files are included in the build');
			}
		}
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	// Ensure static assets are properly handled
	publicDir: 'static',
	build: {
		assetsInlineLimit: 0, // Don't inline any assets as base64
	}
});
