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
    @location(0) color: vec3<f32>,
    @location(1) vNormal: vec3<f32>,
};

@vertex
fn vertex_main(
    @location(0) vertexPosition: vec3<f32>,
    @location(1) birdVertex: f32, // Added birdVertex attribute
    @builtin(instance_index) instance: u32
) -> VertexOutput {
    var out: VertexOutput;

    // Get the bird's unique position and phase
    let birdPosition = positions[instance];
    let birdPhase = phases[instance];
    let birdVelocity = velocities[instance];

    // Calculate orientation based on velocity
    let forward = normalize(-birdVelocity); // Negative to make birds fly in correct direction
    let up = normalize(vec3<f32>(0.1, 1.0, 0.0)); // Small X component prevents zero cross-product
    let right = cross(forward, up);
    let adjustedUp = cross(right, forward);

    // Create a rotation matrix
    let rotationMatrix = mat3x3<f32>(
        right.x, adjustedUp.x, forward.x,
        right.y, adjustedUp.y, forward.y,
        right.z, adjustedUp.z, forward.z
    );

    // Apply rotation to vertex position
    var rotatedPosition = rotationMatrix * vertexPosition;

    // Determine if the vertex is a wing vertex based on birdVertex attribute
    // var wingFlap = 0.0;
    // if (birdVertex >= 3.0 && birdVertex < 6.0) { // Left Wing
    //     wingFlap = sin(birdPhase) * 5.0 + length(birdVelocity) * 0.1;
    //     rotatedPosition.y += wingFlap;
    // } else if (birdVertex >= 6.0 && birdVertex < 9.0) { // Right Wing
    //     wingFlap = sin(birdPhase) * 5.0 + length(birdVelocity) * 0.1;
    //     rotatedPosition.y += wingFlap;
    // }

    // Combine with bird's global position
    let worldPosition = rotatedPosition + birdPosition;

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // Assign color (you can customize this as needed)
    out.color = vec3<f32>(0.0, 0.0, 0.0);

    // Set normal for potential lighting (optional)
    out.vNormal = normalize(rotationMatrix * vec3<f32>(0.0, 1.0, 0.0));

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) vNormal: vec3<f32>) -> @location(0) vec4<f32> {
    // Simple lighting
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    let lightIntensity = max(dot(vNormal, lightDir), 0.0);
    let finalColor = color * lightIntensity;
    return vec4<f32>(finalColor, 1.0);
}
