// backgroundShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

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
    // Normalize the y-coordinate from -1.0 to 1.0 to 0.0 to 1.0
    let t = (fragPos.y + 1.0) / 2.0;
    
    // Define gradient colors
    let bottomColor = vec3<f32>(0.878, 0.914, 0.980); // Soft Blue
    let topColor = vec3<f32>(0.380, 0.451, 0.702);    // Gentle Purple
    //let topColor = vec3<f32>((0.314, 0.282, 0.239)
    
    // Interpolate between bottomColor and topColor based on t
    let color = mix(bottomColor, topColor, t);
    
    return vec4<f32>(color, 1.0);
}
