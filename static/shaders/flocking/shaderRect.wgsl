// shaderRect.wgsl - Edgy London vibe overlays for FlockingExperience

struct RectData {
    position: vec2f,
    size: vec2f,
    shaderType: f32,
    padding: vec3f,
};

struct CustomData {
    params: vec4f,
};

@group(0) @binding(0) var<storage, read> rectangles: array<RectData>;
@group(0) @binding(1) var<uniform> time: f32;
@group(0) @binding(2) var<uniform> viewport: vec2f;
@group(0) @binding(3) var<storage, read> customData: array<CustomData>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) @interpolate(flat) rectIndex: u32,
};

@vertex
fn vertex_main(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    // Each rectangle consists of 2 triangles (6 vertices)
    let vertexInRect = vertexIndex % 6u;
    let rectIndex = instanceIndex;
    
    // Get rectangle data
    let rect = rectangles[rectIndex];
    
    // Define the 6 vertices for a quad (2 triangles)
    var localPos: vec2f;
    
    switch vertexInRect {
        case 0u: { localPos = vec2f(0.0, 0.0); } // Bottom-left
        case 1u: { localPos = vec2f(1.0, 0.0); } // Bottom-right
        case 2u: { localPos = vec2f(0.0, 1.0); } // Top-left
        case 3u: { localPos = vec2f(1.0, 0.0); } // Bottom-right
        case 4u: { localPos = vec2f(1.0, 1.0); } // Top-right
        case 5u: { localPos = vec2f(0.0, 1.0); } // Top-left
        default: { localPos = vec2f(0.0, 0.0); } // Fallback
    }
    
    // Transform to rectangle position and size
    let worldPos = rect.position + localPos * rect.size;
    
    // Adjust to clip space (-1 to 1)
    let clipPos = worldPos * 2.0 - 1.0;
    // Y is flipped in clip space
    let adjustedClipPos = vec2f(clipPos.x, -clipPos.y);
    
    var output: VertexOutput;
    output.position = vec4f(adjustedClipPos, 0.0, 1.0);
    output.uv = localPos;
    output.rectIndex = rectIndex;
    
    return output;
}

// Hash function for procedural noise
fn hash21(p: vec2f) -> f32 {
    var n = dot(p, vec2f(127.1, 311.7));
    return fract(sin(n) * 43758.5453);
}

// Function to generate scanlines
fn scanlines(uv: vec2f, time: f32, intensity: f32) -> f32 {
    let lines = sin(uv.y * viewport.y * 0.5 - time * 2.0) * 0.5 + 0.5;
    return mix(1.0, lines, intensity);
}

// Function to generate glitch effect
fn glitchEffect(uv: vec2f, time: f32, params: vec4f) -> vec2f {
    let glitchAmount = params.x * 0.05; // Scaled down for subtlety
    
    // Time-based blocks for glitch
    let blockSize = 5.0 + params.y * 10.0;
    let blockPos = floor(uv.y * blockSize) + floor(time * 5.0 * params.z);
    
    // Generate random displacement
    let rand = hash21(vec2f(blockPos, floor(time * 4.0)));
    
    // Apply horizontal displacement only to certain blocks
    let displaced = vec2f(
        uv.x + (rand * 2.0 - 1.0) * glitchAmount * step(0.95, params.w),
        uv.y
    );
    
    return displaced;
}

// Function to generate noise pattern
fn noisePattern(uv: vec2f, time: f32, scale: f32) -> f32 {
    let noise = hash21(uv * scale + time * 0.1);
    return noise;
}

// Function to create a CRT-like grid pattern
fn crtGrid(uv: vec2f) -> f32 {
    let gridX = sin(uv.x * viewport.x * 0.25) * 0.5 + 0.5;
    let gridY = sin(uv.y * viewport.y * 0.25) * 0.5 + 0.5;
    return gridX * gridY;
}

// Function for static noise pattern
fn staticNoise(uv: vec2f, time: f32) -> f32 {
    return hash21(uv * 100.0 + vec2f(time * 10.0, time * 15.0)) * 0.15;
}

// Vignette effect with configurable intensity
fn vignette(uv: vec2f, intensity: f32) -> f32 {
    let center = vec2f(0.5, 0.5);
    let dist = distance(uv, center) * 2.0;
    return 1.0 - smoothstep(0.8, 1.8 * intensity, dist);
}

