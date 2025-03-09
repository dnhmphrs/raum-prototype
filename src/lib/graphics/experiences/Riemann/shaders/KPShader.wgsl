struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
};

struct TimeUniform {
    unused: vec3<f32>,
    time: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;

// Function to generate color based on height
fn heightColor(height: f32, time: f32) -> vec3<f32> {
    // Map height to a normalized range [0, 1]
    let normalizedHeight = (height + 0.5) * 1.0;
    
    // Create a color gradient based on height
    // Blue (low) -> Cyan (middle) -> Yellow (high)
    let lowColor = vec3<f32>(0.0, 0.2, 0.8); // Deep blue for valleys
    let midColor = vec3<f32>(0.0, 0.8, 0.8); // Cyan for mid-levels
    let highColor = vec3<f32>(1.0, 0.8, 0.0); // Yellow for peaks
    
    // Two-step gradient
    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.5) {
        // Map from low to mid
        finalColor = mix(lowColor, midColor, normalizedHeight * 2.0);
    } else {
        // Map from mid to high
        finalColor = mix(midColor, highColor, (normalizedHeight - 0.5) * 2.0);
    }
    
    return finalColor;
}

// Function to create a hexagonal Omega matrix for shallow water wave patterns
fn createHexagonalOmega(time: f32) -> mat3x3<f32> {
    // Slower time evolution for smoother animation
    let t = time * 0.05;
    
    // Create a matrix that produces hexagonal patterns
    // For hexagonal patterns, we need specific relationships between the matrix elements
    
    // Base matrix with hexagonal symmetry (60-degree rotational symmetry)
    let a = 1.0 + 0.2 * sin(t);
    let b = 0.5 * cos(t * 0.7);
    
    // This matrix structure helps create hexagonal patterns
    // The ratio of diagonal to off-diagonal elements is important
    let B = mat3x3<f32>(
        a, b/2.0, 0.0,
        b/2.0, a, 0.0,
        0.0, 0.0, a/2.0
    );
    
    // Compute A = B^T * B to ensure positive definiteness
    return transpose(B) * B;
}

// Base phase vectors - adjusted for more detailed waves
// These vectors control the wave directions and frequencies
const baseK = vec3<f32>(0.6, 0.0, 0.0);  // Primary x-direction - increased frequency
const baseL = vec3<f32>(0.3, 0.52, 0.0); // 60° offset for hexagonal pattern - increased frequency
const baseM = vec3<f32>(0.3, -0.52, 0.0); // -60° offset for hexagonal pattern - increased frequency

// Function to compute the KP solution with more detailed waves
fn kpSolutionSmooth(z: vec3<f32>, Omega: mat3x3<f32>, time: f32) -> f32 {
    var sum: f32 = 0.0;
    
    // Use fewer terms for smoother appearance
    // We'll use a combination of 3 wave directions with harmonics
    
    // Primary wave in x direction
    let phase1 = dot(baseK, z) + 0.2 * time;
    sum += 0.4 * cos(6.28318 * phase1);
    
    // Secondary wave at 60 degrees
    let phase2 = dot(baseL, z) + 0.15 * time;
    sum += 0.3 * cos(6.28318 * phase2);
    
    // Tertiary wave at -60 degrees
    let phase3 = dot(baseM, z) + 0.25 * time;
    sum += 0.3 * cos(6.28318 * phase3);
    
    // Add some harmonics for more natural appearance
    sum += 0.15 * cos(12.56636 * phase1); // 2x frequency
    sum += 0.1 * cos(12.56636 * phase2); // 2x frequency
    sum += 0.1 * cos(12.56636 * phase3); // 2x frequency
    
    // Add interference pattern for hexagonal structure
    // This creates the hexagonal peaks where the three wave systems constructively interfere
    let interference = cos(6.28318 * phase1) * cos(6.28318 * phase2) * cos(6.28318 * phase3);
    sum += 0.3 * interference;
    
    return sum;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for coloring
    output.worldPos = position;
    
    // Get time
    let time = timeUniform.time;
    
    // Create hexagonal Omega matrix
    let hexOmega = createHexagonalOmega(time);
    
    // Calculate the phase variable z
    // Scale for more detailed appearance - less zoomed out
    let scaleFactor = 1.0; // No scaling to see full detail
    let x = position.x * scaleFactor;
    let y = position.y * scaleFactor;
    let z = vec3<f32>(x, y, 0.0);
    
    // Calculate the KP solution
    let kpValue = kpSolutionSmooth(z, hexOmega, time);
    
    // Create a modified position with KP solution as z-coordinate
    // Scale height for better visibility
    var modifiedPosition = position;
    modifiedPosition.z = kpValue * 0.2; // Moderate amplitude for clear wave patterns
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal (approximate)
    let epsilon = 0.01;
    let dx = vec3<f32>(epsilon, 0.0, 0.0);
    let dy = vec3<f32>(0.0, epsilon, 0.0);
    
    // Calculate neighboring points for normal calculation
    let zx = vec3<f32>(x + epsilon, y, 0.0);
    let zy = vec3<f32>(x, y + epsilon, 0.0);
    
    let heightX = kpSolutionSmooth(zx, hexOmega, time) * 0.2;
    let heightY = kpSolutionSmooth(zy, hexOmega, time) * 0.2;
    
    let tangentX = vec3<f32>(dx.x, 0.0, heightX - modifiedPosition.z);
    let tangentY = vec3<f32>(0.0, dy.y, heightY - modifiedPosition.z);
    
    output.normal = normalize(cross(tangentX, tangentY));
    
    // Generate color based on height
    output.color = heightColor(modifiedPosition.z, time);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
    // Enhanced lighting with fixed view direction
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.3;
    
    // Use a fixed view direction for specular to avoid zoom issues
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.3;
    
    // Combine lighting components
    let lighting = ambient + diffuse * 0.6 + specular;
    
    return vec4<f32>(color * lighting, 1.0);
} 