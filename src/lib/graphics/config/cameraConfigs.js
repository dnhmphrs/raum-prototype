// Camera configurations for all experiences
export const cameraConfigs = {
  Flocking: {
    position: { x: 0, y: 2000, z: 4000 },
    fov: 40 * (Math.PI / 180),
    baseDistance: 4000.0  // Large distance for bird flocking view
  },
  Cube: {
    position: { x: 0, y: 0, z: 5 },
    fov: 60 * (Math.PI / 180),
    baseDistance: 1000.0    // Close for cube inspection
  },
  NeuralNet: {
    position: { x: 0, y: 350, z: 550 },
    fov: 45 * (Math.PI / 180),
    baseDistance: 75900.0    // Medium distance for network visualization
  },
  Poincare: {
    position: { x: 0, y: 0, z: 10 },
    fov: 50 * (Math.PI / 180),
    baseDistance: 1000.0    // Medium-close for disk view
  },
  Lorentz: {
    position: { x: 0, y: 0, z: 100 },
    fov: 45 * (Math.PI / 180),
    baseDistance: 100.0  // Distance for Lorentz attractor
  },
  Riemann: {
    position: { x: 0, y: -4, z: 4 },
    fov: 45 * (Math.PI / 180),
    baseDistance: 3.0  // Close distance for surface detail viewing
  }
};

// Default camera config
export const defaultCameraConfig = {
  position: { x: 0, y: 0, z: 10 },
  fov: 45 * (Math.PI / 180),
  baseDistance: 20.0
};

// Get camera config by experience name
export function getCameraConfig(experienceName) {
  return cameraConfigs[experienceName] || defaultCameraConfig;
} 