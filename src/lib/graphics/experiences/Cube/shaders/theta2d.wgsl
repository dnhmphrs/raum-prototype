// This is a placeholder edit to check the file content
// If the file exists, we'll see its content and can modify it
// If not, we'll get an error that we can handle 

struct Uniforms {
    time: f32,
    resolution: vec2<f32>,
    unused: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

// Jacobi theta function (third theta function)
fn theta3(z: f32, q: f32) -> f32 {
    var sum: f32 = 1.0;
    
    // Sum a few terms for efficiency
    for (var n: i32 = 1; n <= 5; n = n + 1) {
        let n_f32 = f32(n);
        let term = 2.0 * pow(q, n_f32 * n_f32) * cos(2.0 * 3.14159 * n_f32 * z);
        sum = sum + term;
    }
    
    return sum;
}

// Complex magnitude
fn cmag(z: vec2<f32>) -> f32 {
    return sqrt(z.x * z.x + z.y * z.y);
}

// Complex argument
fn carg(z: vec2<f32>) -> f32 {
    return atan2(z.y, z.x);
}

@fragment
fn fragmentMain(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Normalize coordinates
    let uv = fragCoord.xy / uniforms.resolution;
    
    // Map to [-2, 2] range
    let x = (uv.x * 2.0 - 1.0) * 2.0;
    let y = (uv.y * 2.0 - 1.0) * 2.0;
    
    // Animate parameters
    let time = uniforms.time * 0.1;
    let q = 0.3 + 0.2 * sin(time * 0.5);
    
    // Calculate theta function value
    // Use real part of complex input for simplicity
    let z_real = x * cos(time) - y * sin(time);
    let theta_value = theta3(z_real, q);
    
    // Normalize value for coloring
    let normalized_value = theta_value / 5.0; // Adjust divisor based on typical values
    
    // Create a color gradient
    let color1 = vec3<f32>(0.05, 0.05, 0.2); // Dark blue
    let color2 = vec3<f32>(0.0, 0.4, 0.8);   // Medium blue
    let color3 = vec3<f32>(0.0, 0.7, 1.0);   // Light blue
    
    // Multi-step gradient
    var color: vec3<f32>;
    if (normalized_value < 0.5) {
        color = mix(color1, color2, normalized_value * 2.0);
    } else {
        color = mix(color2, color3, (normalized_value - 0.5) * 2.0);
    }
    
    // Add subtle patterns
    let pattern = 0.05 * sin(x * 10.0 + time) * sin(y * 10.0 + time);
    color = color + vec3<f32>(pattern, pattern, pattern);
    
    // Add vignette effect
    let dist = length(vec2<f32>(x, y) / 2.0);
    let vignette = 1.0 - smoothstep(0.5, 1.5, dist);
    color = color * vignette;
    
    return vec4<f32>(color, 1.0);
} 