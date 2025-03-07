struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

@group(0) @binding(0) var<uniform> viewport: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Very simple transformation - just pass through with minimal scaling
    output.position = vec4<f32>(
        position.x * 0.1,  // Simple scaling
        position.y * 0.1,  // Simple scaling
        0.0,               // Flatten to 2D for debugging
        1.0
    );
    
    // Bright color for visibility
    output.color = vec3<f32>(1.0, 1.0, 0.0); // Bright yellow
    
    return output;
}

@fragment
fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
} 