@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> activities: array<f32>;
@group(0) @binding(5) var<storage, read> dendrites: array<vec3<f32>>;
@group(0) @binding(6) var<uniform> instanceCount: u32; // Explicit length
@group(0) @binding(7) var<uniform> mousePosition: vec2<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) activity: f32,
    @location(1) isDendrite: f32
};
@vertex
fn vertex_main(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instance: u32,
    @builtin(vertex_index) vertexIndex: u32
) -> VertexOutput {
    var out: VertexOutput;

    if (instance >= instanceCount) {
        // Dendrite rendering
        let dendriteIndex = instance - instanceCount;

        // Dendrites are lines between two points
        let startPosition = dendrites[dendriteIndex * 2u];      // Source position
        let endPosition = dendrites[dendriteIndex * 2u + 1u];  // Target position

        if (vertexIndex == 0u) {
            out.position = projectionMatrix * viewMatrix * vec4<f32>(startPosition, 1.0);
        } else {
            out.position = projectionMatrix * viewMatrix * vec4<f32>(endPosition, 1.0);
        }

        out.isDendrite = 1.0; // Flag as dendrite
        out.activity = 0.0;   // Dendrites don't flash
    } else {
        // Neuron rendering
        let neuronPosition = positions[instance];
        let worldPosition = position + neuronPosition;

        out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);
        out.activity = activities[instance];
        out.isDendrite = 0.0; // Flag as neuron
    }

    return out;
}




@fragment
fn fragment_main(@location(0) activity: f32, @location(1) isDendrite: f32) -> @location(0) vec4<f32> {
    var baseColor: vec4<f32>;
    if (isDendrite > 0.0) {
        baseColor = vec4<f32>(0.8, 0.2, 0.2, 0.15); // Gray for dendrites
    } else {
        let inactiveColor = vec4<f32>(0.8, 0.2, 0.2, 0.1); // Default color
        let activeColor = vec4<f32>(1.0, 0.5, 0.0, 0.8); // Flashing color
        baseColor = mix(inactiveColor, activeColor, activity);
    }

    return vec4<f32>(baseColor);
}
