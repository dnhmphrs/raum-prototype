// positionUpdateShader.wgsl

@group(0) @binding(0) var<uniform> deltaTime: f32;
@group(0) @binding(1) var<storage, read> velocities: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> positions: array<vec3<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= arrayLength(&positions)) {
        return;
    }

    // Update position based on velocity and deltaTime
    positions[index] = positions[index] + velocities[index] * deltaTime * 10;
}