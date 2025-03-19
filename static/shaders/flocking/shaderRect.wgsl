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
    // Create rhythmic glitch pattern over time
    let glitchPhase = floor(t * 1.7); // Control frequency of glitches
    let glitchSeed = hash(glitchPhase);
    
    // Only apply glitch sometimes (30% of the time)
    if (glitchSeed > 0.7) {
        // Create horizontal line glitches
        let lineCount = 15.0;
        let lineIndex = floor(uv.y * lineCount);
        let lineSeed = hash(lineIndex + glitchPhase * 13.5);
        
        // Apply horizontal offset to certain lines
        if (lineSeed > 0.75) {
            // Calculate glitch intensity and direction
            let glitchAmount = (lineSeed - 0.75) * 4.0 * 0.1; // Max 10% shift
            
            // Apply horizontal shift
            return vec2f(uv.x + glitchAmount * sin(t * 10.0 + uv.y * 5.0), uv.y);
        }
    }
    
    return uv;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let rectIndex = input.rectIndex;
    let rect = rectangles[rectIndex];
    let params = customData[rectIndex].params;
    let uv = input.uv;
    
    // Apply glitch effect to UV coordinates
    let glitchedUV = glitchUV(uv, time);
    
    // Calculate base speed for time-based effects
    let baseSpeed = 0.8; // Medium-fast for good dynamic effects
    let slowTime = time * baseSpeed;
    
    // Create automatic zoom pattern that cycles between zooming in and out
    // Using a triangular wave function for zoom
    let zoomCycleTime = 15.0; // Full zoom cycle in seconds
    let zoomPhase = fract(slowTime / zoomCycleTime);
    let triangleWave = abs(2.0 * zoomPhase - 1.0); // 0->1->0 triangular pattern
    
    // Create a fluctuating zoom level that gets very small during "diving in" phases
    let minZoom = 0.003; // Very deep zoom when fully zoomed in
    let maxZoom = 0.3;   // Wider view when zoomed out
    let currentZoom = mix(minZoom, maxZoom, triangleWave);
    
    // Add some zoom jitter during transitions for a more glitchy feel
    let jitterAmount = 0.02 * (1.0 - abs(2.0 * zoomPhase - 1.0)); // Max jitter at middle of transition
    let jitter = hash(floor(slowTime * 20.0)) * jitterAmount;
    let zoom = currentZoom + jitter;
    
    // Create dynamic position that moves through interesting regions
    // Use Lissajous patterns for smooth but complex movement
    let lissajousX = sin(slowTime * 0.42) * cos(slowTime * 0.27) * 0.2;
    let lissajousY = sin(slowTime * 0.38) * cos(slowTime * 0.23) * 0.2;
    
    // Calculate aspect ratio for Julia set
    let aspect = rect.size.x / rect.size.y;
    
    // Apply occasional position jumps for "teleportation" effects
    let jumpTime = floor(slowTime * 0.8); // Control frequency of jumps
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
    
    // Map UV to dynamic zoomed complex coordinates
    let z = vec2f(
        (glitchedUV.x - 0.5 + offsetX) * zoom * 2.0 * aspect,
        (glitchedUV.y - 0.5 + offsetY) * zoom * 2.0
    );
    
    // Use interesting C values that change over time
    // Set values within ranges known to produce good Julia sets
    let cVal = hash2D(vec2f(floor(slowTime * 0.2), 0.0));
    var c = vec2f(0.0, 0.0); // Initialize with default value
    
    if (cVal < 0.25) {
        // First parameter set: Classic
        c = vec2f(-0.75 + sin(slowTime * 0.05) * 0.05, 0.13 + cos(slowTime * 0.06) * 0.05);
    } else if (cVal < 0.5) {
        // Second parameter set: Dendrite-like
        c = vec2f(0.285 + sin(slowTime * 0.07) * 0.025, 0.01 + cos(slowTime * 0.08) * 0.025);
    } else if (cVal < 0.75) {
        // Third parameter set: Rabbit-like
        c = vec2f(-0.123 + sin(slowTime * 0.06) * 0.03, 0.745 + cos(slowTime * 0.07) * 0.03);
    } else {
        // Fourth parameter set: Dragon-like
        c = vec2f(0.36 + sin(slowTime * 0.08) * 0.04, 0.1 + cos(slowTime * 0.09) * 0.04);
    }
    
    // Occasional rapid variation in c parameter for dramatic changes
    if (hash(floor(slowTime * 0.5)) > 0.9) {
        c = vec2f(
            c.x + sin(slowTime * 5.0) * 0.05,
            c.y + cos(slowTime * 5.0) * 0.05
        );
    }
    
    // Calculate Julia set with dynamic iteration count
    // More iterations when zoomed in deeper
    let baseIterations = 400.0;
    let iterations = baseIterations + (baseIterations * 2.0 * (1.0 - triangleWave));
    let value = julia(z, c, iterations);
    
    // Apply post-processing to create more dramatic effects
    // Enhance edges and boundaries for better visibility
    var enhancedValue = pow(value, 0.8); // Adjust gamma for more visible detail
    
    // Create occasional "inversion" effect
    if (hash(floor(slowTime * 0.7)) > 0.85) {
        enhancedValue = 1.0 - enhancedValue;
    }
    
    // Convert to vibrant colors
    let baseColor = createMultiColorFractal(enhancedValue, time, params);
    
    // Add subtle scan lines
    let scanLine = sin(glitchedUV.y * 150.0 + time * 3.0) * 0.02 + 0.98;
    
    // Return final color with maximum brightness
    return vec4f(baseColor * 1.5 * scanLine, 1.0);
} 