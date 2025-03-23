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

// Function to render cool, warped text "pretty hands"
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
    p.x += -0.1;
    
    // Make text MUCH smaller (approximately half the size)
    let textScale = 0.08; // Doubled from 0.2 to make text half the size
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
    
    // "p" with individual warping
    var p1Pos = vec2<f32>(-3.8, 0.0);
    p1Pos.x += sin(t * 0.75 + p1Pos.y * 2.0) * warpAmount * 1.9;
    p1Pos.y += cos(t * 0.85) * warpAmount * 1.8;
    var p1 = sdRoundBox(p - p1Pos, vec2<f32>(warpedThickness, 0.35), 0.05);
    
    var p2Pos = vec2<f32>(-3.5, 0.0);
    p2Pos.x += sin(t * 0.65 + p2Pos.y * 2.0) * warpAmount * 1.9;
    p2Pos.y += cos(t * 0.85) * warpAmount * 1.8;
    var p2 = length(p - p2Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var p2i = length(p - p2Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var p3Pos = vec2<f32>(-3.7, -0.1);
    p3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    p3Pos.y += cos(t * 0.75 + p3Pos.x) * warpAmount * 1.6;
    var p3 = sdRoundBox(p - p3Pos, vec2<f32>(0.1, warpedThickness), 0.05);
    d = min(d, min(p1, min(max(-p2i, p2), p3)));
    
    // "r" with individual warping
    var r1Pos = vec2<f32>(-3.1, 0.0);
    r1Pos.x += sin(t * 0.83 + r1Pos.y * 1.5) * warpAmount * 1.6;
    r1Pos.y += cos(t * 0.63) * warpAmount * 1.7;
    var r1 = sdRoundBox(p - r1Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var rcPos = vec2<f32>(-2.9, 0.15);
    rcPos.x += sin(t * 0.71) * warpAmount * 1.4;
    rcPos.y += cos(t * 0.81 + rcPos.x * 1.5) * warpAmount * 1.6;
    var rc = sdRoundBox(p - rcPos, vec2<f32>(0.15, warpedThickness), 0.06);
    d = min(d, min(r1, rc));
    
    // "e" with individual warping
    var e1Pos = vec2<f32>(-2.7, 0.0);
    e1Pos.x += sin(t * 0.72 + e1Pos.y * 1.8) * warpAmount * 1.8;
    e1Pos.y += cos(t * 0.67) * warpAmount * 1.9;
    var e1 = length(p - e1Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var e1i = length(p - e1Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var ecPos = vec2<f32>(-2.6, 0.0);
    ecPos.x += sin(t * 0.9) * warpAmount * 1.7;
    ecPos.y += cos(t * 0.8 + ecPos.x) * warpAmount * 1.9;
    var ec = sdRoundBox(p - ecPos, vec2<f32>(0.15, warpedThickness - 0.01), 0.03);
    d = min(d, max(max(-e1i, e1), -ec));
    
    // "t" with individual warping
    var t1Pos = vec2<f32>(-2.3, 0.0);
    t1Pos.x += sin(t * 0.75) * warpAmount * 1.7;
    t1Pos.y += cos(t * 0.95 + t1Pos.x) * warpAmount * 1.5;
    var t1 = sdRoundBox(p - t1Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var t2Pos = vec2<f32>(-2.3, 0.15);
    t2Pos.x += sin(t * 0.7 + t2Pos.y * 3.0) * warpAmount * 1.6;
    t2Pos.y += cos(t * 0.8) * warpAmount * 1.5;
    var t2 = sdRoundBox(p - t2Pos, vec2<f32>(0.2, warpedThickness - 0.02), 0.03);
    d = min(d, min(t1, t2));
    
    // "t" with individual warping (second t)
    var t3Pos = vec2<f32>(-2.0, 0.0);
    t3Pos.x += sin(t * 0.75) * warpAmount * 1.7;
    t3Pos.y += cos(t * 0.95 + t3Pos.x) * warpAmount * 1.5;
    var t3 = sdRoundBox(p - t3Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    var t4Pos = vec2<f32>(-2.0, 0.15);
    t4Pos.x += sin(t * 0.7 + t4Pos.y * 3.0) * warpAmount * 1.6;
    t4Pos.y += cos(t * 0.8) * warpAmount * 1.5;
    var t4 = sdRoundBox(p - t4Pos, vec2<f32>(0.2, warpedThickness - 0.02), 0.03);
    d = min(d, min(t3, t4));
    
    // "y" with individual warping
    var y1Pos = vec2<f32>(-1.7, 0.0);
    y1Pos.x += sin(t * 0.75 + y1Pos.y * 2.0) * warpAmount * 1.9;
    y1Pos.y += cos(t * 0.85) * warpAmount * 1.8;
    var y1 = sdRoundBox(p - y1Pos, vec2<f32>(warpedThickness, 0.2), 0.05);
    
    var y2Pos = vec2<f32>(-1.5, 0.0);
    y2Pos.x += sin(t * 0.7 - y2Pos.y) * warpAmount * 1.8;
    y2Pos.y += cos(t * 1.1) * warpAmount * 1.7;
    var y2 = sdRoundBox(p - y2Pos, vec2<f32>(warpedThickness, 0.2), 0.05);
    
    var y3Pos = vec2<f32>(-1.6, -0.2);
    y3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    y3Pos.y += cos(t * 0.75 + y3Pos.x) * warpAmount * 1.6;
    var y3 = sdRoundBox(p - y3Pos, vec2<f32>(warpedThickness, 0.2), 0.05);
    
    d = min(min(y1, y2), min(y3, d));
    
    // Space
    
    // "h" with individual warping
    var h1Pos = vec2<f32>(-0.9, 0.0);
    h1Pos.x += sin(t * 0.75 + h1Pos.y * 2.0) * warpAmount * 1.9;
    h1Pos.y += cos(t * 0.85) * warpAmount * 1.8;
    var h1 = sdRoundBox(p - h1Pos, vec2<f32>(warpedThickness, 0.35), 0.05);
    
    var h2Pos = vec2<f32>(-0.6, 0.0);
    h2Pos.x += sin(t * 0.7 - h2Pos.y) * warpAmount * 1.8;
    h2Pos.y += cos(t * 1.1) * warpAmount * 1.7;
    var h2 = sdRoundBox(p - h2Pos, vec2<f32>(warpedThickness, 0.35), 0.05);
    
    var h3Pos = vec2<f32>(-0.75, 0.05);
    h3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    h3Pos.y += cos(t * 0.75 + h3Pos.x) * warpAmount * 1.6;
    var h3 = sdRoundBox(p - h3Pos, vec2<f32>(0.2, warpedThickness), 0.05);
    
    d = min(min(h1, h2), min(h3, d));
    
    // "a" with individual warping
    var a1Pos = vec2<f32>(-0.3, 0.0);
    a1Pos.x += sin(t * 0.72 + a1Pos.y * 1.8) * warpAmount * 1.8;
    a1Pos.y += cos(t * 0.67) * warpAmount * 1.9;
    var a1 = length(p - a1Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var a1i = length(p - a1Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var a2Pos = vec2<f32>(-0.1, 0.0);
    a2Pos.x += sin(t * 0.68) * warpAmount * 1.8;
    a2Pos.y += cos(t * 0.86 + a2Pos.x * 1.7) * warpAmount * 1.9;
    var a2 = sdRoundBox(p - a2Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    d = min(d, min(max(-a1i, a1), a2));
    
    // "n" with individual warping
    var n1Pos = vec2<f32>(0.2, 0.0);
    n1Pos.x += sin(t * 0.8 + n1Pos.y) * warpAmount * 2.0;
    n1Pos.y += cos(t * 0.9) * warpAmount * 1.5;
    var n1 = sdRoundBox(p - n1Pos, vec2<f32>(warpedThickness, 0.35), 0.05);
    
    var n2Pos = vec2<f32>(0.4, 0.1);
    n2Pos.x += sin(t * 0.7 - n2Pos.y) * warpAmount * 1.8;
    n2Pos.y += cos(t * 1.1) * warpAmount * 1.7;
    var n2 = sdRoundBox(p - n2Pos, vec2<f32>(warpedThickness, 0.25), 0.05);
    
    var n3Pos = vec2<f32>(0.3, 0.0);
    n3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    n3Pos.y += cos(t * 0.75 + n3Pos.x) * warpAmount * 1.6;
    var n3 = length(p - n3Pos) - 0.17 * (1.0 + thicknessWarp);
    
    d = min(max(-n3, min(n1, n2)), d);
    
    // "d" with individual warping
    var d1Pos = vec2<f32>(0.8, 0.0);
    d1Pos.x += sin(t * 0.65 + d1Pos.y * 2.0) * warpAmount * 1.9;
    d1Pos.y += cos(t * 0.85) * warpAmount * 1.8;
    var d1 = length(p - d1Pos) - circleOuterFactor * (1.0 + thicknessWarp);
    var d1i = length(p - d1Pos) - circleInnerFactor * (1.0 + thicknessWarp);
    
    var d2Pos = vec2<f32>(1.0, 0.0);
    d2Pos.x += sin(t * 0.75) * warpAmount * 1.7;
    d2Pos.y += cos(t * 0.95 + d2Pos.x) * warpAmount * 1.5;
    var d2 = sdRoundBox(p - d2Pos, vec2<f32>(warpedThickness, 0.35), 0.03);
    
    d = min(d, min(max(-d1i, d1), d2));
    
    // "s" with individual warping
    var s1Pos = vec2<f32>(1.4, 0.1);
    s1Pos.x += sin(t * 0.8 + s1Pos.y) * warpAmount * 2.0;
    s1Pos.y += cos(t * 0.9) * warpAmount * 1.5;
    var s1 = length(p - s1Pos) - 0.17 * (1.0 + thicknessWarp);
    var s1i = length(p - s1Pos) - 0.08 * (1.0 + thicknessWarp);
    
    var s2Pos = vec2<f32>(1.4, -0.1);
    s2Pos.x += sin(t * 0.7 - s2Pos.y) * warpAmount * 1.8;
    s2Pos.y += cos(t * 1.1) * warpAmount * 1.7;
    var s2 = length(p - s2Pos) - 0.17 * (1.0 + thicknessWarp);
    var s2i = length(p - s2Pos) - 0.08 * (1.0 + thicknessWarp);
    
    var s3Pos = vec2<f32>(1.4, 0.0);
    s3Pos.x += sin(t * 0.9) * warpAmount * 1.5;
    s3Pos.y += cos(t * 0.75 + s3Pos.x) * warpAmount * 1.6;
    var s3 = sdRoundBox(p - s3Pos, vec2<f32>(0.03, 0.25), 0.05);
    
    d = min(d, min(max(-s1i, s1), min(max(-s2i, s2), s3)));
    
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