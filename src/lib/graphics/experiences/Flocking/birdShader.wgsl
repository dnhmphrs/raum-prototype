// birdShader.wgsl

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> phases: array<f32>;
@group(0) @binding(5) var<uniform> mousePosition: vec2<f32>;
@group(0) @binding(6) var<storage, read> velocities: array<vec3<f32>>; // Velocity Buffer

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

// Simple hash function to generate pseudo-random variation
fn hash(value: f32) -> f32 {
    return fract(sin(value) * 43758.5453123);
}

@vertex
fn vertex_main(@location(0) position: vec3<f32>, @builtin(instance_index) instance: u32) -> VertexOutput {
    var out: VertexOutput;

    // Get the bird's unique position and phase
    let birdPosition = positions[instance];
    let birdPhase = phases[instance];

    // Get bird's velocity for potential wing animation based on movement
    let birdVelocity = velocities[instance];
    let speed = length(birdVelocity);

    // Copy the original position to avoid unintended modifications
    var animatedPosition = position;

    // Deform the wings along the y-axis based on phase and speed
    if (position.x > 0.0) { // Right wing (x > 0.0)
        animatedPosition.y -= sin(birdPhase) * 10.0 + speed * 0.5; // Flap motion influenced by speed
    } else if (position.x < 0.0) { // Left wing (x < 0.0)
        animatedPosition.y -= sin(birdPhase) * 10.0 + speed * 0.5; // Symmetric flap in opposite direction
    }

    // Combine the animated vertex with the bird's global position
    let worldPosition = animatedPosition + birdPosition;

    // Transform the world position using the projection and view matrices
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // Assign distinct colors for the body and wings
    var bodyColor = vec3<f32>(0.8, 0.5, 0.2); // Body color (e.g., brownish)
    var wingColor = vec3<f32>(0.2, 0.6, 0.8); // Wing color (e.g., bluish)

    // Determine if the vertex belongs to the wings or the body
    if (position.z > 15.0 || position.z < -15.0) {
        // Wings (based on z-coordinates in bird geometry)
        out.color = wingColor;
    } else {
        // Body
        out.color = bodyColor;
    }

    // Apply global variation to both the body and wings
    let globalVariation = vec3<f32>(
        hash(birdPosition.x) * 0.5,
        hash(birdPosition.y) * 0.5,
        hash(birdPosition.z) * 0.5
    );
    out.color += globalVariation;

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
}