// Function to create trippy color cycling
fn trippyColors(time: f32, params: vec4f) -> vec3f {
    // Base color cycling
    let r = sin(time * 2.0 + params.x * 10.0) * 0.5 + 0.5;
    let g = sin(time * 2.5 + params.y * 10.0) * 0.5 + 0.5;
    let b = sin(time * 3.0 + params.z * 10.0) * 0.5 + 0.5;
    
    return vec3f(r, g, b);
}

// Function to create flashing behavior
fn flashEffect(time: f32, params: vec4f) -> f32 {
    // Fast flashing that varies with params
    let flashSpeed = 4.0 + params.x * 8.0; // 4-12 Hz flashing
    
    // Mix of different frequencies for unpredictable flashing
    let flash1 = step(0.5, sin(time * flashSpeed));
    let flash2 = step(0.6, sin(time * (flashSpeed * 0.7 + params.y * 5.0)));
    let flash3 = step(0.7, sin(time * (flashSpeed * 1.3 + params.z * 3.0)));
    
    // Combine different flash patterns
    let combinedFlash = flash1 * 0.7 + flash2 * 0.5 + flash3 * 0.3;
    
    // Ensure we don't go completely black too often
    return mix(0.4, 1.0, combinedFlash);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let rectIndex = input.rectIndex;
    let rect = rectangles[rectIndex];
    let params = customData[rectIndex].params;
    let uv = input.uv;
    
    // Use shader type to determine appearance
    let shaderType = u32(rect.shaderType);
    
    // Apply common glitch effect - more extreme
    let glitchAmount = params.x * 0.15; // Increased for more trippiness
    let glitchedUV = glitchEffect(uv, time, params);
    
    // Get flashing intensity for the rectangle
    let flashIntensity = flashEffect(time, params);
    
    // Base colors - more vibrant for tripped out feel
    var color: vec4f;
    
    // Shader variations - tripped out vibes
    switch shaderType {
        case 0u: {
            // Trippy color cycling with scanlines
            let scanlineIntensity = 0.2 + params.x * 0.3;
            let scan = scanlines(glitchedUV, time, scanlineIntensity);
            
            // Dynamic color cycling
            let baseColor = trippyColors(time, params);
            
            // Add intense noise texture
            let noise = noisePattern(glitchedUV, time, 100.0) * 0.1;
            
            color = vec4f(baseColor * scan + noise, 1.0);
        }
        
        case 1u: {
            // Intense, tinted display with static and scanlines
            let staticVal = staticNoise(glitchedUV, time * 2.0) * 0.3; // More static
            let scan = scanlines(glitchedUV, time * 1.5, 0.4); // More intense scanlines
            let vig = vignette(glitchedUV, 1.2);
            
            // High contrast colors
            color = vec4f(0.0, 0.5 + staticVal * 2.0, 0.8 + staticVal, 1.0) * scan * vig;
        }
        
        case 2u: {
            // Glitchy "terminal" look with rapidly changing blocks
            
            // Create a grid-like pattern for "text" - smaller cells for more detail
            let cellSize = 0.03 + params.y * 0.05;
            let cellX = floor(glitchedUV.x / cellSize);
            let cellY = floor(glitchedUV.y / cellSize);
            
            // Make cells change rapidly based on time
            let cellBrightness = step(0.65, hash21(vec2f(cellX, cellY) + time * 0.3));
            
            // Intense static behind the "text"
            let staticVal = staticNoise(uv, time * 3.0) * 0.15;
            
            // Rapidly changing colors
            let termColors = trippyColors(time * 0.5, params) * 0.5;
            
            // Combine effects
            color = vec4f(termColors + vec3f(staticVal + cellBrightness * 0.4), 1.0);
        }
        
        default: {
            // Default - intense cycling colors
            let cycleColors = trippyColors(time, params);
            let noise = staticNoise(glitchedUV, time) * 0.1;
            color = vec4f(cycleColors + noise, 1.0);
        }
    }
    
    // Apply flash effect globally - makes rectangles appear/disappear
    color = color * flashIntensity;
    
    // Ensure full opacity
    color.a = 1.0;
    
    return color;
} 