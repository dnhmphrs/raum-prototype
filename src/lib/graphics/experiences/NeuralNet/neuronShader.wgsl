// Common uniforms
@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(7) var<uniform> mousePosition: vec2<f32>;

// Neuron-specific
@group(0) @binding(3) var<storage, read> positions: array<vec4<f32>>; // Changed to vec4<f32>
@group(0) @binding(4) var<storage, read> activities: array<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) activity: f32,
};

// Vertex shader for neurons
@vertex
fn vertex_main_neuron(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instance: u32,
) -> VertexOutput {
    var out: VertexOutput;
    let neuronPosition = positions[instance].xyz; // Access xyz components
    let worldPosition = position + neuronPosition;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);
    out.activity = activities[instance];
    return out;
}

// Fragment shader for neurons
@fragment
fn fragment_main_neuron(@location(0) activity: f32) -> @location(0) vec4<f32> {
    let inactiveColor = vec4<f32>(0.8, 0.2, 0.2, 0.1); // Default color
    let activeColor = vec4<f32>(1.0, 0.5, 0.0, 0.8); // Flashing color
    let baseColor = mix(inactiveColor, activeColor, activity);
    return baseColor;
}

// Vertex shader for dendrites
@vertex
fn vertex_main_dendrite(
    @location(0) position: vec3<f32>
) -> VertexOutput {
    var out: VertexOutput;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(position, 1.0);
    out.activity = 0.0; // Dendrites don't use activity
    return out;
}

// Fragment shader for dendrites
@fragment
fn fragment_main_dendrite() -> @location(0) vec4<f32> {
    let baseColor = vec4<f32>(0.8, 0.2, 0.2, 0.15); // Color for dendrites
    return baseColor;
}

// Vertex shader for the cube
@vertex
fn vertex_main_cube(
    @location(0) position: vec3<f32>
) -> @builtin(position) vec4<f32> {
    return projectionMatrix * viewMatrix * vec4<f32>(position, 1.0);
}

// Fragment shader for the cube
@fragment
fn fragment_main_cube() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.5, 0.0, 0.8); // Solid white color
}