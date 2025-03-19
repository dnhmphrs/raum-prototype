// shaderRect.wgsl - Simplified to focus only on Julia set

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

// Function to compute julia set
fn julia(z: vec2f, c: vec2f, maxIterations: f32) -> f32 {
    var z_value = z;
    var n = 0.0;
    
    for (var i = 0.0; i < maxIterations; i += 1.0) {
        // z = z^2 + c
        z_value = vec2f(
            z_value.x * z_value.x - z_value.y * z_value.y,
            2.0 * z_value.x * z_value.y
        ) + c;
        
        if (dot(z_value, z_value) > 1.0) {
            n = i;
            break;
        }
    }
    
    // Smooth coloring formula
    if (n < maxIterations) {
        // Calculate fractional iteration count for smooth coloring
        let log_zn = log(dot(z_value, z_value)) / 2.0;
        let nu = log(log_zn / log(2.0)) / log(2.0);
        n = n + 1.0 - nu;
    }
    
    return n / maxIterations;
}

// Fast hash function for glitch effects
fn hash(p: f32) -> f32 {
    return fract(sin(p * 123.456) * 43758.5453);
}

// Hash function for 2D input
fn hash2D(p: vec2f) -> f32 {
    return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

// Enhanced multi-color fractal coloring
fn createMultiColorFractal(value: f32, t: f32, params: vec4f) -> vec3f {
    // Create 4 color palette with vibrant colors
    let color1 = vec3f(1.0, 0.1, 0.3); // Bright red
    let color2 = vec3f(0.2, 0.4, 1.0); // Bright blue
    let color3 = vec3f(1.0, 0.7, 0.0); // Bright gold
    let color4 = vec3f(0.0, 1.0, 0.7); // Bright turquoise
    
    // Exponential time mapping for non-linear transitions
    let expTime = exp(sin(t * 0.2)) * 0.5;
    
    // Create a smooth interpolation between colors with wider bands
    let t1 = fract(expTime * 0.67 + value * 0.4);
    let t2 = fract(expTime * 0.67 + value * 0.4 + 0.25);
    let t3 = fract(expTime * 0.67 + value * 0.4 + 0.5);
    let t4 = fract(expTime * 0.67 + value * 0.4 + 0.75);
    
    // Weight the 4 colors based on value
    let w1 = smoothstep(0.0, 0.5, t1) * (1.0 - smoothstep(0.5, 1.0, t1));
    let w2 = smoothstep(0.0, 0.5, t2) * (1.0 - smoothstep(0.5, 1.0, t2));
    let w3 = smoothstep(0.0, 0.5, t3) * (1.0 - smoothstep(0.5, 1.0, t3));
    let w4 = smoothstep(0.0, 0.5, t4) * (1.0 - smoothstep(0.5, 1.0, t4));
    
    // Normalize weights
    let totalWeight = w1 + w2 + w3 + w4;
    let nw1 = w1 / totalWeight;
    let nw2 = w2 / totalWeight;
    let nw3 = w3 / totalWeight;
    let nw4 = w4 / totalWeight;
    
    // Blend the colors based on weights
    return (color1 * nw1 + color2 * nw2 + color3 * nw3 + color4 * nw4) * 1.5; // Increased brightness
}

// Function to create a glitch effect on UV coordinates
fn glitchUV(uv: vec2f, t: f32) -> vec2f {
    // Create rhythmic glitch pattern over time - SLOWED DOWN
    let glitchPhase = floor(t * 0.4); // Reduced from 1.7 to 0.4 - much slower glitches
    let glitchSeed = hash(glitchPhase);
    
    // Only apply glitch sometimes (30% of the time)
    if (glitchSeed > 0.7) {
        // Create horizontal line glitches
        let lineCount = 15.0;
        let lineIndex = floor(uv.y * lineCount);
        let lineSeed = hash(lineIndex + glitchPhase * 6.5); // Reduced from 13.5 to 6.5
        
        // Apply horizontal offset to certain lines
        if (lineSeed > 0.75) {
            // Calculate glitch intensity and direction
            let glitchAmount = (lineSeed - 0.75) * 4.0 * 0.1; // Max 10% shift
            
            // Apply horizontal shift - SLOWED DOWN
            return vec2f(uv.x + glitchAmount * sin(t * 2.5 + uv.y * 2.0), uv.y); // Reduced from 10.0 to 2.5
        }
    }
    
    return uv;
}

// Apply post-processing to create more dramatic effects
// Use logarithmic function to create discrete banding
fn applyDiscreteBanding(value: f32, bands: f32, t: f32) -> f32 {
    // Apply logarithmic transform to create more distinct bands
    let logValue = log(1.0 + value * 10.0) / log(11.0); // Normalized log transform
    
    // Create time-based band shifting - SLOWED DOWN
    let shiftedValue = logValue + sin(t * 0.05) * 0.1; // Reduced from 0.3 to 0.05
    
    // Apply discrete banding with time-varying band count - SLOWED DOWN
    let dynamicBands = bands * (0.8 + sin(t * 0.03) * 0.2); // Reduced from 0.17 to 0.03
    return floor(shiftedValue * dynamicBands) / dynamicBands;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let rectIndex = input.rectIndex;
    let rect = rectangles[rectIndex];
    let params = customData[rectIndex].params;
    let uv = input.uv;
    
    // Apply glitch effect to UV coordinates
    let glitchedUV = glitchUV(uv, time);
    
    // Calculate base speed for time-based effects - SLOWED DOWN
    let baseSpeed = 0.2; // Reduced from 0.8 to 0.2 - much slower overall pace
    let slowTime = time * baseSpeed;
    
    // Create automatic zoom pattern that cycles between zooming in and out - SLOWED DOWN
    let zoomCycleTime = 40.0; // Increased from 15 to 40 seconds - slower zoom cycle
    let zoomPhase = fract(slowTime / zoomCycleTime);
    let triangleWave = abs(2.0 * zoomPhase - 1.0); // 0->1->0 triangular pattern
    
    // Create a fluctuating zoom level that gets very small during "diving in" phases
    let minZoom = 0.003; // Very deep zoom when fully zoomed in
    let maxZoom = 0.3;   // Wider view when zoomed out
    let currentZoom = mix(minZoom, maxZoom, triangleWave);
    
    // Add some zoom jitter during transitions for a more glitchy feel - SLOWED DOWN
    let jitterAmount = 0.02 * (1.0 - abs(2.0 * zoomPhase - 1.0)); // Max jitter at middle of transition
    let jitter = hash(floor(slowTime * 5.0)) * jitterAmount; // Reduced from 20.0 to 5.0
    let zoom = currentZoom + jitter;
    
    // Create dynamic position that moves through interesting regions - SLOWED DOWN
    // Use Lissajous patterns for smooth but complex movement
    let lissajousX = sin(slowTime * 0.12) * cos(slowTime * 0.09) * 0.2; // Reduced from 0.42/0.27 to 0.12/0.09
    let lissajousY = sin(slowTime * 0.08) * cos(slowTime * 0.07) * 0.2; // Reduced from 0.38/0.23 to 0.08/0.07
    
    // Calculate aspect ratio for Julia set
    let aspect = rect.size.x / rect.size.y;
    
    // Apply occasional position jumps for "teleportation" effects - SLOWED DOWN
    let jumpTime = floor(slowTime * 0.15); // Reduced from 0.8 to 0.15 - much less frequent jumps
    let jumpSeed = hash(jumpTime);
    
    // Jump to different parts of the fractal occasionally (20% of the time)
    var offsetX = lissajousX;
    var offsetY = lissajousY;
    if (jumpSeed > 0.8) {
        // Create sudden jumps to hand-picked interesting locations
        let jumpId = floor(jumpSeed * 4.0); // Choose from 4 destinations
        
        if (jumpId < 1.0) {
            // Jump to first special location
            offsetX = 0.3;
            offsetY = -0.2;
        } else if (jumpId < 2.0) {
            // Jump to second special location
            offsetX = -0.4;
            offsetY = 0.1;
        } else if (jumpId < 3.0) {
            // Jump to third special location
            offsetX = 0.1;
            offsetY = 0.3;
        } else {
            // Jump to fourth special location
            offsetX = -0.2;
            offsetY = -0.3;
        }
    }
    
    // Add rapid small-scale oscillation to position for more variation - SLOWED DOWN
    let rapidOscX = sin(slowTime * 0.7) * 0.02; // Reduced from 2.5 to 0.7
    let rapidOscY = cos(slowTime * 0.8) * 0.02; // Reduced from 2.7 to 0.8
    
    // Map UV to dynamic zoomed complex coordinates
    let z = vec2f(
        (glitchedUV.x - 0.5 + offsetX + rapidOscX) * zoom * 2.0 * aspect,
        (glitchedUV.y - 0.5 + offsetY + rapidOscY) * zoom * 2.0
    );
    
    // === JULIA SET VARIATION SPEED - INCREASED ===
    // Switch between parameter sets more frequently
    let cVal = hash2D(vec2f(floor(slowTime * 0.3), 0.0)); // INCREASED from 0.1 to 0.3 - more frequent switching
    var c = vec2f(0.0, 0.0); // Initialize with default value
    
    // Create faster changing Julia set parameters - INCREASED SPEED
    let tMod = slowTime * 0.4; // INCREASED from 0.15 to 0.4 - faster base parameter modulation
    
    if (cVal < 0.25) {
        // First parameter set: Classic with more movement - INCREASED SPEED
        c = vec2f(-0.75 + sin(tMod * 0.2) * 0.12, 0.13 + cos(tMod * 0.22) * 0.12); // INCREASED from 0.07/0.08 to 0.2/0.22
    } else if (cVal < 0.5) {
        // Second parameter set: Dendrite-like with more movement - INCREASED SPEED
        c = vec2f(0.285 + sin(tMod * 0.18) * 0.06, 0.01 + cos(tMod * 0.19) * 0.06); // INCREASED from 0.06/0.07 to 0.18/0.19
    } else if (cVal < 0.75) {
        // Third parameter set: Rabbit-like with more movement - INCREASED SPEED
        c = vec2f(-0.123 + sin(tMod * 0.17) * 0.07, 0.745 + cos(tMod * 0.19) * 0.07); // INCREASED from 0.05/0.06 to 0.17/0.19
    } else {
        // Fourth parameter set: Dragon-like with more movement - INCREASED SPEED
        c = vec2f(0.36 + sin(tMod * 0.21) * 0.09, 0.1 + cos(tMod * 0.23) * 0.09); // INCREASED from 0.08/0.07 to 0.21/0.23
    }
    
    // Add high-frequency wiggle to the parameters - INCREASED SPEED
    let wiggleX = sin(slowTime * 2.4) * 0.015; // INCREASED from 0.8 to 2.4 and amplitude from 0.01 to 0.015
    let wiggleY = cos(slowTime * 2.6) * 0.015; // INCREASED from 0.9 to 2.6 and amplitude from 0.01 to 0.015
    c += vec2f(wiggleX, wiggleY);
    
    // Occasional rapid variation in c parameter for dramatic changes - INCREASED FREQUENCY
    if (hash(floor(slowTime * 0.5)) > 0.75) { // INCREASED from 0.25 to 0.5 and threshold from 0.8 to 0.75
        c = vec2f(
            c.x + sin(slowTime * 3.5) * 0.12, // INCREASED from 2.0 to 3.5 and amplitude from 0.1 to 0.12
            c.y + cos(slowTime * 3.7) * 0.12  // INCREASED from 2.2 to 3.7 and amplitude from 0.1 to 0.12
        );
    }
    // === END JULIA SET VARIATION SPEED ADJUSTMENTS ===
    
    // Calculate Julia set with dynamic iteration count
    // More iterations when zoomed in deeper
    let baseIterations = 400.0;
    let iterations = baseIterations + (baseIterations * 2.0 * (1.0 - triangleWave));
    let value = julia(z, c, iterations);
    
    // Apply post-processing to create more dramatic effects
    // Enhance edges and boundaries for better visibility
    var enhancedValue = pow(value, 0.8); // Adjust gamma for more visible detail
    
    // Apply discrete banding with 8-12 bands
    let bandCount = 10.0;
    enhancedValue = applyDiscreteBanding(enhancedValue, bandCount, slowTime);
    
    // Create occasional "inversion" effect
    if (hash(floor(slowTime * 0.2)) > 0.75) {
        enhancedValue = 1.0 - enhancedValue;
    }
    
    // Convert to vibrant colors - UNCHANGED slow color cycle
    let baseColor = createMultiColorFractal(enhancedValue, time * 0.25, params);
    
    // Add subtle scan lines - UNCHANGED slow scan lines
    let scanLine = sin(glitchedUV.y * 150.0 + time * 0.8) * 0.02 + 0.98;
    
    // Return final color with maximum brightness
    return vec4f(baseColor * 1.5 * scanLine, 1.0);
} 