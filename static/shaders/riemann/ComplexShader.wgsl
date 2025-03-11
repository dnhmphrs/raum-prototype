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

// Function to generate color based on height with time-based color shifting
fn heightColor(height: f32, time: f32) -> vec3<f32> {
    // Map height to a normalized range [0, 1]
    // Complex function values typically range from -0.5 to 0.5
    let normalizedHeight = (height + 0.5) * 1.0;
    
    // Create a color gradient based on height with time-based shifting
    // Colors shift and pulse over time
    let t = time * 0.3;
    let pulseIntensity = 0.2 * sin(time * 0.5) + 0.8; // Pulsing effect between 0.6 and 1.0
    
    // Dynamic color palette that shifts over time
    let color1 = vec3<f32>(0.5 + 0.3 * sin(t), 0.0 + 0.3 * cos(t * 0.7), 0.8); // Shifting purple
    let color2 = vec3<f32>(0.0, 0.2 + 0.2 * sin(t * 0.5), 0.8 + 0.2 * cos(t * 0.3)); // Shifting blue
    let color3 = vec3<f32>(0.0 + 0.3 * sin(t * 0.4), 0.8, 0.8 - 0.2 * sin(t * 0.6)); // Shifting cyan
    let color4 = vec3<f32>(0.0 + 0.2 * cos(t), 0.8 * pulseIntensity, 0.2 + 0.3 * sin(t * 0.8)); // Shifting green
    
    // Multi-step gradient with dynamic thresholds
    let threshold1 = 0.33 + 0.1 * sin(time * 0.2);
    let threshold2 = 0.66 + 0.1 * sin(time * 0.3 + 1.0);
    
    var finalColor: vec3<f32>;
    if (normalizedHeight < threshold1) {
        // Map from color1 to color2
        finalColor = mix(color1, color2, normalizedHeight / threshold1);
    } else if (normalizedHeight < threshold2) {
        // Map from color2 to color3
        finalColor = mix(color2, color3, (normalizedHeight - threshold1) / (threshold2 - threshold1));
    } else {
        // Map from color3 to color4
        finalColor = mix(color3, color4, (normalizedHeight - threshold2) / (1.0 - threshold2));
    }
    
    return finalColor;
}

// Enhanced complex function with multiple layers of animation
fn complexFunction(re: f32, im: f32, time: f32) -> f32 {
    // Convert to polar form
    let r = sqrt(re * re + im * im) + 0.01;
    let theta = atan2(im, re);
    
    // Multiple time scales for different animation layers
    let t1 = time * 0.2;  // Slow base rotation
    let t2 = time * 0.5;  // Medium frequency wobble
    let t3 = time * 1.3;  // Fast ripple effect
    
    // Wobble effect - varies the radius based on angle and time
    let wobbleAmount = 0.4 + 0.2 * sin(t2);
    let wobble = sin(theta * 4.0 + t1) * wobbleAmount;
    
    // Ripple effect - concentric waves moving outward
    let ripple = sin(r * 8.0 - t3) * 0.15;
    
    // Spiral effect
    let spiral = sin(r * 3.0 + theta * 2.0 + t1 * 0.7) * 0.25;
    
    // Combine different effects with time-varying weights
    let weight1 = 0.5 + 0.3 * sin(t1 * 0.3);
    let weight2 = 0.5 + 0.3 * cos(t1 * 0.4);
    
    // Base function with multiple oscillating components
    let base = sin(r * 5.0 + t1) * cos(theta * 3.0 + t2) * 0.5;
    
    // Combine all effects
    return base + wobble * weight1 + ripple * weight2 + spiral * 0.3;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for coloring
    output.worldPos = position;
    
    // Calculate time-varying complex function
    let time = timeUniform.time;
    
    // Add subtle xy displacement for more organic movement
    let displacementX = sin(position.y * 3.0 + time * 0.7) * 0.02;
    let displacementY = cos(position.x * 3.0 + time * 0.5) * 0.02;
    
    let modX = position.x + displacementX;
    let modY = position.y + displacementY;
    
    let height = complexFunction(modX, modY, time);
    
    // Create a modified position with complex function as z-coordinate
    var modifiedPosition = position;
    modifiedPosition.x += displacementX;
    modifiedPosition.y += displacementY;
    modifiedPosition.z = height;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal (approximate)
    let epsilon = 0.01;
    let dx = complexFunction(modX + epsilon, modY, time) - height;
    let dy = complexFunction(modX, modY + epsilon, time) - height;
    
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
    // Get time for animated lighting
    let time = timeUniform.time;
    
    // Animated light direction
    let light_dir = normalize(vec3<f32>(
        0.5 + 0.3 * sin(time * 0.3),
        0.5 + 0.3 * cos(time * 0.4),
        1.0
    ));
    
    let diffuse = max(dot(normal, light_dir), 0.0);
    
    // Pulsing ambient light
    let ambient = 0.3 + 0.1 * sin(time * 0.2);
    
    // Use a fixed view direction for specular to avoid zoom issues
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    
    // Animated specular intensity
    let specPower = 32.0 + 16.0 * sin(time * 0.1);
    let specular = pow(max(dot(normal, half_dir), 0.0), specPower) * (0.3 + 0.1 * sin(time * 0.7));
    
    // Combine lighting components with time-varying weights
    let diffuseWeight = 0.6 + 0.2 * sin(time * 0.15);
    let lighting = ambient + diffuse * diffuseWeight + specular;
    
    return vec4<f32>(color * lighting, 1.0);
} 