export const RiemannShader = `
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
        // Normalize height to [0, 1] range
        // For flat surface, this will be 0.5 (middle of range)
        let normalizedHeight = (height + 1.0) * 0.5;
        
        // Create a gradient from blue (low) to cyan (high)
        let lowColor = vec3<f32>(0.0, 0.2, 0.8); // Deep blue
        let highColor = vec3<f32>(0.0, 0.8, 1.0); // Cyan
        
        // Add subtle animation
        let animatedHeight = normalizedHeight + sin(time * 0.2) * 0.05;
        
        return mix(lowColor, highColor, animatedHeight);
    }
    
    // Complex domain coloring function
    fn domainColoring(re: f32, im: f32, time: f32) -> vec3<f32> {
        // Phase coloring (argument of complex number)
        let phase = atan2(im, re);
        let hue = (phase + 3.14159) / (2.0 * 3.14159);
        
        // Magnitude coloring with contour lines
        let magnitude = sqrt(re * re + im * im);
        let logMag = log(magnitude + 0.1);
        let contour = 0.5 + 0.5 * sin(10.0 * logMag + time * 0.2);
        
        // Convert HSV to RGB
        let h = hue;
        let s = 0.8;
        let v = 0.7 * (0.8 + 0.2 * contour);
        
        // HSV to RGB conversion
        let c = v * s;
        let x = c * (1.0 - abs(fract(h * 6.0) - 3.0) - 1.0);
        let m = v - c;
        
        var rgb: vec3<f32>;
        if (h < 1.0/6.0) {
            rgb = vec3<f32>(c, x, 0.0);
        } else if (h < 2.0/6.0) {
            rgb = vec3<f32>(x, c, 0.0);
        } else if (h < 3.0/6.0) {
            rgb = vec3<f32>(0.0, c, x);
        } else if (h < 4.0/6.0) {
            rgb = vec3<f32>(0.0, x, c);
        } else if (h < 5.0/6.0) {
            rgb = vec3<f32>(x, 0.0, c);
        } else {
            rgb = vec3<f32>(c, 0.0, x);
        }
        
        return rgb + vec3<f32>(m, m, m);
    }
    
    @vertex
    fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
        var output: VertexOutput;
        
        // Store original position for coloring
        output.worldPos = position;
        
        // Transform position with view and projection matrices
        output.position = projection * view * vec4<f32>(position, 1.0);
        
        // Calculate normal (approximate)
        var normal = vec3<f32>(0.0, 0.0, 1.0);
        
        // Better normal approximation based on position
        if (abs(position.z) > 0.01) {
            // For non-flat surfaces, estimate normal based on z gradient
            normal = normalize(vec3<f32>(
                -position.z * sign(position.x) * 2.0,
                -position.z * sign(position.y) * 2.0,
                1.0
            ));
        }
        
        output.normal = normal;
        
        // Choose coloring based on surface type
        let time = timeUniform.time;
        
        // For flat surface and torus, use height-based coloring
        output.color = heightColor(position.z, time);
        
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
`; 