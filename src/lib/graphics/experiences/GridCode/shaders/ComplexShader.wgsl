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
    // Complex function values typically range from -0.5 to 0.5
    let normalizedHeight = (height + 0.5) * 1.0;
    
    // Create a color gradient based on height
    // Purple (low) -> Blue (middle-low) -> Cyan (middle-high) -> Green (high)
    let color1 = vec3<f32>(0.5, 0.0, 0.8); // Purple
    let color2 = vec3<f32>(0.0, 0.2, 0.8); // Blue
    let color3 = vec3<f32>(0.0, 0.8, 0.8); // Cyan
    let color4 = vec3<f32>(0.0, 0.8, 0.2); // Green
    
    // Multi-step gradient
    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.33) {
        // Map from color1 to color2
        finalColor = mix(color1, color2, normalizedHeight * 3.0);
    } else if (normalizedHeight < 0.66) {
        // Map from color2 to color3
        finalColor = mix(color2, color3, (normalizedHeight - 0.33) * 3.0);
    } else {
        // Map from color3 to color4
        finalColor = mix(color3, color4, (normalizedHeight - 0.66) * 3.0);
    }
    
    return finalColor;
}

// Complex function: f(z) = sin(z) * cos(z^2)
fn complexFunction(re: f32, im: f32, time: f32) -> f32 {
    // Convert to polar form
    let r = sqrt(re * re + im * im) + 0.01;
    let theta = atan2(im, re);
    
    // Add time-based animation
    let animTheta = theta + time * 0.1;
    
    // Compute a complex function
    return sin(r * 5.0) * cos(theta * 3.0 + time * 0.2) * 0.5;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for coloring
    output.worldPos = position;
    
    // Calculate time-varying complex function
    let time = timeUniform.time;
    let height = complexFunction(position.x, position.y, time);
    
    // Create a modified position with complex function as z-coordinate
    var modifiedPosition = position;
    modifiedPosition.z = height;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal (approximate)
    let epsilon = 0.01;
    let dx = complexFunction(position.x + epsilon, position.y, time) - height;
    let dy = complexFunction(position.x, position.y + epsilon, time) - height;
    
    output.normal = normalize(vec3<f32>(-dx/epsilon, -dy/epsilon, 1.0));
    
    // Generate color based on height
    output.color = heightColor(height, time);
    
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