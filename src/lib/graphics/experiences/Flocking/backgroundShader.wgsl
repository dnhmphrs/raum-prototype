// backgroundShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

// Add time uniform for temporal effects
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<storage, read> predatorVelocity: vec3<f32>; // Add predator velocity
@group(0) @binding(2) var<uniform> performanceMode: u32; // Performance mode flatime = 0.1 * time;

// Simplified hash - less expensive
fn hash(n: u32) -> u32 {
    var x = n;
    x = (x << 13u) ^ x;
    x = x * (x * x * 15731u + 789221u) + 1376312589u;
    return x;
}

fn hash_to_float(h: u32) -> f32 {
    return f32(h & 0x7FFFFFFFu) / f32(0x7FFFFFFF);
}

// Single-pass glitch effect
fn glitch_effect(uv: vec2<f32>, t: f32) -> vec3<f32> {
    let speed = length(predatorVelocity.xy);
    let predDir = normalize(predatorVelocity.xy + vec2<f32>(0.001));
    let perpDir = vec2<f32>(-predDir.y, predDir.x);
    var warpedUV = uv;
    
    // Ethereal spiral patterns
    let spiral = vec2<f32>(
        sin(length((uv - 0.5) * 12.0) * 8.0 + t * 0.05) * cos(length(uv * 10.0)) +
        sin(length((uv - 0.5) * 8.0) * 6.0 - t * 0.04) * 0.5,
        
        cos(length((uv - 0.5) * 10.0) * 7.0 + t * 0.04) * sin(length(uv * 12.0)) +
        cos(length((uv - 0.5) * 6.0) * 5.0 - t * 0.03) * 0.5
    );
    
    // Dreamy wave interference
    warpedUV += predDir * (speed * 0.001) * sin(
        dot(uv + spiral * 1.5, perpDir) * 4.0 + 
        sin(length(uv - 0.5) * 6.0 + t * 0.06) * 2.0
    );
    
    warpedUV += perpDir * (speed * 0.0006) * cos(
        dot(uv + spiral * 1.2, predDir) * 3.5 + 
        cos(length(uv - 0.5) * 5.0 + t * 0.05) * 2.0
    );
    
    // Organic swirling patterns
    let swirl = vec2<f32>(
        sin(dot(uv * 1.5, predDir + perpDir) * 7.0 + cos(length(uv - 0.5) * 6.0) * t * 0.02) +
        sin(length(uv - 0.5) * 8.0 - t * 0.03) * 0.3,
        
        cos(dot(uv * 1.2, predDir - perpDir) * 5.0 + sin(length(uv - 0.5) * 7.0) * t * 0.01) +
        cos(length(uv - 0.5) * 9.0 + t * 0.02) * 0.3
    );
    
    // Fluid distortions
    let distort = vec2<f32>(
        sin(swirl.x * 3.0 + spiral.y * 2.0 + t * 0.14) * cos(swirl.y * 2.0),
        cos(swirl.x * 2.0 + spiral.x * 3.0 - t * 0.12) * sin(swirl.y * 3.0)
    ) * 0.1 * speed;
    
    warpedUV += distort;
    
    // Ethereal flow patterns
    let flow = vec3<f32>(
        sin(dot(warpedUV + spiral * 1.2, predDir) * 6.0 + t * 0.15) +
        sin(length(warpedUV - 0.5) * 5.0 - t * 0.1) * 0.3,
        
        sin(dot(warpedUV + swirl * 0.8, perpDir) * 5.0 + t * 0.12) +
        sin(length(warpedUV - 0.5) * 6.0 + t * 0.08) * 0.3,
        
        sin(dot(warpedUV + distort * 1.5, predDir + perpDir) * 4.0 + t * 0.13) +
        sin(length(warpedUV - 0.5) * 7.0 - t * 0.09) * 0.3
    ) * 0.5 + 0.5;
    
    // Dreamlike transitions
    let glitch = vec3<f32>(
        smoothstep(0.48, 0.52, flow.x),
        smoothstep(0.48, 0.52, flow.y),
        smoothstep(0.48, 0.52, flow.z)
    ) * min(0.06, speed * 0.02);
    
    // Ethereal color separation
    let shift = speed * 0.0001;
    let rgb_split = vec3<f32>(
        sin(dot(warpedUV + shift * predDir + spiral * 0.4, vec2<f32>(flow.x, flow.y)) * 7.0 +
            sin(length(warpedUV - 0.5) * 4.0) * 2.0),
        sin(dot(warpedUV + swirl * 0.3, vec2<f32>(flow.y, flow.z)) * 6.0 +
            sin(length(warpedUV - 0.5) * 5.0) * 2.0),
        sin(dot(warpedUV - shift * predDir - spiral * 0.3, vec2<f32>(flow.z, flow.x)) * 5.0 +
            sin(length(warpedUV - 0.5) * 6.0) * 2.0)
    ) * 0.01;
    
    // Dreamy warm accents
    let warmth = smoothstep(0.45, 0.55, 
        sin(length(warpedUV - 0.5) * 8.0 + spiral.x * 3.0 + t * 0.1) * 
        cos(dot(normalize(uv - 0.5), predDir + swirl * 0.2) * 4.0) +
        sin(length(warpedUV - 0.5) * 6.0 - t * 0.08) * 0.3
    );
    let burst = warmth * vec3<f32>(1.0, 0.5, 0.2) * 0.08 * min(1.0, speed * 0.03);
    
    return glitch + rgb_split + burst;
}

