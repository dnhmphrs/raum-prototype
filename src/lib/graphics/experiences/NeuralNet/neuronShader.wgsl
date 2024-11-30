@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> activities: array<f32>;
@group(0) @binding(5) var<uniform> mousePosition: vec2<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) activity: f32
};

@vertex
fn vertex_main(@location(0) position: vec3<f32>, @builtin(instance_index) instance: u32) -> VertexOutput {
    var out: VertexOutput;

    // Get neuron-specific data
    let neuronPosition = positions[instance];
    let activity = activities[instance];

    // Apply transformations
    let worldPosition = position + neuronPosition;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);
    out.activity = activity;

    return out;
}

@fragment
fn fragment_main(@location(0) activity: f32) -> @location(0) vec4<f32> {
    // Color based on activity level
    let baseColor = vec3<f32>(0.7, 0.2, 0.2); // Default color
    let activeColor = vec3<f32>(0.2, 1.0, 1.0); // Flashing color

    let color = mix(baseColor, activeColor, activity);
    return vec4<f32>(color, 1.0);
}
