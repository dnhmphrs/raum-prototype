struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) height: f32 // Store the actual height value
};

struct TimeUniform {
    unused: vec3<f32>,
    time: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;

// Function to generate color based on height using a grid cell research colormap
fn gridCellColormap(height: f32) -> vec3<f32> {
    // Base color is dark blue (background/flat areas)
    if (height <= 0.0) {
        return vec3<f32>(0.0, 0.0, 0.4);
    }
    
    // For positive heights, use a yellow-to-red gradient
    // Normalize height to [0, 1] range with a fixed maximum
    let maxHeight = 0.2;
    let normalizedHeight = min(height / maxHeight, 1.0);
    
    // Yellow to orange to red gradient for peaks
    if (normalizedHeight < 0.5) {
        // Yellow to orange
        return mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.5, 0.0), normalizedHeight * 2.0);
    } else {
        // Orange to red
        return mix(vec3<f32>(1.0, 0.5, 0.0), vec3<f32>(1.0, 0.0, 0.0), (normalizedHeight - 0.5) * 2.0);
    }
}

// Function to create a hexagonal pattern
fn createHexagonalPattern(position: vec2<f32>, time: f32) -> f32 {
    // Slower time evolution for smoother animation
    let t = time * 0.1;
    
    // Create three wave directions at 60° angles for hexagonal pattern
    let k1 = vec2<f32>(1.0, 0.0);                // 0°
    let k2 = vec2<f32>(0.5, 0.866);              // 60°
    let k3 = vec2<f32>(0.5, -0.866);             // -60°
    
    // Add slow drift to the pattern
    let drift_x = sin(t * 0.2) * 0.3;
    let drift_y = cos(t * 0.3) * 0.3;
    let pos = position + vec2<f32>(drift_x, drift_y);
    
    // Create waves with different phases
    let wave1 = cos(dot(k1, pos) * 3.14159 + t * 0.2);
    let wave2 = cos(dot(k2, pos) * 3.14159 + t * 0.15);
    let wave3 = cos(dot(k3, pos) * 3.14159 + t * 0.25);
    
    // Combine waves to create hexagonal pattern
    // Linear combination plus interference term
    let pattern = 0.2 * (wave1 + wave2 + wave3) + 0.8 * (wave1 * wave2 * wave3);
    
    return pattern;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position
    output.worldPos = position;
    
    // Get time
    let time = timeUniform.time;
    
    // Scale factor controls zoom level
    let scaleFactor =2.0;
    let scaledPos = vec2<f32>(position.x * scaleFactor, position.y * scaleFactor);
    
    // Calculate height using hexagonal pattern
    let height = createHexagonalPattern(scaledPos, time) * 0.2;
    
    // Store the actual height for fragment shader
    output.height = height;
    
    // Create modified position - use max(0, height) for z to create flat areas
    var modifiedPosition = position;
    modifiedPosition.z = max(0.0, height);
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal
    if (height <= 0.0) {
        // Flat area - normal points straight up
        output.normal = vec3<f32>(0.0, 0.0, 1.0);
    } else {
        // For non-flat areas, calculate normal from neighboring points
        let epsilon = 0.01;
        let pos1 = scaledPos + vec2<f32>(epsilon, 0.0);
        let pos2 = scaledPos + vec2<f32>(0.0, epsilon);
        
        let height1 = max(0.0, createHexagonalPattern(pos1, time) * 0.2);
        let height2 = max(0.0, createHexagonalPattern(pos2, time) * 0.2);
        
        let tangent1 = vec3<f32>(epsilon, 0.0, height1 - modifiedPosition.z);
        let tangent2 = vec3<f32>(0.0, epsilon, height2 - modifiedPosition.z);
        
        output.normal = normalize(cross(tangent1, tangent2));
    }
    
    // Set color based on the SAME height value used for geometry
    output.color = gridCellColormap(height);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) height: f32
) -> @location(0) vec4<f32> {
    // Enhanced lighting
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.2;
    
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.6;
    
    let lighting = ambient + diffuse * 0.8 + specular;
    
    // Add subtle pattern to flat areas
    var finalColor = color;
    if (height <= 0.0) {
        let pattern = sin(worldPos.x * 20.0) * sin(worldPos.y * 20.0) * 0.05;
        finalColor = vec3<f32>(0.0, 0.0, 0.4 + pattern);
    }
    
    return vec4<f32>(finalColor * lighting, 1.0);
} 