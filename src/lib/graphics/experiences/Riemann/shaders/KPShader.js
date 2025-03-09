export const KPShader = `
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
        // KP values typically range from -0.5 to 0.5
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
    
    // Function to create a dynamic symmetric and positive definite matrix based on time
    fn createDynamicOmega(time: f32) -> mat3x3<f32> {
        let t = time * 0.1;
        let sinT = sin(3.14159 * t);
        let cosT = cos(3.14159 * t);

        // Define the matrix B
        let B = mat3x3<f32>(
            1.0 + 0.5 * sinT, 0.5 * cosT, 0.2 * sinT,
            0.5 * cosT, 1.0 + 0.5 * cosT, 0.1 * sinT,
            0.2 * sinT, 0.1 * cosT, 1.0 + 0.5 * sinT
        );

        // Compute A = B^T * B to ensure positive definiteness
        return transpose(B) * B;
    }
    
    // Base phase vectors
    const baseK = vec3<f32>(0.5, 1.0, 1.2060);
    const baseL = vec3<f32>(-0.2, -1.3974, 0.6148);
    const baseOmega = vec3<f32>(-1.1427, -6.2228, -0.3940);
    
    // Function to compute the real part of the KP solution
    fn kpSolutionReal(z: vec3<f32>, Omega: mat3x3<f32>) -> f32 {
        var sum: f32 = 0.0;
        
        // Iterate over the range of n values for 3 dimensions
        for (var n1: i32 = -2; n1 <= 2; n1++) {
            for (var n2: i32 = -2; n2 <= 2; n2++) {
                for (var n3: i32 = -2; n3 <= 2; n3++) {
                    let n = vec3<f32>(f32(n1), f32(n2), f32(n3));
                    
                    // Compute n^T * Omega * n
                    let nt_Omega_n = dot(n, Omega * n);
                    
                    // Compute 2 * n^T * z
                    let nt_z = 2.0 * dot(n, z);
                    
                    // Compute the real part of the exponential term
                    let exponent = 3.14159 * (nt_Omega_n + nt_z);
                    let realPart = cos(exponent); // Use cosine for the real part
                    
                    sum += realPart;
                }
            }
        }
        
        return sum;
    }
    
    @vertex
    fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
        var output: VertexOutput;
        
        // Store original position for coloring
        output.worldPos = position;
        
        // Create a dynamic matrix based on time
        let time = timeUniform.time;
        let OmegaDynamic = createDynamicOmega(time);
        
        // Calculate the phase variable z using phase vectors
        // Ensure we're using the exact position coordinates for perfect centering
        let z = baseK * position.x + baseL * position.y + vec3<f32>(0.0, 0.0, 0.0);
        
        // Calculate the real part of the KP solution at z
        let kpValue = kpSolutionReal(z, OmegaDynamic);
        
        // Create a modified position with KP solution as z-coordinate
        var modifiedPosition = position;
        modifiedPosition.z = kpValue * 0.05;
        
        // Transform position with view and projection matrices
        output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
        
        // Calculate normal (approximate)
        // For KP surfaces, we need a better normal approximation
        let epsilon = 0.01;
        let dx = vec3<f32>(epsilon, 0.0, 0.0);
        let dy = vec3<f32>(0.0, epsilon, 0.0);
        
        let zx = kpSolutionReal(baseK * (position.x + epsilon) + baseL * position.y, OmegaDynamic) * 0.05;
        let zy = kpSolutionReal(baseK * position.x + baseL * (position.y + epsilon), OmegaDynamic) * 0.05;
        
        let tangentX = vec3<f32>(dx.x, 0.0, zx - modifiedPosition.z);
        let tangentY = vec3<f32>(0.0, dy.y, zy - modifiedPosition.z);
        
        output.normal = normalize(cross(tangentX, tangentY));
        
        // Generate color based on height (KP value)
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
`; 