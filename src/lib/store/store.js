import { writable } from 'svelte/store';

export const userType = writable(null);
export const screenType = writable('desktop');
export const isIframe = writable(false);
export const darkMode = writable(false);

export const screenSize = writable({ width: 0, height: 0 });

// webgpu
export const mousePosition = writable(false);
export const viewportSize = writable(false);

// UI visibility state
export const showUI = writable(true);
