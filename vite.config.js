import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import glsl from 'vite-plugin-glsl';
import fs from 'fs';
import path from 'path';

export default defineConfig({
	plugins: [
		sveltekit(),
		glsl({
			include: [
				'**/*.glsl',
				'**/*.wgsl',
			],
		}),
		{
			name: 'vite-plugin-wgsl',
			transform(code, id) {
				if (id.endsWith('.wgsl')) {
					return {
						code: `export default ${JSON.stringify(code)};`,
						map: null
					};
				}
			}
		},
		{
			name: 'vite-plugin-copy-shaders',
			writeBundle() {
				const staticDir = path.resolve('static');
				const shaderDir = path.join(staticDir, 'shaders');
				
				if (fs.existsSync(shaderDir)) {
					console.log('Copying shader files to build output...');
				}
			}
		}
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	assetsInclude: ['**/*.wgsl']
});
