// videoBackgroundShader.wgsl

// Uniforms
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var videoTexture: texture_2d<f32>;
@group(0) @binding(2) var texSampler: sampler;
@group(0) @binding(3) var<uniform> viewport: vec2<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
};

struct Uniforms {
    time: f32,
};

// Fullscreen triangle vertex shader
@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    
    // Calculate vertex positions for a fullscreen triangle
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    
    // Calculate texture coordinates for the triangle
    var texCoords = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );
    
    output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
    output.texCoord = texCoords[vertexIndex];
    
    return output;
}

// Subtle distortion effect
fn distortUV(uv: vec2<f32>, t: f32) -> vec2<f32> {
    // Calculate aspect ratio
    let aspect = viewport.x / viewport.y;
    
    // Centered UVs
    var centeredUV = uv - vec2<f32>(0.5, 0.5);
    centeredUV.x *= aspect;
    
    // Apply subtle, slow-moving wave distortion
    let distortionAmount = 0.01;
    let distortionSpeed = 0.2;
    
    // Multi-layered subtle waves
    let distortion = vec2<f32>(
        sin(centeredUV.y * 2.0 + t * distortionSpeed) * cos(centeredUV.x + t * 0.1) * distortionAmount,
        cos(centeredUV.x * 2.0 - t * distortionSpeed * 0.7) * sin(centeredUV.y - t * 0.15) * distortionAmount
    );
    
    // Apply distortion
    centeredUV += distortion;
    
    // Convert back to UV space
    centeredUV.x /= aspect;
    return centeredUV + vec2<f32>(0.5, 0.5);
}

// Vignette effect
fn vignette(uv: vec2<f32>, intensity: f32) -> f32 {
    let center = vec2<f32>(0.5, 0.5);
    let dist = distance(uv, center);
    return 1.0 - smoothstep(0.5, 0.75, dist) * intensity;
}

// Clamp UV coordinates to valid range (0-1)
fn clampUV(uv: vec2<f32>) -> vec2<f32> {
    return clamp(uv, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
}

// Function to check if UV is in valid range without using if statements
fn isValidUV(uv: vec2<f32>) -> f32 {
    // Check if UV is in valid range using step function:
    // step(edge, x) returns 0.0 if x < edge, and 1.0 otherwise
    let isXValid = step(0.0, uv.x) * step(uv.x, 1.0);
    let isYValid = step(0.0, uv.y) * step(uv.y, 1.0);
    
    // Both components must be valid (multiply results together)
    return isXValid * isYValid;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate aspect ratio to preserve video dimensions
    let aspectRatio = viewport.x / viewport.y;
    let videoAspectRatio = f32(textureDimensions(videoTexture).x) / f32(textureDimensions(videoTexture).y);
    
    // Adjust texture coordinates to maintain aspect ratio
    var texCoord = input.texCoord;
    
    // Center the texture and maintain aspect ratio
    if (aspectRatio > videoAspectRatio) {
        // Screen is wider than video
        let scale = videoAspectRatio / aspectRatio;
        texCoord.x = (texCoord.x - 0.5) / scale + 0.5;
    } else {
        // Screen is taller than video
        let scale = aspectRatio / videoAspectRatio;
        texCoord.y = (texCoord.y - 0.5) / scale + 0.5;
    }
    
    // Skip pixels outside the valid texture range
    if (texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) {
        discard;
    }
    
    // Sample the video texture
    var color = textureSample(videoTexture, texSampler, texCoord);
    
    // Apply time-based effects
    let time = uniforms.time;
    
    // Increase the base transparency level (0.95 = 95% opaque)
    let baseAlpha = 0.98;
    
    // Calculate a subtle vignette effect (less dark at edges)
    let center = vec2<f32>(0.5, 0.5);
    let dist = distance(texCoord, center);
    let vignette = 1.0 - smoothstep(0.3, 0.7, dist);
    
    // Apply a subtle pulsing effect to the color with a cool tint
    let pulse = 0.05 * sin(time * 0.2) + 0.95;
    
    // Apply color adjustments (need to create a new vector instead of assigning to .rgb)
    var adjustedRgb = color.rgb * pulse;
    adjustedRgb.b *= 1.15; // Slight blue boost
    
    // Increase contrast by stretching the color range - fix the assignment
    adjustedRgb = (adjustedRgb - 0.5) * 1.25 + 0.5;
    
    // Calculate luminance for opacity control
    let luminance = dot(adjustedRgb, vec3<f32>(0.299, 0.587, 0.114));
    
    // Keep dark areas more visible by scaling luminance from 0.8-1.0 instead of 0.5-1.0
    let scaledLuminance = 0.8 + luminance * 0.2;
    
    // Final opacity combines base alpha, scaled luminance, and vignette
    let finalAlpha = baseAlpha * scaledLuminance * (0.85 + vignette * 0.15);
    
    // Create final color with adjusted RGB and alpha
    return vec4<f32>(adjustedRgb, finalAlpha);
} 