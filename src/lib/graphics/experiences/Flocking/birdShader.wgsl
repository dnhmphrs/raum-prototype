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
fn vertex_main(@location(0) vertexPosition: vec3<f32>, @builtin(instance_index) instance: u32) -> VertexOutput {
    var out: VertexOutput;

    // Get the bird's unique position and phase
    let birdPosition = positions[instance];
    let birdPhase = phases[instance];
    let birdVelocity = velocities[instance];

    // Calculate forward direction (negative velocity for correct orientation)
    let forward = normalize(-birdVelocity);
    let speed = length(birdVelocity);

    // Use a stable up vector calculation
    var up = vec3<f32>(0.0, 1.0, 0.0);
    
    // Handle near-vertical cases
    let upAlignment = abs(dot(forward, up));
    if (upAlignment > 0.99) {
        up = vec3<f32>(0.0, 0.0, 1.0);
    }

    // Calculate right vector
    let right = normalize(cross(forward, up));
    up = normalize(cross(right, forward));

    // Create rotation matrix
    let rotationMatrix = mat3x3<f32>(
        right.x, up.x, forward.x,
        right.y, up.y, forward.y,
        right.z, up.z, forward.z
    );

    // Apply rotation to vertex position
    var rotatedPosition = rotationMatrix * vertexPosition;

    // Combine with bird's global position
    let worldPosition = rotatedPosition + birdPosition;

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // More subtle, ethereal coloring
    let baseColor = vec3<f32>(0.941, 0.941, 0.941);
    let speedFactor = min(speed * 0.1, 1.0);
    
    // Subtle color variation based on position and velocity
    let variation = vec3<f32>(
        sin(birdPosition.x * 0.01 + birdPosition.y * 0.02) * 0.05,
        cos(birdPosition.y * 0.01 - birdPosition.z * 0.02) * 0.05,
        sin(birdPosition.z * 0.01 + birdPosition.x * 0.02) * 0.05
    );

    // Blend colors based on speed
    // out.color = mix(
    //     baseColor + variation,
    //     vec3<f32>(0.95, 0.97, 1.0),
    //     speedFactor
    // );

    // // Set normal for potential lighting
    // out.vNormal = normalize(rotationMatrix * vec3<f32>(0.0, 1.0, 0.0));

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) vNormal: vec3<f32>) -> @location(0) vec4<f32> {
    // Make birds slightly translucent
    return vec4<f32>(color, 1.0);
}