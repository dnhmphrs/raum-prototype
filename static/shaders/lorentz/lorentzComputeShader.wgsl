struct Params {
    sigma: f32,
    rho: f32,
    beta: f32,
    dt: f32,
    time: f32,
    numPoints: u32,
    padding1: u32,
    padding2: u32,
}

struct Vertex {
    position: vec3<f32>,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> vertices: array<Vertex>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.numPoints) {
        return;
    }
    
    // Generate a more visible spiral pattern for debugging
    let t = f32(idx) / f32(params.numPoints) * 20.0;
    let x = sin(t + params.time) * t * 0.2;
    let y = cos(t + params.time) * t * 0.2;
    let z = t * 0.2;
    
    // Store the result
    vertices[idx].position = vec3<f32>(x, y, z);
} 