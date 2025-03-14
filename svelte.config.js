import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';

const config = {
	kit: {
		adapter: adapter({
			runtime: 'nodejs18.x'
		})
	},
	preprocess: vitePreprocess()
};

export default config;
