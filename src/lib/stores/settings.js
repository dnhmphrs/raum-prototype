import { writable } from 'svelte/store';

// Create a writable store with default settings
export const settings = writable({
  showPredatorView: false, // Default to not showing the predator view
  // Add any other settings you might need here
}); 