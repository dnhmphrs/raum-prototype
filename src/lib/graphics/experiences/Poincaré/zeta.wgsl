@group(0) @binding(0) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(1) var<uniform> mousePosition: vec2<f32>;

// Constants
const pi = 3.141592653589793;
const max_terms = 100; // For series approximation
const zeta_zeros = array<f32, 5>(14.134725, 21.022040, 25.010858, 30.424876, 32.935061); // First few non-trivial zeros
const zoom = 0.15; // Adjust zoom factor

//------------------------------------
// Complex multiplication: (a + bi) * (c + di)
fn complex_multiply(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(
        a.x * b.x - a.y * b.y,
        a.x * b.y + a.y * b.x
    );
}

//------------------------------------
// Complex power: (a + bi)^n
fn complex_power(base: vec2<f32>, exp: f32) -> vec2<f32> {
    let r = pow(base.x * base.x + base.y * base.y, 0.5 * exp);
    let theta = atan2(base.y, base.x) * exp;
    return vec2<f32>(r * cos(theta), r * sin(theta));
}

//------------------------------------
// Gamma approximation (as part of functional equation)
fn gamma_approximation(z: vec2<f32>) -> vec2<f32> {
    // Simplistic approximation for gamma function
    let t = vec2<f32>(z.x - 1.0, z.y);
    return complex_power(t, z.x - 0.5) * vec2<f32>(exp(-t.x), exp(-t.y));
}

//------------------------------------
// Zeta function using the Dirichlet series
fn zeta_dirichlet(z: vec2<f32>, terms: i32) -> vec2<f32> {
    var sum = vec2<f32>(0.0, 0.0);
    for (var n = 1; n <= terms; n = n + 1) {
        let nf = f32(n);
        let term = complex_power(vec2<f32>(nf, 0.0), -z.x) * vec2<f32>(cos(-z.y * log(nf)), sin(-z.y * log(nf)));
        sum += term;
    }
    return sum;
}

//------------------------------------
// Functional equation for analytic continuation of zeta
fn zeta_functional_equation(z: vec2<f32>, terms: i32) -> vec2<f32> {
    if (z.x > 1.0) {
        // Direct computation using Dirichlet series
        return zeta_dirichlet(z, terms);
    } else {
        // Reflective functional equation for analytic continuation
        let factor = vec2<f32>(pow(2.0, z.x), 0.0) * 
                     complex_power(vec2<f32>(pi, 0.0), z.x - 1.0) *
                     gamma_approximation(vec2<f32>(1.0 - z.x, -z.y));
        let zeta_reflected = zeta_dirichlet(vec2<f32>(1.0 - z.x, -z.y), terms);
        let sine_term = vec2<f32>(sin(pi * z.x), cos(pi * z.x));
        return factor * sine_term * zeta_reflected;
    }
}

@vertex
fn vertex_main(@builtin(vertex_index) vID: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>,3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    return vec4<f32>(pos[vID], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // 1) Convert to normalized coords [-1,1], fix aspect
    let aspect = viewportSize.x / viewportSize.y;
    let uv = (fragCoord.xy / viewportSize * 2.0 - vec2<f32>(1.0)) * vec2<f32>(aspect, 1.0);

    //-----------------------------------
    // 2) Map uv to complex plane with mouse interaction and zoom
    //-----------------------------------
    let z = uv / zoom + mousePosition.xy * 2.0 - vec2<f32>(1.0, 1.0);

    //-----------------------------------
    // 3) Draw red horizontal lines for zeta zeros
    //-----------------------------------
    var color = vec3<f32>(0.0, 0.0, 0.0);
    for (var i = 0; i < 5; i = i + 1) {
        let zero_positive = zeta_zeros[i] * zoom; // Account for zoom
        let zero_negative = -zeta_zeros[i] * zoom; // Negative zeros
        if (abs(z.y - zero_positive) < 0.01 || abs(z.y - zero_negative) < 0.01) { // Adjust threshold for visibility
            color = vec3<f32>(1.0, 0.0, 0.0);
            break; // Exit loop once a line is detected
        }
    }

    //-----------------------------------
    // 4) Calculate Zeta function
    //-----------------------------------
    if (color.x == 0.0 && color.y == 0.0 && color.z == 0.0) {
        let zeta = zeta_functional_equation(z, max_terms);
        color = vec3<f32>(
            0.5 * zeta.x + 0.5,
            0.5 * zeta.y + 0.5,
            1.0 - (0.5 * zeta.x + 0.5 * zeta.y)
        );
    }
    return vec4<f32>(color, 1.0);
}
