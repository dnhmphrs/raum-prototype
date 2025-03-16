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

// Function to generate color based on height only (no time variation)
fn heightColor(height: f32) -> vec3<f32> {
    // Map height to a [0, 1] range for coloring logic
    let normalizedHeight = clamp((height + 1.5) * 0.4, 0.0, 1.0);
    
    // Fixed vibrant color palette
    let color1 = vec3<f32>(0.5, 0.0, 0.8); // Purple
    let color2 = vec3<f32>(0.1, 0.3, 0.9); // Deep blue
    let color3 = vec3<f32>(0.0, 0.8, 0.8); // Cyan
    let color4 = vec3<f32>(0.0, 0.8, 0.2); // Green

    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.33) {
        finalColor = mix(color1, color2, normalizedHeight * 3.0);
    } else if (normalizedHeight < 0.66) {
        finalColor = mix(color2, color3, (normalizedHeight - 0.33) * 3.0);
    } else {
        finalColor = mix(color3, color4, (normalizedHeight - 0.66) * 3.0);
    }

    return finalColor;
}

// A dramatically changing surface function with improved stability
fn surfaceFunction(x: f32, y: f32, time: f32) -> f32 {
    // Convert to polar coordinates
    let r = sqrt(x * x + y * y);
    let theta = atan2(y, x);
    
    // Create multiple time-based effects
    
    // 1. Moving peaks that travel across the surface
    let peak1X = sin(time * 0.3) * 1.6;
    let peak1Y = cos(time * 0.4) * 1.6;
    let peak2X = sin(time * 0.5 + 2.0) * 1.6;
    let peak2Y = cos(time * 0.2 + 1.0) * 1.6;
    
    let dist1 = sqrt(pow(x - peak1X, 2.0) + pow(y - peak1Y, 2.0));
    let dist2 = sqrt(pow(x - peak2X, 2.0) + pow(y - peak2Y, 2.0));
    
    // Add small epsilon to avoid division by zero
    let safeD1 = max(dist1, 0.01);
    let safeD2 = max(dist2, 0.01);
    
    let peak1 = 1.5 * exp(-safeD1 * 1.2);
    let peak2 = 1.2 * exp(-safeD2 * 1.2);
    
    // 2. Ripples with changing frequency
    let rippleFreq = 5.0 + 3.0 * sin(time * 0.2);
    let ripple = 0.4 * sin(r * rippleFreq - time * 2.0);
    
    // 3. Spiral waves that rotate
    let spiralFreq = 3.0 + sin(time * 0.3);
    let spiralPhase = time * 1.5;
    let spiral = 0.5 * sin(theta * spiralFreq + r * 4.0 + spiralPhase) * exp(-r * 0.8);
    
    // 4. Pulsing effect
    let pulse = 0.3 * sin(time * 0.7) + 1.0;
    
    // Combine all effects with time-based blending
    let blend1 = 0.5 + 0.5 * sin(time * 0.15);
    let blend2 = 0.5 + 0.5 * sin(time * 0.15 + 2.0);
    let blend3 = 0.5 + 0.5 * sin(time * 0.15 + 4.0);
    
    // Normalize blending with safety check
    let blendSum = max(blend1 + blend2 + blend3, 0.001);
    let norm1 = blend1 / blendSum;
    let norm2 = blend2 / blendSum;
    let norm3 = blend3 / blendSum;
    
    // Combine effects with dramatic time-based changes
    return pulse * (norm1 * (peak1 + peak2) + norm2 * ripple + norm3 * spiral);
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;

    // Store original position for fragment calculations
    output.worldPos = position;

    // Use time with a reasonable scale
    let time = timeUniform.time * 1.0;

    // Calculate the new height using our surface function
    let height = surfaceFunction(position.x, position.y, time);

    // Adjust the vertex's z based on the calculated height
    var modifiedPosition = position;
    modifiedPosition.z = height;

    // Transform position with view and projection
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);

    // Approximate normal via partial derivatives with safety checks
    let epsilon = 0.01;
    let dx = surfaceFunction(position.x + epsilon, position.y, time) - height;
    let dy = surfaceFunction(position.x, position.y + epsilon, time) - height;
    
    // Ensure normal is valid (avoid zero-length normals)
    var normal = vec3<f32>(-dx / epsilon, -dy / epsilon, 1.0);
    let len = length(normal);
    if (len < 0.001) {
        normal = vec3<f32>(0.0, 0.0, 1.0); // Default normal if calculation breaks down
    } else {
        normal = normal / len; // Normalize
    }
    output.normal = normal;

    // Generate color from height only (no time influence)
    output.color = heightColor(height);

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
    let ambient = 0.3;

    // Enhanced specular highlight
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 64.0) * 0.5;

    // Combine lighting with enhanced specular
    let lighting = ambient + diffuse * 0.7 + specular;

    return vec4<f32>(color * lighting, 1.0);
}
