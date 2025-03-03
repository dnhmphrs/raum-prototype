// backgroundShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

// Add time uniform for temporal effects
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<storage, read> predatorVelocity: vec3<f32>; // Add predator velocity
@group(0) @binding(2) var<uniform> performanceMode: u32; // Performance mode flag

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
    
    // Create a rotated coordinate space based on predator direction
    let perpDir = vec2<f32>(-predDir.y, predDir.x);
    var warpedUV = uv;
    
    // Distort along and perpendicular to movement
    warpedUV += predDir * (speed * 0.003) * sin(dot(uv, perpDir) * 8.0 + t * 2.0);
    warpedUV += perpDir * (speed * 0.002) * cos(dot(uv, predDir) * 10.0 + t * 1.7);
    
    // Add some diagonal noise
    let diag = sin(dot(uv, predDir + perpDir) * 15.0 + t) * 0.01 * speed;
    warpedUV += (predDir + perpDir) * diag;
    
    // Block-based glitch with rotating blocks
    let angle = atan2(predDir.y, predDir.x);
    let rotatedUV = vec2<f32>(
        warpedUV.x * cos(angle) - warpedUV.y * sin(angle),
        warpedUV.x * sin(angle) + warpedUV.y * cos(angle)
    );
    
    let blockSize = mix(128.0, 512.0, sin(t * 0.5) * 0.5 + 0.5);
    let blockPos = floor(rotatedUV * blockSize);
    
    // Rest of the hash calculations...
    let x = u32(blockPos.x);
    let y = u32(blockPos.y);
    let time_val = u32(t * 90.0);
    
    let seed = x + (y * 256u) + time_val;
    let h1 = hash(seed);
    let h2 = hash(h1);
    let h3 = hash(h2);
    
    let r = hash_to_float(h1);
    let g = hash_to_float(h2);
    let b = hash_to_float(h3);
    
    // Create directional glitch patterns
    let glitch = vec3<f32>(
        step(0.5 + sin(dot(uv, predDir) * 4.0 + t) * 0.2, r),
        step(0.5 + cos(dot(uv, perpDir) * 3.0 + t * 1.7) * 0.2, g),
        step(0.5 + sin(dot(uv, predDir + perpDir) * 5.0 + t * 2.3) * 0.2, b)
    ) * min(0.2, speed * 0.01);
    
    // Directional color separation
    let shift = speed * 0.0005;
    let rgb_split = vec3<f32>(
        step(0.6, hash_to_float(hash(u32(dot(warpedUV, predDir) * 1000.0)))),
        step(0.6, hash_to_float(hash(u32(dot(warpedUV, predDir + perpDir) * 1001.0 + shift)))),
        step(0.6, hash_to_float(hash(u32(dot(warpedUV, perpDir) * 1002.0 - shift))))
    ) * 0.05;
    
    // Warm bursts along movement direction
    let burst = step(0.98, r) * vec3<f32>(1.0, 0.5, 0.2) * 0.3 * 
                smoothstep(0.0, 0.2, abs(dot(normalize(uv - 0.5), predDir)));
    
    return glitch + burst + rgb_split;
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
    let pixelSize = 16.0;
    let quantizedUV = floor(uv * pixelSize) / pixelSize;
    
    // Create hash seeds
    let x = u32(quantizedUV.x * 1024.0);
    let y = u32(quantizedUV.y * 1024.0);
    let time_seed = u32(t * 3.0);
    
    // Generate noise
    let hash = hash(x + hash(y + time_seed));
    let n = hash_to_float(hash);
    
    // Only show noise when predator is moving
    let speed = length(predatorVelocity.xy);
    let intensity = smoothstep(5.0, 20.0, speed) * 0.1;
    
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
    warpedUV += predDir * sin(t * 2.0) * 0.2;
    
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
    
    // Base colors with more contrast
    let bottomColor = vec3<f32>(0.07, 0.07, 0.07);
    let topColor = vec3<f32>(0.25, 0.25, 0.25);
    
    // Warped gradient
    let t = uv.y + sin(uv.x * 6.28 + time * 0.5) * 0.1;
    var color = mix(bottomColor, topColor, t);
    
    // Add intense glitch effects
    color += glitch_effect(uv, time);
    
    // Add occasional full-screen color inversion
    let speed = length(predatorVelocity.xy);
    if (speed > 20.0 && fract(time * 0.5) < 0.05) {
        color = vec3<f32>(1.0) - color;
    }
    
    return vec4<f32>(color, 1.0);
}
