@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> phases: array<f32>;
@group(0) @binding(5) var<uniform> mousePosition: vec2<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

@vertex
fn vertex_main(@location(0) position: vec3<f32>, @builtin(instance_index) instance: u32) -> VertexOutput {
    var out: VertexOutput;

    // Fetch the bird's position and phase
    let birdPosition = positions[instance];
    let birdPhase = phases[instance];

    // Create a copy of the position for animation
    var animatedPosition = position;

    // Animate the wings
    if (position.z > 15.0) { // Right wing (z > 15)
        animatedPosition.y += sin(birdPhase) * 5.0; // Flap along the y-axis
    } else if (position.z < -15.0) { // Left wing (z < -15)
        animatedPosition.y += sin(birdPhase) * 5.0; // Flap symmetrically
    }

    // Combine animated position with the bird's global position
    let worldPosition = animatedPosition + birdPosition;

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // Compute a unique color for each bird based on its position
    out.color = vec3<f32>(
        0.5 + birdPosition.x / 20.0,
        0.5 + birdPosition.y / 20.0,
        0.5 + birdPosition.z / 20.0
    );

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
}
