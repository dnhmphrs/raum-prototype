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
    
    // Calculate the position in the attractor based on time and index
    let t = params.time + f32(idx) * 0.0001;
    
    // Initial point
    var x: f32 = 0.1;
    var y: f32 = 0.0;
    var z: f32 = 0.0;
    
    // Integrate the Lorentz equations
    let steps: u32 = 100u;
    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        let dx = params.sigma * (y - x);
        let dy = x * (params.rho - z) - y;
        let dz = x * y - params.beta * z;
        
        x += dx * params.dt;
        y += dy * params.dt;
        z += dz * params.dt;
    }
    
    // Store the result
    vertices[idx].position = vec3<f32>(x, y, z);
} 