@group(0) @binding(0) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(1) var<uniform> mousePosition: vec2<f32>;

// Constants
const pi = 3.141592653589793;
const k = 1.0;
const terms = 6;

//------------------------------------
// Complex reciprocal:  1/z = conj(z) / |z|^2
// We do S: z -> -1/z, so return - (x - i*y)/|z|^2.
fn mobius_S(z: vec2<f32>) -> vec2<f32> {
    let denom = z.x*z.x + z.y*z.y;
    if (denom < 1e-9) {
        // near zero => just skip or clamp
        return vec2<f32>(1e9, 0.0); // or something
    }
    // -1/z
    return vec2<f32>(
        -z.x / denom,  // real part
         z.y / denom   // imag part
    );
}

//------------------------------------
// z -> z + 1
fn mobius_T(z: vec2<f32>) -> vec2<f32> {
    // Just add (1,0) in real-imag space
    return z + vec2<f32>(1.0, 0.0);
}

//------------------------------------
// Basic complex multiply
fn complex_multiply(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(
        a.x*b.x - a.y*b.y,
        a.x*b.y + a.y*b.x
    );
}

//------------------------------------
// Eisenstein E2k series
fn eisensteinE2k(z: vec2<f32>, n_terms: i32) -> vec2<f32> {
    var sum = vec2<f32>(0.0, 0.0);
    for (var m = -n_terms; m <= n_terms; m = m + 1) {
        for (var n = -n_terms; n <= n_terms; n = n + 1) {
            if (m == 0 && n == 0) { continue; }
            let mf = f32(m);
            let nf = f32(n);

            let term = vec2<f32>(mf, 0.0) + complex_multiply(vec2<f32>(nf,0.0), z);
            let norm_sq = term.x*term.x + term.y*term.y;
            if norm_sq == 0.0 { continue; }

            let norm  = pow(norm_sq, -k);
            let angle = (-k*2.0)*atan2(term.y, term.x);
            let c = cos(angle);
            let s = sin(angle);
            sum += norm * vec2<f32>(c, s);
        }
    }
    return sum;
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
    let uv = (fragCoord.xy / viewportSize * 2.0 - vec2<f32>(1.0)) * vec2<f32>(aspect,1.0);

    //-----------------------------------
    // 2) Apply T^n, where n = floor(mouse.x)
    //    i.e. do the shift z -> z + n
    //-----------------------------------
    var z = uv;
    // let n = floor(mousePosition.x);
    // if (n != 0.0) {
    //     // If you prefer a continuous shift, skip floor()
    //     z = z + vec2<f32>(n, 0.0);
    // }

    //-----------------------------------
    // 3) Blend Identity with S: z-> -1/z
    //    Use mouse.y in [0,1] for a simple blend
    //-----------------------------------
    let t = clamp(mousePosition.y * 10.0, 0.0, 10.0);
    let zS = mobius_S(z);
    // linear blend in 2D => NOT a strict Möbius transform,
    // but a continuous “morph” from z to -1/z
    z = mix(z, zS, t);

    // Evaluate E2k
    let e2k = eisensteinE2k(z, terms);

    // Map real & imag => color
    let color = vec3<f32>(
        0.5*e2k.x + 0.5,
        0.5*e2k.y + 0.5,
        1.0 - (0.5*e2k.x + 0.5*e2k.y)
    );
    return vec4<f32>(color, 1.0);
}
