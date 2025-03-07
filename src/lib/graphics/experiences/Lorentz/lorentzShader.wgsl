struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

@group(0) @binding(0) var<uniform> viewport: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Scale the attractor to fit the screen better
    let scale = 0.03; // Increased from 0.02
    let scaled = position * scale;
    
    // Center the attractor
    output.position = vec4<f32>(
        scaled.x * viewport.y / viewport.x,  // Adjust for aspect ratio
        scaled.y,
        scaled.z * 0.5,
        1.0
    );
    
    // More vibrant color based on position
    output.color = vec3<f32>(
        sin(scaled.x * 0.5) * 0.5 + 0.5,
        cos(scaled.y * 0.5) * 0.5 + 0.5,
        sin(scaled.z * 0.5) * 0.5 + 0.5
    );
    
    return output;
}

@fragment
fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
} 