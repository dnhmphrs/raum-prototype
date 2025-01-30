// predatorShader.wgsl

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> predatorPosition: vec3<f32>;
@group(0) @binding(4) var<storage, read> predatorVelocity: vec3<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) vNormal: vec3<f32>,
};

@vertex
fn vertex_main(@location(0) vertexPosition: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;

    // Simple transformation without instancing
    let worldPosition = vertexPosition + predatorPosition;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // Assign a distinct color (e.g., red) for the predator
    out.color = vec3<f32>(1.0, 0.0, 0.0);

    // Simple normal calculation (optional)
    out.vNormal = normalize(vertexPosition);

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) vNormal: vec3<f32>) -> @location(0) vec4<f32> {
    // Simple lighting
    // let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    // let lightIntensity = max(dot(vNormal, lightDir), 0.0);
    // let finalColor = color * lightIntensity;
    return vec4<f32>(color, 1.0);
}