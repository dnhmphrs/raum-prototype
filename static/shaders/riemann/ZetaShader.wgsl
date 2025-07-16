// ZetaShader.wgsl - Riemann Zeta Function Surface with Prime Frequencies
// Creates a surface with prime waves where wave p has frequency log(p) and amplitude 1/p

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1)
var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2)
var<uniform> uniforms: vec4<f32>;
// [unused, unused, unused, time]
@group(0) @binding(3)
var<uniform> zetaParams: vec4<f32>;
// [numPrimes, scale, unused, unused]

// Pre-computed list of first 50 primes
const PRIMES = array<i32, 50>(2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229);

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;

    let time = uniforms.w;
    let numPrimes = i32(zetaParams.x);
    let scale = zetaParams.y;

    // Calculate zeta surface height using prime frequencies
    var height: f32 = 0.0;

    // Sum waves for first numPrimes primes with frequency log(p) and amplitude 1/p
    for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
        let p = PRIMES[i];
        let pf = f32(p);
        let frequency = log(pf) * scale;
        let amplitude = 1.0 / pf;

        // Distance from center for radial waves
        let dist = length(position.xy);

        // Create wave with time animation
        let wave = amplitude * sin(dist * frequency + time * 2.0);
        height += wave;
    }

    // Apply the height to the z-coordinate
    let worldPosition = vec3<f32>(position.x, position.y, height);
    output.worldPosition = worldPosition;

    // Calculate normal by finite differences for lighting
    let epsilon = 0.01;

    // Sample nearby points for normal calculation
    var heightX: f32 = 0.0;
    var heightY: f32 = 0.0;

    for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
        let p = PRIMES[i];
        let pf = f32(p);
        let frequency = log(pf) * scale;
        let amplitude = 1.0 / pf;

        let distX = length(vec2<f32>(position.x + epsilon, position.y));
        let distY = length(vec2<f32>(position.x, position.y + epsilon));

        heightX += amplitude * sin(distX * frequency + time * 2.0);
        heightY += amplitude * sin(distY * frequency + time * 2.0);
    }

    let dx = vec3<f32>(epsilon, 0.0, heightX - height);
    let dy = vec3<f32>(0.0, epsilon, heightY - height);

    output.normal = normalize(cross(dx, dy));

    output.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Light direction
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));

    // Basic diffuse lighting
    let diffuse = max(dot(input.normal, lightDir), 0.0);

    // Color based on height and prime wave contribution
    let height = input.worldPosition.z;
    let numPrimes = zetaParams.x;

    // Color transitions based on prime-based zeta function properties
    var color: vec3<f32>;

    if (height > 0.0) {
        // Positive values - cool colors (blue to cyan)
        let intensity = min(height * 2.0, 1.0);
        color = mix(vec3<f32>(0.0, 0.4, 0.8), vec3<f32>(0.0, 0.8, 1.0), intensity);
    }
    else {
        // Negative values - warm colors (red to orange)
        let intensity = min(- height * 2.0, 1.0);
        color = mix(vec3<f32>(0.8, 0.2, 0.0), vec3<f32>(1.0, 0.4, 0.0), intensity);
    }

    // Add prime count influence to color
    let primeInfluence = numPrimes / 50.0;
    // Normalize assuming max 50 primes
    color = mix(color, vec3<f32>(0.5, 0.5, 0.5), primeInfluence * 0.3);

    // Apply lighting
    color = color * (0.3 + 0.7 * diffuse);

    return vec4<f32>(color, 1.0);
}