// Scanline effect
fn scanlines(uv: vec2<f32>, t: f32) -> vec3<f32> {
    // Scanline frequency increases with speed
    let speed = length(predatorVelocity.xy);
    let scanFreq = 100.0 + speed * 5.0;
    
    // Create moving scanlines
    let scan = step(0.1, sin(uv.y * scanFreq + t * 10.0) * 0.5 + 0.5);
    
    // Only show scanlines when predator is moving fast
    let intensity = smoothstep(1.0, 30.0, speed) * 0.05;
    
    return vec3<f32>(scan * intensity);
}

// Digital noise
fn digitalNoise(uv: vec2<f32>, t: f32) -> vec3<f32> {
    // Reduce resolution for performance
    let pixelSize = 4.0;
    let quantizedUV = floor(uv * pixelSize) / pixelSize;
    
    // Create hash seeds
    let x = u32(quantizedUV.x * 248.0);
    let y = u32(quantizedUV.y * 248.0);
    let time_seed = u32(t * 3.0);
    
    // Generate noise
    let hash = hash(x + hash(y + time_seed));
    let n = hash_to_float(hash);
    
    // Only show noise when predator is moving
    let speed = length(predatorVelocity.xy);
    let intensity = smoothstep(3.0, 6.0, speed) * 0.001;
    
    return vec3<f32>(step(0.7, n) * intensity);
}

fn psychedelicNoise(uv: vec2<f32>, t: f32) -> vec3<f32> {
    let speed = length(predatorVelocity.xy);
    let predDir = normalize(predatorVelocity.xy + vec2<f32>(0.001, 0.001));
    
    // Create warped space
    var warpedUV = uv + vec2<f32>(
        sin(uv.y * 10.0 + t) * 0.1,
        cos(uv.x * 8.0 + t * 1.3) * 0.1
    );
    
    // Add predator influence to the warp
    warpedUV += predDir * sin(t * 2.0) * 0.02;
    
    // Multiple layers of noise
    let noise1 = hash(u32(warpedUV.x * 1024.0) + u32(warpedUV.y * 512.0) + u32(t * 60.0));
    let noise2 = hash(u32(warpedUV.y * 892.0) + u32(warpedUV.x * 723.0) + u32(t * 45.0));
    let noise3 = hash(u32(warpedUV.x * 613.0) + u32(warpedUV.y * 921.0) + u32(t * 30.0));
    
    return vec3<f32>(
        step(0.7, hash_to_float(noise1)),
        step(0.7, hash_to_float(noise2)),
        step(0.7, hash_to_float(noise3))
    ) * min(0.3, speed * 0.015);
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
    let uv = (fragPos + 1.0) * 0.5;
    
    // Smoother gradient base
    let bottomColor = vec3<f32>(0.878, 0.914, 0.980);
    let topColor = vec3<f32>(0.380, 0.451, 0.702);
    
    // Flowing gradient
    let t = uv.y + sin(uv.x * 2.5 + time * 0.002) * 0.0004 +
           cos(length(uv - 0.5) * 4.0 + time * 0.001) * 0.0002;
    var color = mix(bottomColor, topColor, t);
    
    color += glitch_effect(uv, time);
    
    // Smoother inversions
    let speed = length(predatorVelocity.xy);
    if (speed > 14.0) {
        let inv = smoothstep(0.0, 0.1, fract(time * 0.01)) * 
                 smoothstep(0.1, 0.0, fract(time * 0.01));
        color = mix(color, vec3<f32>(1.0) - color, inv);
    }
    
    return vec4<f32>(color, 1.0);
}
