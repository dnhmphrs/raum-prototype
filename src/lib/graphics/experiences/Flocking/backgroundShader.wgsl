// backgroundShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

// Add time uniform for temporal effects
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<storage, read> predatorVelocity: vec3<f32>; // Add predator velocity
@group(0) @binding(2) var<uniform> performanceMode: u32; // Performance mode flag

// Simplified hash function
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

// Glitch block effect - more aggressive but optimized
fn glitchBlock(uv: vec2<f32>, t: f32) -> vec3<f32> {
    let speed = min(length(predatorVelocity.xy), 50.0);
    let predDir = normalize(predatorVelocity.xy + vec2<f32>(0.001, 0.001));
    
    // More aggressive block scaling
    let blockScale = mix(64.0, 256.0, sin(t) * 0.5 + 0.5); // Pulsing block size
    let alignedUV = vec2<f32>(
        dot(uv, predDir) + sin(t * 3.0) * 0.1, // Add wavey distortion
        dot(uv, vec2<f32>(-predDir.y, predDir.x)) + cos(t * 2.0) * 0.1
    );
    
    let block = floor(alignedUV * blockScale);
    let blockHash = wang_hash(u32(block.x + 1000.0 * block.y));
    let blockRand = uhash_to_float(blockHash);
    
    // More aggressive color separation
    return vec3<f32>(
        step(0.3, uhash_to_float(wang_hash(blockHash))) * sin(t),
        step(0.3, uhash_to_float(wang_hash(blockHash + 1u))) * cos(t * 1.7),
        step(0.3, uhash_to_float(wang_hash(blockHash + 2u))) * sin(t * 2.3)
    ) * min(0.4, speed * 0.00002);
}

// Scanline effect
fn scanlines(uv: vec2<f32>, t: f32) -> vec3<f32> {
    // Scanline frequency increases with speed
    let speed = length(predatorVelocity.xy);
    let scanFreq = 100.0 + speed * 5.0;
    
    // Create moving scanlines
    let scan = step(0.5, sin(uv.y * scanFreq + t * 10.0) * 0.5 + 0.5);
    
    // Only show scanlines when predator is moving fast
    let intensity = smoothstep(10.0, 30.0, speed) * 0.15;
    
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
    let hash = wang_hash(x + wang_hash(y + time_seed));
    let n = uhash_to_float(hash);
    
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
    let noise1 = wang_hash(u32(warpedUV.x * 1024.0) + u32(warpedUV.y * 512.0) + u32(t * 60.0));
    let noise2 = wang_hash(u32(warpedUV.y * 892.0) + u32(warpedUV.x * 723.0) + u32(t * 45.0));
    let noise3 = wang_hash(u32(warpedUV.x * 613.0) + u32(warpedUV.y * 921.0) + u32(t * 30.0));
    
    return vec3<f32>(
        step(0.7, uhash_to_float(noise1)),
        step(0.7, uhash_to_float(noise2)),
        step(0.7, uhash_to_float(noise3))
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
    let uv = (fragPos + 1.0) * 0.25;
    
    // Psychedelic base colors
    let bottomColor = vec3<f32>(0.380, 0.451, 0.702);
    let topColor = vec3<f32>(1.000, 0.741, 0.482);
    
    // Warped gradient
    let t = uv.y + sin(uv.x * 6.28 + time) * 0.1;
    var baseColor = mix(bottomColor, topColor, t);
    
    if (performanceMode == 0u) {
        let speed = length(predatorVelocity.xy);
        
        // More frequent updates
        if (fract(time * 0.8) < 0.6) {
            // Layer multiple effects
            baseColor += glitchBlock(uv, time);
            baseColor += psychedelicNoise(uv, time);
            
            // Color channel separation
            let shift = min(0.02, speed * 0.001);
            baseColor.r += glitchBlock(uv + vec2<f32>(shift, 0.0), time).r;
            baseColor.b += glitchBlock(uv - vec2<f32>(shift, 0.0), time).b;
        }
        
        // More aggressive full-screen glitches
        if (fract(time * 0.2) < 0.05 && speed > 10.0) {
            // Multiple glitch lines
            for (var i = 0; i < 3; i++) {
                let linePos = fract(time * (2.7 + f32(i)));
                if (abs(uv.y - linePos) < 0.02) {
                    baseColor = vec3<f32>(1.0) - baseColor;
                    baseColor *= 1.5; // Oversaturate
                }
            }
        }
    }
    
    return vec4<f32>(baseColor, 1.0);
}
