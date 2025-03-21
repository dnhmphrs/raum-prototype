// textOverlayShader.wgsl - For rendering funky, warped text overlay

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
};

// Uniforms
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<storage, read> predatorVelocity: vec3<f32>;
@group(0) @binding(2) var<uniform> viewport: vec2<f32>;

// Helper functions for cool effects
fn noise21(p: vec2<f32>) -> f32 {
    let p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
    let p3b = p3 + vec3<f32>(dot(p3, vec3<f32>(p3.y, p3.z, p3.x) + 33.33));
    return fract((p3b.x + p3b.y) * p3b.z);
}

// SDF for a rounded rectangle
fn sdRoundBox(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let q = abs(p) - b + vec2<f32>(r);
    return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Function to render cool, warped text "not crowded"
fn renderText(uv: vec2<f32>, t: f32) -> vec4<f32> {
    // Center and scale the coordinates
    let aspect = viewport.x / viewport.y;
    var p = (uv - 0.5) * vec2<f32>(aspect, 1.0);
    
    // Predator influence on the warp effect
    let predVel = predatorVelocity.xy;
    let speed = length(predVel);
    let predDir = normalize(predVel + vec2<f32>(0.001));
    
    // Apply subtle position warping (individual letters warp more)
    var warpAmount = 0.008 + speed * 0.003;
    
    // Adjust positioning
    p.x += 0.05;
    
    // Make text MUCH smaller (approximately half the size)
    let textScale = 0.1; // Doubled from 0.2 to make text half the size
    p /= textScale;
    
    // Time-based thickness warping
    let thicknessWarp = sin(t * 0.7) * 0.06 + speed * 0.02;
    
    // Create flowing characters using smooth operations with thickness warping
    let baseThickness = 0.12;
    let warpedThickness = baseThickness * (1.0 + thicknessWarp);
    
    // Circle factors
    let circleOuterFactor = 0.28;
    let circleInnerFactor = 0.17;
    
    // Initialize distance value - THIS MUST BE VAR NOT LET
    var d = 1000.0; // Initial large distance
    
    // "n" with individual warping
    var nPos = vec2<f32>(-2.0, 0.0);
    nPos.x += sin(t * 0.8 + nPos.y) * warpAmount * 2.0;
    nPos.y += cos(t * 0.9) * warpAmount * 1.5;
    var n1 = sdRoundBox(p - nPos, vec2<f32>(warpedThickness, 0.35), 0.05);
    
    var n2Pos = vec2<f32>(-1.8, 0.1);
    n2Pos.x += sin(t * 0.7 - n2Pos.y) * warpAmount * 1.8;
    n2Pos.y += cos(t * 1.1) * warpAmount * 1.7;
    var n2 = sdRoundBox(p - n2Pos, vec2<f32>(warpedThickness, 0.25), 0.05);
    
    var n3Pos = vec2<f32>(-1.9, 0.0);
    n3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    n3Pos.y += cos(t * 0.75 + n3Pos.x) * warpAmount * 1.6;
    var n3 = length(p - n3Pos) - 0.17 * (1.0 + thicknessWarp);
    
    d = min(max(-n3, min(n1, n2)), d);
    
    // "o" with individual warping
    var oPos = vec2<f32>(-1.4, 0.0);
    oPos.x += sin(t * 0.65 + oPos.y * 2.0) * warpAmount * 1.9;
    oPos.y += cos(t * 0.85) * warpAmount * 1.8;
    var o = length(p - oPos) - circleOuterFactor * (1.0 + thicknessWarp);
    var oi = length(p - oPos) - circleInnerFactor * (1.0 + thicknessWarp);
    d = min(d, max(-oi, o));
    
    // "t" with individual warping
    var tPos = vec2<f32>(-1.0, 0.0);
    tPos.x += sin(t * 0.75) * warpAmount * 1.7;
    tPos.y += cos(t * 0.95 + tPos.x) * warpAmount * 1.5;
    var t1 = sdRoundBox(p - tPos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var t2Pos = vec2<f32>(-1.0, 0.15);
    t2Pos.x += sin(t * 0.7 + t2Pos.y * 3.0) * warpAmount * 1.6;
    t2Pos.y += cos(t * 0.8) * warpAmount * 1.5;
    var t2 = sdRoundBox(p - t2Pos, vec2<f32>(0.2, warpedThickness - 0.02), 0.03);
    d = min(d, min(t1, t2));
    
    // Space
    
    // "c" with individual warping
    var cPos = vec2<f32>(-0.1, 0.0);
    cPos.x += sin(t * 0.85 + cPos.y) * warpAmount * 2.0;
    cPos.y += cos(t * 0.7) * warpAmount * 1.8;
    var c = length(p - cPos) - circleOuterFactor * (1.0 + thicknessWarp);
    var ci = length(p - cPos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var ccutPos = vec2<f32>(0.02, 0.0);
    ccutPos.x += sin(t * 0.9) * warpAmount * 1.7;
    ccutPos.y += cos(t * 0.8 + ccutPos.x) * warpAmount * 1.9;
    var ccut = sdRoundBox(p - ccutPos, vec2<f32>(0.1, warpedThickness - 0.01), 0.03);
    d = min(d, max(max(-ci, c), -ccut));
    
    // "r" with individual warping
    var r1Pos = vec2<f32>(0.4, 0.05);
    r1Pos.x += sin(t * 0.8 + r1Pos.y * 2.0) * warpAmount * 1.8;
    r1Pos.y += cos(t * 0.7) * warpAmount * 1.7;
    var r1 = sdRoundBox(p - r1Pos, vec2<f32>(warpedThickness, 0.3), 0.03);
    
    var r2Pos = vec2<f32>(0.5, 0.13);
    r2Pos.x += sin(t * 0.75) * warpAmount * 1.6;
    r2Pos.y += cos(t * 0.85 + r2Pos.x) * warpAmount * 1.8;
    var r2 = length(p - r2Pos) - 0.17 * (1.0 + thicknessWarp); // Increased from 0.15
    
    var r2cutPos = vec2<f32>(0.55, 0.0);
    r2cutPos.x += sin(t * 0.65) * warpAmount * 1.5;
    r2cutPos.y += cos(t * 0.9 + r2cutPos.x * 2.0) * warpAmount * 1.7;
    var r2cut = sdRoundBox(p - r2cutPos, vec2<f32>(0.15, warpedThickness * 1.5), 0.03);
    d = min(d, min(r1, max(-r2cut, r2)));
    
    // "o" with individual warping
    var o2Pos = vec2<f32>(0.9, 0.0);
    o2Pos.x += sin(t * 0.72 + o2Pos.y * 1.8) * warpAmount * 1.8;
    o2Pos.y += cos(t * 0.67) * warpAmount * 1.9;
    var o2 = length(p - o2Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var o2i = length(p - o2Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    d = min(d, max(-o2i, o2));
    
    // "w" with individual warping
    var w1Pos = vec2<f32>(1.4, 0.0);
    w1Pos.x += sin(t * 0.83 + w1Pos.y * 1.5) * warpAmount * 1.6;
    w1Pos.y += cos(t * 0.63) * warpAmount * 1.7;
    var w1 = sdRoundBox(p - w1Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var w2Pos = vec2<f32>(1.6, 0.0);
    w2Pos.x += sin(t * 0.79 + w2Pos.y * 1.4) * warpAmount * 1.5;
    w2Pos.y += cos(t * 0.69) * warpAmount * 1.8;
    var w2 = sdRoundBox(p - w2Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var w3Pos = vec2<f32>(1.8, 0.0);
    w3Pos.x += sin(t * 0.75 + w3Pos.y * 1.6) * warpAmount * 1.7;
    w3Pos.y += cos(t * 0.65) * warpAmount * 1.9;
    var w3 = sdRoundBox(p - w3Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var wcPos = vec2<f32>(1.6, -0.18);
    wcPos.x += sin(t * 0.71) * warpAmount * 1.4;
    wcPos.y += cos(t * 0.81 + wcPos.x * 1.5) * warpAmount * 1.6;
    var wc = sdRoundBox(p - wcPos, vec2<f32>(0.25, warpedThickness), 0.06);
    d = min(d, min(min(w1, w2), min(w3, wc)));
    
    // "d" with individual warping
    var d1Pos = vec2<f32>(2.4, 0.0);
    d1Pos.x += sin(t * 0.69 + d1Pos.y * 1.7) * warpAmount * 1.6;
    d1Pos.y += cos(t * 0.73) * warpAmount * 1.7;
    var d1 = length(p - d1Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var d1i = length(p - d1Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var d2Pos = vec2<f32>(2.6, 0.0);
    d2Pos.x += sin(t * 0.76) * warpAmount * 1.5;
    d2Pos.y += cos(t * 0.82 + d2Pos.x * 1.4) * warpAmount * 1.8;
    var d2 = sdRoundBox(p - d2Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    d = min(d, min(max(-d1i, d1), d2));
    
    // "e" with individual warping
    var e0Pos = vec2<f32>(3.0, 0.0);
    e0Pos.x += sin(t * 0.78 + e0Pos.y * 1.6) * warpAmount * 1.7;
    e0Pos.y += cos(t * 0.88) * warpAmount * 1.8;
    var e0 = length(p - e0Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var e0i = length(p - e0Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var e1Pos = vec2<f32>(3.0, 0.0);
    e1Pos.x += sin(t * 0.74) * warpAmount * 1.6;
    e1Pos.y += cos(t * 0.84 + e1Pos.x * 1.5) * warpAmount * 1.7;
    var e1 = sdRoundBox(p - e1Pos, vec2<f32>(0.25, warpedThickness), 0.03);
    
    var e2Pos = vec2<f32>(3.1, -0.13);
    e2Pos.x += sin(t * 0.7 + e2Pos.y * 2.0) * warpAmount * 1.6;
    e2Pos.y += cos(t * 0.8) * warpAmount * 1.8;
    var e2 = sdRoundBox(p - e2Pos, vec2<f32>(0.15, warpedThickness - 0.01), 0.03);
    d = min(d, min(max(-e0i, e0), min(e1, e2)));
    
    // "d" with individual warping
    var d3Pos = vec2<f32>(3.5, 0.0);
    d3Pos.x += sin(t * 0.73 + d3Pos.y * 1.8) * warpAmount * 1.7;
    d3Pos.y += cos(t * 0.83) * warpAmount * 1.6;
    var d3 = length(p - d3Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var d3i = length(p - d3Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var d4Pos = vec2<f32>(3.7, 0.0);
    d4Pos.x += sin(t * 0.68) * warpAmount * 1.8;
    d4Pos.y += cos(t * 0.86 + d4Pos.x * 1.7) * warpAmount * 1.9;
    var d4 = sdRoundBox(p - d4Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    d = min(d, min(max(-d3i, d3), d4));
    
    // Calculate edge distance for the combined shape with softer edge
    let edge = smoothstep(0.015, -0.015, d);
    
    // Create a cleaner inner glow with less contrast
    let innerGlow = smoothstep(0.05, -0.05, d);
    
    // Pure white for better visibility through dithering
    let baseColor = vec3<f32>(1.0, 1.0, 1.0);
    
    // Simpler shimmer effect
    let shimmer = 0.03 * sin(d * 15.0 - t * 1.5);
    let finalBaseColor = baseColor + vec3<f32>(shimmer);
    
    // Simpler glow effect
    let glowPulse = 0.5 + 0.5 * sin(t * 0.4);
    let glowSize = 0.2 + 0.1 * glowPulse;
    let glow = smoothstep(glowSize, -0.05, d);
    
    // Combine inner and outer effects - simplified
    let inner = mix(finalBaseColor * 0.98, finalBaseColor, innerGlow);
    
    // Soft white outline - no harsh borders
    let outline = smoothstep(0.03, 0.0, abs(d - 0.01)) * 0.6;
    let outlineColor = vec3<f32>(1.0);
    
    // Start with a zero color
    var color = vec3<f32>(0.0);
    
    // Simpler compositing layers - no border effect
    color = mix(color, inner, innerGlow); // Inner color
    color = mix(color, outlineColor, outline); // Add soft outline
    
    // Alpha increases with edge proximity - boosted for better visibility
    let alpha = max(edge, glow * 0.5) * 0.9;
    
    // Pack color and alpha
    return vec4<f32>(color, alpha);
}

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    
    // Create a full-screen quad
    var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0)
    );
    
    var texCoords = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 1.0)
    );
    
    output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
    output.texCoord = texCoords[vertexIndex];
    
    return output;
}

@fragment
fn fragment_main(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
    // Get color and alpha from the render function
    let result = renderText(texCoord, time);
    
    // Apply predator velocity to influence transparency
    let speed = length(predatorVelocity.xy);
    let speedBoost = min(0.7, speed * 0.04); // Slightly reduced for cleaner look
    
    // Use increased base alpha for better visibility
    let finalAlpha = min(0.9, result.a + speedBoost);
    
    return vec4<f32>(result.rgb, finalAlpha);
} 