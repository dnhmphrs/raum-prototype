@group(0) @binding(0) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(1) var<uniform> mousePosition: vec2<f32>;

// Constants
const pi = 3.14159265358979323846;
const k = 1.0;
const terms = 12;

// Function for complex multiplication
fn complex_multiply(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(
        a.x * b.x - a.y * b.y, // Real part
        a.x * b.y + a.y * b.x  // Imaginary part
    );
}

// Mobius transform to map the upper half-plane to the Poincaré disc
fn mobius_transform(z: vec2<f32>) -> vec2<f32> {
    let denom = z.x * z.x + (1.0 + z.y) * (1.0 + z.y);
    return vec2<f32>(
        2.0 * z.x / denom,          // x-coordinate
        (z.x * z.x + z.y * z.y - 1.0) / denom // y-coordinate
    );
}

// Eisenstein Series E2k implementation
fn eisensteinE2k(z: vec2<f32>, n_terms: i32) -> vec2<f32> {
    var sum = vec2<f32>(0.0, 0.0); // Initialize (real part, imaginary part) of the sum

    for (var m = -n_terms; m <= n_terms; m = m + 1) {
        for (var n = -n_terms; n <= n_terms; n = n + 1) {
            if (m == 0 && n == 0) {
                continue; // Skip the (0,0) term to avoid division by zero
            }

            let m_f32 = f32(m);
            let n_f32 = f32(n);

            // Compute the complex value (m + n * z)
            let term = vec2<f32>(m_f32, 0.0) + complex_multiply(vec2<f32>(n_f32, 0.0), z);
            let norm_squared = term.x * term.x + term.y * term.y;

            if (norm_squared == 0.0) {
                continue;
            }

            // Compute (m + n * z)^-2k
            let norm = pow(norm_squared, -k); // (m + n * z)^-k magnitude
            let angle = (-k * 2.0) * atan2(term.y, term.x); // Argument multiplied by -2k
            let exp_component = vec2<f32>(cos(angle), sin(angle));

            // Multiply magnitude by exponential component
            let result = norm * exp_component;

            // Accumulate real and imaginary parts in the sum
            sum += result;
        }
    }

    return sum; // Return the complex result as (real, imaginary)
}

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    // Full screen triangle setup
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),  // Bottom-left corner
        vec2<f32>(3.0, -1.0),   // Bottom-right (extends past to cover right)
        vec2<f32>(-1.0, 3.0)    // Top-left (extends past to cover top)
    );
    return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Aspect ratio calculation
    let aspectRatio = viewportSize.x / viewportSize.y;

    // Normalize coordinates to [-1.0, 1.0] with center at (0,0), adjusted for aspect ratio
    let screenCoord = ((fragCoord.xy / viewportSize) * 2.0 - vec2<f32>(1.0)) * vec2<f32>(aspectRatio, 1.0);

    // Define z in the upper half-plane based on screen coordinates
    let z = vec2<f32>(screenCoord.x * 1.0, abs(screenCoord.y * 1.0));

    // Map z to the Poincaré disc using the Mobius transform
    let poincare_z = mobius_transform(z);

    // Compute the Eisenstein series E2k
    let eisenstein = eisensteinE2k(poincare_z, terms); // Compute with terms for approximation

    // Map the real and imaginary parts of the Eisenstein series to RGB color channels
    let color = vec3<f32>(
        eisenstein.x * 0.5 + 0.5, // Map real part to [0,1] range for red channel
        eisenstein.y * 0.5 + 0.5, // Map imaginary part to [0,1] range for green channel
        1.0 - (eisenstein.x * 0.5 + eisenstein.y * 0.5) // Invert for blue channel for contrast
    );

    return vec4<f32>(color, 1.0);
}