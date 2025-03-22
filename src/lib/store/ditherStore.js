import { writable } from 'svelte/store';

// Define default dither settings for different experiences
const defaultDitherSettings = {
  home: {
    enabled: true,
    patternScale: 3.0,
    thresholdOffset: -0.05,
    noiseIntensity: 0.15,
    colorReduction: 5.0
  },
  flocking: {
    enabled: true,
    patternScale: 2.0,
    thresholdOffset: -0.05,
    noiseIntensity: 0.08, 
    colorReduction: 2.0
  }
};

// Create writable stores for each experience
export const homeDitherSettings = writable(defaultDitherSettings.home);
export const flockingDitherSettings = writable(defaultDitherSettings.flocking);

// Create a combined store for current dither settings (to be set based on active experience)
export const currentDitherSettings = writable({...defaultDitherSettings.home});

// Helper function to get default settings for an experience
export function getDefaultDitherSettings(experienceId) {
  return defaultDitherSettings[experienceId] || defaultDitherSettings.home;
}

// Helper function to reset dither settings to default for an experience
export function resetDitherSettings(experienceId) {
  const defaults = getDefaultDitherSettings(experienceId);
  
  if (experienceId === 'home') {
    homeDitherSettings.set({...defaults});
  } else if (experienceId === 'flocking') {
    flockingDitherSettings.set({...defaults});
  }
  
  // Update current settings if needed
  currentDitherSettings.set({...defaults});
  
  return {...defaults};
}

// Helper function to update current dither settings based on experience ID
export function setCurrentDitherSettings(experienceId) {
  if (experienceId === 'home') {
    let settings;
    homeDitherSettings.subscribe(value => {
      settings = value;
    })();
    currentDitherSettings.set({...settings});
    return settings;
  } else if (experienceId === 'flocking') {
    let settings;
    flockingDitherSettings.subscribe(value => {
      settings = value;
    })();
    currentDitherSettings.set({...settings});
    return settings;
  } else {
    // Fallback to home settings
    return setCurrentDitherSettings('home');
  }
} 