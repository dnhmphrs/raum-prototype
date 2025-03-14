/**
 * MemoryManager.js
 * Utility for managing memory and WebGPU resources across all experiences
 */

// Track all created WebGPU resources for debugging
const resourceRegistry = {
    buffers: new Set(),
    textures: new Set(),
    bindGroups: new Set(),
    pipelines: new Set(),
    shaderModules: new Set(),
    experiences: new Set(),
    others: new Set()
};

// Statistics for memory usage
let stats = {
    createdResources: 0,
    destroyedResources: 0,
    activeResources: 0,
    lastCleanupTime: Date.now()
};

/**
 * Register a WebGPU resource for tracking
 * @param {Object} resource - The WebGPU resource to track
 * @param {string} type - The type of resource (buffer, texture, etc.)
 */
export function registerResource(resource, type = 'others') {
    if (!resource) return;
    
    // Add to appropriate registry
    if (resourceRegistry[type]) {
        resourceRegistry[type].add(resource);
    } else {
        resourceRegistry.others.add(resource);
    }
    
    stats.createdResources++;
    stats.activeResources++;
}

/**
 * Unregister a WebGPU resource from tracking
 * @param {Object} resource - The WebGPU resource to untrack
 * @param {string} type - The type of resource (buffer, texture, etc.)
 */
export function unregisterResource(resource, type = 'others') {
    if (!resource) return;
    
    // Remove from appropriate registry
    if (resourceRegistry[type] && resourceRegistry[type].has(resource)) {
        resourceRegistry[type].delete(resource);
        stats.destroyedResources++;
        stats.activeResources--;
    }
}

/**
 * Clean up a WebGPU resource properly
 * @param {Object} resource - The WebGPU resource to clean up
 * @param {string} type - The type of resource (buffer, texture, etc.)
 */
export function cleanupResource(resource, type = 'others') {
    if (!resource) return;
    
    try {
        // Unregister the resource
        unregisterResource(resource, type);
        
        // Return null to help with garbage collection
        return null;
    } catch (error) {
        console.error(`Error cleaning up ${type} resource:`, error);
        return null;
    }
}

/**
 * Get memory usage statistics
 * @returns {Object} Memory usage statistics
 */
export function getMemoryStats() {
    // Add browser memory info if available
    let browserMemory = {};
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        browserMemory = {
            totalJSHeapSize: formatBytes(memory.totalJSHeapSize),
            usedJSHeapSize: formatBytes(memory.usedJSHeapSize),
            jsHeapSizeLimit: formatBytes(memory.jsHeapSizeLimit)
        };
    }
    
    return {
        ...stats,
        resourceCounts: {
            buffers: resourceRegistry.buffers.size,
            textures: resourceRegistry.textures.size,
            bindGroups: resourceRegistry.bindGroups.size,
            pipelines: resourceRegistry.pipelines.size,
            shaderModules: resourceRegistry.shaderModules.size,
            experiences: resourceRegistry.experiences.size,
            others: resourceRegistry.others.size,
            total: stats.activeResources
        },
        browserMemory
    };
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - The number of bytes
 * @returns {string} Human-readable string
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Force garbage collection if available
 */
export function forceGarbageCollection() {
    stats.lastCleanupTime = Date.now();
    
    // Log current memory stats
    console.log("Memory stats before GC:", getMemoryStats());
    
    // Force garbage collection if available
    if (typeof window !== 'undefined' && window.gc) {
        window.gc();
    }
    
    // Log memory stats after GC attempt
    setTimeout(() => {
        console.log("Memory stats after GC:", getMemoryStats());
    }, 100);
}

export default {
    registerResource,
    unregisterResource,
    cleanupResource,
    getMemoryStats,
    formatBytes,
    forceGarbageCollection
}; 