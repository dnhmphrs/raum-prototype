struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
};

struct Parameters {
    time: f32,
    radius: f32,
    unused1: f32,
    unused2: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> params: Parameters;

// Function to generate color based on position and time
fn generateSphereColor(position: vec3<f32>, time: f32) -> vec3<f32> {
    // Calculate height-based coloring (y-coordinate)
    let normalizedHeight = (position.y + 1.0) * 0.5; // Map from [-1, 1] to [0, 1]
    
    // Create a flowing color pattern
    let wave = sin(position.x * 3.0 + time) * 0.5 + 0.5;
    let ripple = cos(position.z * 4.0 + time * 0.7) * 0.5 + 0.5;
    
    // Base colors for the sphere
    let deepColor = vec3<f32>(0.0, 0.2, 0.6);   // Deep blue
    let midColor = vec3<f32>(0.0, 0.6, 0.8);    // Cyan
    let surfaceColor = vec3<f32>(0.8, 0.9, 1.0); // Light blue-white
    
    // Mix colors based on height and wave patterns
    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.5) {
        finalColor = mix(deepColor, midColor, normalizedHeight * 2.0);
    } else {
        finalColor = mix(midColor, surfaceColor, (normalizedHeight - 0.5) * 2.0);
    }
    
    // Add wave and ripple effects
    finalColor = mix(finalColor, surfaceColor, wave * ripple * 0.3);
    
    return finalColor;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Scale the sphere by the radius parameter
    let scaledPosition = position * params.radius;
    
    // Store world position
    output.worldPos = scaledPosition;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(scaledPosition, 1.0);
    
    // For a sphere, the normal at any point is just the normalized position vector
    output.normal = normalize(position);
    
    // Generate color based on position and time
    output.color = generateSphereColor(position, params.time);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
    // Enhanced lighting
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.2;
    
    // Add specular highlighting for the sphere
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.5;
    
    // Combine lighting components
    let lighting = ambient + diffuse * 0.7 + specular;
    
    // Add a subtle rim lighting effect
    let rim = 1.0 - max(dot(normal, view_dir), 0.0);
    let rimLighting = pow(rim, 3.0) * 0.3;
    
    // Final color with all lighting effects
    let finalColor = color * lighting + vec3<f32>(0.4, 0.6, 1.0) * rimLighting;
    
    return vec4<f32>(finalColor, 1.0);
}