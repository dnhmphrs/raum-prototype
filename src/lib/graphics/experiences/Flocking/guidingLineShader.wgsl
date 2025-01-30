// guidingLineShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;

@vertex
fn vertex_main(@location(0) vertexPosition: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(vertexPosition, 1.0);
    return out;
}

@fragment
fn fragment_main() -> @location(0) vec4<f32> {
    // Solid red color for the line
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}