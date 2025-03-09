struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) rawHeight: f32 // Add raw height for proper color mapping
};

struct TimeUniform {
    unused: vec3<f32>,
    time: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;

// Function to generate color based on height using a typical grid cell research colormap
// Values below 0 are clamped to 0 in the final color
fn gridCellColormap(height: f32) -> vec3<f32> {
    // Ensure height is not negative (clamp negative values to 0)
    // This creates flat blue areas where the wave is negative
    let adjustedHeight = max(height, 0.0);
    
    // Base color is dark blue (background)
    var color = vec3<f32>(0.0, 0.0, 0.4);
    
    // Fixed maximum height for consistent color mapping
    let maxHeight = 0.2;
    
    // Normalize height to [0, 1] range based on fixed maximum
    let normalizedHeight = min(adjustedHeight / maxHeight, 1.0);
    
    // Use a sharper threshold for better visualization
    if (normalizedHeight > 0.6) {
        // Map the upper range [0.6, 1.0] to [0, 1] for color interpolation
        let t = (normalizedHeight - 0.6) * 2.5; // Compress the range
        let clampedT = clamp(t, 0.0, 1.0);
        
        // Yellow to orange to red gradient for peaks
        if (clampedT < 0.5) {
            // Yellow to orange
            color = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.5, 0.0), clampedT * 2.0);
        } else {
            // Orange to red
            color = mix(vec3<f32>(1.0, 0.5, 0.0), vec3<f32>(1.0, 0.0, 0.0), (clampedT - 0.5) * 2.0);
        }
    } else if (normalizedHeight > 0.2) {
        // Subtle gradient from dark blue to slightly lighter blue for mid-range values
        let t = (normalizedHeight - 0.2) / 0.4; // Map [0.2, 0.6] to [0, 1]
        color = mix(vec3<f32>(0.0, 0.0, 0.4), vec3<f32>(0.0, 0.0, 0.6), t);
    }
    
    return color;
}

// Function to create a hexagonal Omega matrix with more movement
fn createHexagonalOmega(time: f32) -> mat3x3<f32> {
    // Time evolution with moderate speed for visible movement
    let t = time * 0.08;
    
    // Create a matrix that produces hexagonal patterns
    // For hexagonal patterns, we need specific relationships between the matrix elements
    
    // Base matrix with hexagonal symmetry (60-degree rotational symmetry)
    // Add more variation for increased movement
    let a = 1.0 + 0.25 * sin(t);
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

// Base phase vectors for hexagonal patterns
// These vectors control the wave directions and frequencies
const baseK = vec3<f32>(0.5, 0.0, 0.0);  // Primary x-direction
const baseL = vec3<f32>(0.25, 0.433, 0.0); // Exactly 60° offset (cos(60°), sin(60°))
const baseM = vec3<f32>(0.25, -0.433, 0.0); // Exactly -60° offset

// Function to compute the KP solution with cleaner hexagonal patterns and more movement
fn kpSolutionHexagonal(z: vec3<f32>, Omega: mat3x3<f32>, time: f32) -> f32 {
    var sum: f32 = 0.0;
    
    // Time evolution with visible movement but not too fast
    let t = time * 0.1;
    
    // Add a slow drift to the entire pattern
    let drift_x = sin(t * 0.2) * 0.3;
    let drift_y = cos(t * 0.3) * 0.3;
    let z_drift = z + vec3<f32>(drift_x, drift_y, 0.0);
    
    // Primary wave in x direction with movement
    let phase1 = dot(baseK, z_drift) + 0.2 * t;
    
    // Secondary wave at 60 degrees with different movement speed
    let phase2 = dot(baseL, z_drift) + 0.15 * t;
    
    // Tertiary wave at -60 degrees with different movement speed
    let phase3 = dot(baseM, z_drift) + 0.25 * t;
    
    // Create pure hexagonal pattern by combining the three waves
    // This creates a cleaner interference pattern
    let wave1 = cos(6.28318 * phase1);
    let wave2 = cos(6.28318 * phase2);
    let wave3 = cos(6.28318 * phase3);
    
    // Emphasize the hexagonal interference pattern
    // This formula creates peaks where all three waves constructively interfere
    sum = 0.2 * (wave1 + wave2 + wave3) + 0.8 * (wave1 * wave2 * wave3);
    
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
    // Scale factor controls how much of the pattern is visible (zoom level)
    // Lower values = zoom out (see more pattern), higher values = zoom in (see less pattern)
    let scaleFactor = 2.25; // Adjusted scale factor for better visualization
    let x = position.x * scaleFactor;
    let y = position.y * scaleFactor;
    let z = vec3<f32>(x, y, 0.0);
    
    // Calculate the KP solution
    let kpValue = kpSolutionHexagonal(z, hexOmega, time);
    
    // Create a modified position with KP solution as z-coordinate
    var modifiedPosition = position;
    
    // For geometry, we use the actual wave value (can be negative)
    // This creates the proper 3D shape with valleys and peaks
    modifiedPosition.z = kpValue * 0.2;
    
    // Store the raw height for color mapping
    output.rawHeight = kpValue * 0.2;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal (approximate)
    let epsilon = 0.01;
    let dx = vec3<f32>(epsilon, 0.0, 0.0);
    let dy = vec3<f32>(0.0, epsilon, 0.0);
    
    // Calculate neighboring points for normal calculation
    let zx = vec3<f32>(x + epsilon, y, 0.0);
    let zy = vec3<f32>(x, y + epsilon, 0.0);
    
    let heightX = kpSolutionHexagonal(zx, hexOmega, time) * 0.2;
    let heightY = kpSolutionHexagonal(zy, hexOmega, time) * 0.2;
    
    let tangentX = vec3<f32>(dx.x, 0.0, heightX - modifiedPosition.z);
    let tangentY = vec3<f32>(0.0, dy.y, heightY - modifiedPosition.z);
    
    output.normal = normalize(cross(tangentX, tangentY));
    
    // Generate color based on height using the grid cell colormap
    // Negative values will be clamped to 0 in the colormap function
    // This creates flat blue areas where the wave is negative
    output.color = gridCellColormap(output.rawHeight);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) rawHeight: f32
) -> @location(0) vec4<f32> {
    // Enhanced lighting with fixed view direction
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.2; // Adjusted ambient for better visibility of blue areas
    
    // Use a fixed view direction for specular to avoid zoom issues
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.6;
    
    // Combine lighting components with enhanced contrast
    let lighting = ambient + diffuse * 0.8 + specular;
    
    // Apply a special highlight to the flat areas (where height <= 0)
    // This makes the non-negative flatness more visible
    var finalColor = color;
    if (rawHeight <= 0.0) {
        // Add a subtle pattern to flat areas to make them more visible
        let pattern = sin(worldPos.x * 20.0) * sin(worldPos.y * 20.0) * 0.05;
        finalColor = vec3<f32>(0.0, 0.0, 0.4 + pattern);
    }
    
    return vec4<f32>(finalColor * lighting, 1.0);
} 