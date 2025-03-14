struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Use a simpler uniform structure with explicit alignment
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    return output;
}

// Random function
fn random(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

// Hash function for matrix effect
fn hash(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.103, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Adjust UV to maintain aspect ratio
    var uv_aspect = uv;
    uv_aspect.x *= resolution.x / resolution.y;
    
    // Create a grid for the matrix effect
    let grid_size = 40.0;
    var grid_uv = floor(uv_aspect * grid_size) / grid_size;
    
    // Create digital rain effect
    var rain_speed = 0.3;
    var rain_offset = time * rain_speed;
    
    // Different columns move at different speeds
    let column_variation = hash(vec2<f32>(grid_uv.x, 0.0)) * 0.8 + 0.2;
    rain_offset *= column_variation;
    
    // Create falling characters
    var char_pos = grid_uv.y + rain_offset;
    char_pos = fract(char_pos);
    
    // Determine which characters are visible
    let char_hash = hash(grid_uv);
    let char_threshold = 0.2 + char_hash * 0.3;
    
    // Character brightness based on position
    var char_brightness = smoothstep(1.0, 0.0, char_pos * 2.0);
    
    // Only show characters that meet the threshold
    var char_visible = step(char_pos, char_threshold);
    
    // Glitch effect - occasional horizontal shifts
    let glitch_time = floor(time * 2.0);
    let glitch_seed = hash(vec2<f32>(glitch_time, grid_uv.y));
    let glitch_amount = step(0.96, glitch_seed) * 0.1;
    let glitch_offset = hash(vec2<f32>(grid_uv.y, glitch_time)) * 2.0 - 1.0;
    grid_uv.x += glitch_offset * glitch_amount;
    
    // Occasional color shifts
    let color_shift = step(0.95, hash(vec2<f32>(grid_uv.x, time)));
    let color_amount = hash(vec2<f32>(grid_uv.y, time));
    
    // Combine effects
    var color = vec3<f32>(0.0, 0.0, 0.0);
    
    // Base matrix color (brighter green)
    let matrix_color = vec3<f32>(0.0, 1.0, 0.4) * char_brightness * char_visible * 1.5;
    
    // Add occasional color variations
    let alt_color1 = vec3<f32>(0.0, 0.9, 1.0) * char_brightness * char_visible * 1.5;
    let alt_color2 = vec3<f32>(1.0, 0.6, 0.0) * char_brightness * char_visible * 1.5;
    
    // Mix colors based on hash
    color = mix(matrix_color, alt_color1, color_shift * color_amount);
    color = mix(color, alt_color2, color_shift * (1.0 - color_amount));
    
    // Add subtle scan lines
    let scan_line = sin(uv.y * resolution.y * 0.5) * 0.5 + 0.5;
    color *= 0.9 + scan_line * 0.2;
    
    // Add subtle vignette
    let vignette = 1.0 - length((uv - 0.5) * 1.5);
    color *= vignette;
    
    // Add subtle noise
    let noise = random(uv + time * 0.01) * 0.05;
    color += noise;
    
    // Add mouse interaction - enhanced glow around mouse position
    let mouse_dist = length(uv - mouse);
    let mouse_glow = smoothstep(0.4, 0.0, mouse_dist) * 0.5;
    color += vec3<f32>(0.0, mouse_glow, mouse_glow * 0.7);
    
    return vec4<f32>(color, 1.0);
} 