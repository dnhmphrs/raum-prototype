export const TorusShader = `
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
    
    // Simple color function for torus based on position
    fn simpleTorusColor(position: vec3<f32>, time: f32) -> vec3<f32> {
        // Use the height (z-coordinate) for coloring
        // Torus z values range from -0.5 to 0.5
        let normalizedHeight = (position.z + 0.5) * 1.0;
        
        // Create a simple blue-to-cyan gradient
        let baseColor = vec3<f32>(0.0, 0.3, 0.8); // Blue
        let topColor = vec3<f32>(0.0, 0.8, 0.8);  // Cyan
        
        return mix(baseColor, topColor, normalizedHeight);
    }
    
    @vertex
    fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
        var output: VertexOutput;
        
        // Store original position for calculations
        output.worldPos = position;
        
        // Torus parameters
        let R = 1.5; // Major radius
        let r = 0.5; // Minor radius
        
        // Calculate parametric coordinates
        let u = position.x * 3.14159; // Angle around the tube
        let v = position.y * 3.14159; // Angle around the torus
        
        // Calculate torus position
        let torusX = (R + r * cos(v)) * cos(u);
        let torusY = (R + r * cos(v)) * sin(u);
        let torusZ = r * sin(v);
        
        let torusPosition = vec3<f32>(torusX, torusY, torusZ);
        
        // Transform position with view and projection matrices
        output.position = projection * view * vec4<f32>(torusPosition, 1.0);
        
        // Calculate normal
        // For a torus, the normal at point (u,v) is:
        let nx = cos(v) * cos(u);
        let ny = cos(v) * sin(u);
        let nz = sin(v);
        
        output.normal = normalize(vec3<f32>(nx, ny, nz));
        
        // Generate color based on position
        output.color = simpleTorusColor(torusPosition, timeUniform.time);
        
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