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

// Function to compute julia set - SIMPLIFIED
fn julia(z: vec2f, c: vec2f, maxIterations: f32) -> f32 {
    var z_value = z;
    var n = 0.0;
    
    // Use the full iteration count provided for better detail
    for (var i = 0.0; i < maxIterations; i += 1.0) {
        // z = z^2 + c
        z_value = vec2f(
            z_value.x * z_value.x - z_value.y * z_value.y,
            2.0 * z_value.x * z_value.y
        ) + c;
        
        if (dot(z_value, z_value) > 4.0) {
            n = i;
            break;
        }
    }
    
    // Add smooth coloring for better detail
    // This helps show more detail between iteration bands
    if (n < maxIterations) {
        // Log of squared magnitude gives smoother transition
        let log_zn = log(dot(z_value, z_value)) / 2.0;
        let nu = log(log_zn / log(2.0)) / log(2.0);
        n = n + 1.0 - nu;
    }
    
    // Normalize to 0-1 range
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

// Function to glitch UV coordinates
fn glitchUV(uv: vec2f, t: f32) -> vec2f {
    // Removed glitches entirely - just return original UVs
    return uv;
}

// Enhanced multi-color fractal coloring
fn createVibrantColors(value: f32, t: f32) -> vec3f {
    // Create a more subtle palette with softer pinks and whites
    let color1 = vec3f(0.9, 0.5, 0.7);  // Softer pink (less saturated)
    let color2 = vec3f(0.4, 0.6, 0.9);  // Softer blue
    let color3 = vec3f(0.95, 0.75, 0.6);  // Very soft peach (almost pastel)
    let color4 = vec3f(0.97, 0.97, 1.0);  // Slightly off-white (warmer)
    let color5 = vec3f(0.8, 0.9, 0.95);  // Very light blue (almost white)
    
    // Calculate time-based animations for color mixing - faster to be more noticeable
    let t1 = sin(t * 0.4 + value * 3.0) * 0.4 + 0.6; 
    let t2 = sin(t * 0.25 + value * 5.0) * 0.3 + 0.5; 
    
    // Mix colors with more variation
    var finalColor = mix(color1, color2, t1);
    
    // Add soft peach tones more noticeably
    finalColor = mix(finalColor, color3, value * 0.35 * t2);
    
    // Add subtle nearly-white highlights
    if (value > 0.8) {
        finalColor = mix(finalColor, color4, (value - 0.8) * 3.0); 
    }
    
    // Add light blue hints for mid-range values
    if (value > 0.4 && value < 0.7) {
        finalColor = mix(finalColor, color5, (value - 0.4) * 1.5 * (0.7 - value) * 5.0);
    }
    
    // Add a pulsing effect to brightness
    let pulse = 1.2 + sin(t * 0.3) * 0.15;
    
    return finalColor * pulse;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    // ===== CONFIGURATION: Easy to modify parameters =====
    // Predator heading influence on Julia set
    let PREDATOR_INFLUENCE = 0.001; // Reduced influence for more subtle variations
    
    // Classic Julia set sweet spot parameters
    let JULIA_CLASSIC_X = -0.8; // Classic value for recognizable Julia pattern
    let JULIA_CLASSIC_Y = 0.156;
    
    // ZOOM: Add subtle breathing effect to zoom
    let baseZoom = 0.4;  // Base zoom level
    let zoomVariation = 0.02; // Small amount of zoom variation
    let ZOOM = baseZoom + sin(time * 0.2) * zoomVariation;  // Subtle breathing effect
    
    // ITERATIONS: Higher values = more detail
    let MAX_ITERATIONS = 70.0;
    
    // Position of the center of the Julia set - add subtle drift
    let driftAmount = 0.005;
    let CENTER_X = 0.5 + sin(time * 0.15) * driftAmount;
    let CENTER_Y = 0.5 + cos(time * 0.1) * driftAmount;
    
    // Dynamic time scale
    let EFFECT_TIME_SCALE = 1.0;   // Faster time scale for visual effects
    let effectTime = time * EFFECT_TIME_SCALE;
    
    let rectIndex = input.rectIndex;
    let rect = rectangles[rectIndex];
    let params = customData[rectIndex].params; // params.xy contains normalized predator heading
    let uv = input.uv;
    
    // ===== UNIFIED JULIA SET ACROSS ALL BARS =====
    // Get global screen coordinates
    let globalX = rect.position.x + uv.x * rect.size.x;
    let globalY = rect.position.y + uv.y * rect.size.y;
    
    // Map screen coordinates to complex plane with dynamic zoom
    let z = (vec2f(globalX, globalY) - vec2f(CENTER_X, CENTER_Y)) * ZOOM;
    
    // Use predator heading from params.xy to control Julia set parameters
    let predatorHeadingX = params.x; 
    let predatorHeadingY = params.y;
    
    // Focus the Julia set parameters around the classic value
    let c = vec2f(
        JULIA_CLASSIC_X + predatorHeadingX * PREDATOR_INFLUENCE, 
        JULIA_CLASSIC_Y + predatorHeadingY * PREDATOR_INFLUENCE
    );
    
    // Calculate Julia set
    let smoothColor = julia(z, c, MAX_ITERATIONS);
    
    // Use dynamic color variations
    let dynamicColors = createVibrantColors(smoothColor, effectTime);
    
    // Return final color without scan lines or glitches
    return vec4f(dynamicColors, 1.0);
} 