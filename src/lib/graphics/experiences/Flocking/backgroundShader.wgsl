// backgroundShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

// Add time uniform for temporal effects
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<storage, read> predatorVelocity: vec3<f32>; // Add predator velocity
// Remove the binding that's causing the error for now
// @group(0) @binding(2) var<uniform> performanceMode: u32; // Add performance mode flag

// Ultra-chaotic hash using bit manipulation
fn wang_hash(seed: u32) -> u32 {
    var s = seed;
    s = (s ^ 61u) ^ (s >> 16u);
    s *= 9u;
    s = s ^ (s >> 4u);
    s *= 0x27d4eb2du;
    s = s ^ (s >> 15u);
    return s;
}

// Convert uint32 to float [0,1]
fn uhash_to_float(h: u32) -> f32 {
    return f32(h) / 4294967295.0;
}

// Completely decorrelated noise
fn randomNoise(uv: vec2<f32>, t: f32) -> vec3<f32> {
    // Get predator direction
    let predDir = normalize(predatorVelocity.xy);
    
    // Create directional distortion
    let distortion = dot(uv - 0.5, predDir) * 20.0;
    
    // Create time offsets influenced by predator movement
    let t1 = t * 120.0 + distortion;
    let t2 = sin(t * 0.9 + distortion) * 20.0;
    let t3 = cos(t * 1.7 + distortion) * 15.0;
    
    // Create seeds with directional components
    let x = u32(uv.x * 2048.0 + t2 + predDir.x * 100.0);
    let y = u32(uv.y * 2048.0 + t3 + predDir.y * 100.0);
    let time_seed = u32(t1);
    
    // Generate multiple uncorrelated hashes
    let seed1 = wang_hash(x + wang_hash(y + time_seed));
    let seed2 = wang_hash(y + wang_hash(time_seed + x));
    let seed3 = wang_hash(time_seed + wang_hash(x + y));
    
    // Convert to floats
    let n1 = uhash_to_float(seed1);
    let n2 = uhash_to_float(seed2);
    let n3 = uhash_to_float(seed3);
    
    // Create sharp noise with more variation
    let baseNoise = step(0.7, n1) * 0.2;
    
    // Add some colored flecks
    let warmFleck = step(0.995, n2) * step(0.98, n3);
    let warmColor = vec3<f32>(1.0, 0.741, 0.482) * warmFleck * 0.4;
    
    // Add some variation in the noise color
    let noiseColor = vec3<f32>(
        baseNoise + step(0.8, n3) * 0.1,
        baseNoise * 0.9,
        baseNoise * 0.8
    );
    
    return noiseColor + warmColor;
}

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    out.fragPos = pos[vertexIndex];
    return out;
}

@fragment
fn fragment_main(@location(0) fragPos: vec2<f32>) -> @location(0) vec4<f32> {
    let uv = (fragPos + 1.0) * 0.25;
    
    // Base gradient colors
    let bottomColor = vec3<f32>(0.380, 0.451, 0.702);
    let topColor = vec3<f32>(1.000, 0.741, 0.482);
    
    // Base gradient
    let t = uv.y;
    var baseColor = mix(bottomColor, topColor, t);
    
    // Simplified noise - always add but make it less intensive
    baseColor += randomNoise(uv, time) * 0.5; // Reduced intensity
    
    return vec4<f32>(baseColor, 1.0);
}
