// We need to disable prerendering for WebGPU content
// as it requires browser APIs that aren't available during build
export const prerender = false;

// Enable SSR for better SEO
export const ssr = true;
