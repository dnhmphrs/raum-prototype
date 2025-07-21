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
// [unused, unused, manualPhase, time]
@group(0) @binding(3)
var<uniform> zetaParams: vec4<f32>;
// [numPrimes, scale, scalingMode, phaseMode]
// scalingMode: 0=log, 1=quadratic/theta
// phaseMode: 0=auto, 1=manual
@group(0) @binding(4)
var<uniform> geometryParams: vec4<f32>;
// [geometryMode, unused, unused, unused]
// geometryMode: 0=euclidean, 1=poincare disc

// Pre-computed list of first 50 primes
const PRIMES = array<i32, 50>(2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229);

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;

    let time = uniforms.w;
    let manualPhase = uniforms.z;
    let numPrimes = i32(zetaParams.x);
    let scale = zetaParams.y;
    let scalingMode = zetaParams.z;
    let phaseMode = zetaParams.w;
    let geometryMode = geometryParams.x;
    
    // Transform position based on geometry mode
    var transformedPos: vec2<f32>;
    var isInsideDisc: bool = true;

    if (geometryMode == 1.0) {
        // Poincaré disc transformation
        let scaleToDisc = 5.0;
        let euclideanPos = position.xy / scaleToDisc;
        let r = length(euclideanPos);
        
        // Check if we're inside the unit disc
        if (r >= 1.0) {
            isInsideDisc = false;
            transformedPos = euclideanPos * scaleToDisc; // Will be discarded anyway
        } else {
            // Use the original Euclidean coordinates scaled to the disc
            // In Poincaré disc model, we work directly with the disc coordinates
            transformedPos = euclideanPos;
        }
    } else {
        // Euclidean geometry (default)
        transformedPos = position.xy;
    }

    // Calculate zeta surface height using prime frequencies
    var height: f32 = 0.0;
    // Determine phase
    let phase = select(time, manualPhase, phaseMode == 1.0);

    // Only calculate waves if inside disc (for Poincaré mode)
    if (geometryMode == 0.0 || isInsideDisc) {
        // Sum waves for first numPrimes primes
        for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
            let p = PRIMES[i];
            let pf = f32(p);
            
            // In Poincaré mode, use unit frequency (no scaling)
            let frequency = select(log(pf) * scale, pf * scale, scalingMode == 1.0);
            let amplitude = 1.0 / pf;
            
            // Calculate distance based on geometry
            var dist: f32;
            if (geometryMode == 1.0) {
                // Hyperbolic distance in Poincaré disc
                let r = length(transformedPos);
                dist = log((1.0 + r) / (1.0 - r)); // Hyperbolic distance to origin
            } else {
                // Euclidean distance
                dist = length(transformedPos);
            }
            
            // Create wave with phase (auto or manual)
            let wave = amplitude * sin(dist * frequency + phase * 2.0);
            height += wave;
        }
    }

    // Apply the height to the z-coordinate
    let worldPosition = vec3<f32>(position.x, position.y, height);
    output.worldPosition = worldPosition;

    // Calculate normal by finite differences for lighting
    let epsilon = 0.01;

    // Update normal calculation to handle Poincaré mode
    var heightX: f32 = 0.0;
    var heightY: f32 = 0.0;

    if (geometryMode == 0.0 || isInsideDisc) {
        for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
            let p = PRIMES[i];
            let pf = f32(p);
            
            let frequency = select(log(pf) * scale, pf * scale, scalingMode == 1.0);
            let amplitude = 1.0 / pf;
            
            // Calculate distances for normal
            var distX: f32;
            var distY: f32;
            
            if (geometryMode == 1.0) {
                // Hyperbolic distances for gradient
                let posX = vec2<f32>(transformedPos.x + epsilon, transformedPos.y);
                let posY = vec2<f32>(transformedPos.x, transformedPos.y + epsilon);
                let rX = length(posX);
                let rY = length(posY);
                distX = log((1.0 + rX) / (1.0 - rX));
                distY = log((1.0 + rY) / (1.0 - rY));
            } else {
                distX = length(vec2<f32>(transformedPos.x + epsilon, transformedPos.y));
                distY = length(vec2<f32>(transformedPos.x, transformedPos.y + epsilon));
            }
            
            heightX += amplitude * sin(distX * frequency + phase * 2.0);
            heightY += amplitude * sin(distY * frequency + phase * 2.0);
        }
    }

    let dx = vec3<f32>(epsilon, 0.0, heightX - height);
    let dy = vec3<f32>(0.0, epsilon, heightY - height);

    output.normal = normalize(cross(dx, dy));

    output.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Check if we're in Poincaré mode and outside the disc
    let geometryMode = geometryParams.x;
    if (geometryMode == 1.0) {
        let discPos = input.worldPosition.xy / 5.0; // Same scale as in vertex shader
        if (length(discPos) >= 1.0) {
            discard; // Don't render outside the unit disc
        }
    }
    
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