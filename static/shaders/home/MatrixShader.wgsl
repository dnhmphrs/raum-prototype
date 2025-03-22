struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Use a simpler uniform structure with explicit alignment
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    return output;
}

// Random function
fn random(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

// Improved hash function for matrix effect
fn hash(p: vec2<f32>) -> f32 {
    // Better quality hash function
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.103, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// Smooth hash for better transitions
fn smoothHash(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    // Cubic interpolation
    let u = f * f * (3.0 - 2.0 * f);
    
    // Mix 4 corners
    let a = hash(i);
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Add new horizontal glitch helper function
fn horizontalGlitchEffect(uv: vec2<f32>, current_time: f32) -> vec2<f32> {
    var glitched_uv = uv;
    
    // Horizontal glitch parameters
    let h_glitch_probability = 0.15; // How often horizontal glitches appear
    let h_glitch_intensity = 0.35; // How strong the horizontal offset is
    let h_glitch_duration = 0.1; // How long a glitch lasts in time units
    let h_glitch_bar_size = 0.03; // Height of glitch bars
    let h_glitch_bar_count = 8.0; // Maximum number of glitch bars that can appear
    
    // Use time to create glitch triggers at random moments
    let h_glitch_time = floor(current_time * 10.0); // Controls the frequency of glitch changes
    let h_glitch_seed = hash(vec2<f32>(h_glitch_time, 256.99));
    
    // Only apply horizontal glitches with certain probability
    if (h_glitch_seed < h_glitch_probability) {
        // Determine how many bars to show (1 to max)
        let active_bars = ceil(hash(vec2<f32>(h_glitch_time, 789.54)) * h_glitch_bar_count);
        
        // For each potential bar position
        for (var i = 0.0; i < h_glitch_bar_count; i = i + 1.0) {
            // Skip if we've exceeded our active bar count
            if (i >= active_bars) {
                break;
            }
            
            // Determine the y position for this glitch bar
            let bar_y_position = hash(vec2<f32>(i, h_glitch_time));
            let bar_y = bar_y_position;
            
            // Check if we're within the current glitch bar
            if (abs(uv.y - bar_y) < h_glitch_bar_size) {
                // Random offset for this bar with enhanced curve effects
                let bar_offset_base = (hash(vec2<f32>(bar_y, h_glitch_time)) * 2.0 - 1.0) * h_glitch_intensity;
                
                // Create complex curved patterns by combining multiple sine waves
                // Primary wave - higher frequency and amplitude
                let curve_freq1 = hash(vec2<f32>(bar_y * 3.1, h_glitch_time * 1.7)) * 5.0 + 2.0; // Increased from 3.0+1.0
                let curve_phase1 = hash(vec2<f32>(bar_y * 5.3, h_glitch_time * 0.9)) * 6.28;
                let curve_amp1 = hash(vec2<f32>(bar_y * 2.5, h_glitch_time * 1.3)) * 0.3 + 0.1; // Doubled from 0.15+0.05
                
                // Secondary wave - different frequency for complex pattern
                let curve_freq2 = hash(vec2<f32>(bar_y * 1.7, h_glitch_time * 2.3)) * 8.0 + 3.0;
                let curve_phase2 = hash(vec2<f32>(bar_y * 4.2, h_glitch_time * 1.5)) * 6.28;
                let curve_amp2 = hash(vec2<f32>(bar_y * 3.8, h_glitch_time * 0.7)) * 0.15 + 0.05;
                
                // Combine waves with varying influence based on position
                let position_factor = sin(uv.x * 2.0) * 0.5 + 0.5; // Position-based blending
                let wave1 = sin(uv.x * curve_freq1 + curve_phase1) * curve_amp1;
                let wave2 = sin(uv.x * curve_freq2 + curve_phase2) * curve_amp2;
                
                // Add cubic distortion for more interesting curves
                let cubic_distort = pow(abs(uv.x - 0.5) * 2.0, 3.0) * hash(vec2<f32>(bar_y * 7.2, h_glitch_time)) * 0.2;
                let wave_mix = mix(wave1, wave2, position_factor) + cubic_distort;
                
                // Apply enhanced curved effect
                let bar_offset = bar_offset_base + wave_mix;
                
                // Apply horizontal offset with curved pattern
                glitched_uv.x += bar_offset;
                
                // Digital tear effect - occasionally make parts of the bar disappear or repeat
                let tear_chance = hash(vec2<f32>(bar_y * 7.5, h_glitch_time * 0.8));
                if (tear_chance > 0.7) {
                    // Create horizontal tearing/repeat pattern
                    let tear_freq = 20.0 + hash(vec2<f32>(bar_y, h_glitch_time * 1.2)) * 30.0;
                    let tear_phase = floor(glitched_uv.x * tear_freq) / tear_freq;
                    
                    // Apply tear pattern
                    let tear_offset = hash(vec2<f32>(tear_phase, h_glitch_time)) * 0.1;
                    glitched_uv.x = glitched_uv.x + tear_offset;
                    
                    // Enhanced curved vertical shifts within tears
                    if (hash(vec2<f32>(tear_phase * 3.7, h_glitch_time * 2.3)) > 0.7) {
                        // Complex y-curve factor combining multiple waves
                        let y_wave1 = sin(uv.x * 8.0 + hash(vec2<f32>(tear_phase, h_glitch_time)) * 6.28) * 0.02; // Doubled from 0.01
                        let y_wave2 = cos(uv.x * 5.0 + hash(vec2<f32>(tear_phase * 2.1, h_glitch_time * 1.3)) * 6.28) * 0.015;
                        let y_curve_factor = y_wave1 + y_wave2 * sin(uv.x * 3.0); // Combined waves for more complex curve
                        
                        let y_shift = (hash(vec2<f32>(tear_phase * 5.1, h_glitch_time * 1.7)) * 2.0 - 1.0) * 0.02 + y_curve_factor;
                        glitched_uv.y += y_shift;
                    }
                }
                
                // Occasionally add color aberration to glitched regions
                if (hash(vec2<f32>(bar_y * 10.0, h_glitch_time)) > 0.5) {
                    // This will be used later to apply RGB splitting
                    // Mark with a value slightly outside the normal range to detect in fragment shader
                    glitched_uv.x = abs(glitched_uv.x) + 1000.0; // Special flag value
                }
            }
        }
    }
    
    return glitched_uv;
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Apply horizontal glitch effect
    var glitched_uv = horizontalGlitchEffect(uv, time);
    
    // Check if this pixel has color aberration flag
    let has_color_aberration = glitched_uv.x > 999.0;
    if (has_color_aberration) {
        // Remove the flag value
        glitched_uv.x = fract(glitched_uv.x - 1000.0);
    }
    
    // Adjust UV to maintain aspect ratio
    var uv_aspect = glitched_uv;
    uv_aspect.x *= resolution.x / resolution.y;
    
    // Create a grid for the matrix effect
    let grid_size = 60.0;
    var grid_uv = floor(uv_aspect * grid_size) / grid_size;
    
    // Parameter for glitch grid resolution multiplier (2.0 = twice the resolution of main grid)
    let glitch_resolution_multiplier = 4.0; // Can be adjusted - higher values = finer glitch resolution
    let glitch_grid_size = grid_size * glitch_resolution_multiplier;
    
    // Create digital rain effect - offset initial time to fill screen
    let rain_speed = 0.125;
    let initial_offset = 3.0; // Increased initial offset to better fill screen
    let rain_offset = (time + initial_offset) * rain_speed;
    
    // Different columns move at different speeds with more interesting variation
    let column_index = floor(uv_aspect.x * grid_size);
    let column_phase = hash(vec2<f32>(column_index, 0.0)) * 6.28; // Random phase offset per column
    let column_variation = 0.6 + 0.4 * sin(time * 0.1 + column_phase); // Subtle pulsing variation
    let column_offset = rain_offset * column_variation;
    
    // Create falling characters
    var char_pos = grid_uv.y + column_offset;
    char_pos = fract(char_pos);
    
    // Determine which characters are visible with more variation
    let char_hash = hash(grid_uv);
    let density_variation = 0.3 + 0.1 * sin(time * 0.2 + grid_uv.x * 10.0); // Varying density
    let char_threshold = density_variation + char_hash * 0.3;
    
    // Character brightness based on position - smoother fade with head glow
    let fade_pos = char_pos * 1.8;
    let head_glow = smoothstep(0.0, 0.3, char_pos) * smoothstep(0.5, 0.0, char_pos); // Brighter head
    let char_brightness = smoothstep(1.0, 0.0, fade_pos) + head_glow * 0.5;
    
    // Only show characters that meet the threshold
    let char_visible = step(char_pos, char_threshold);
    
    // Very occasional glitch effect - much more subtle and rare
    let glitch_time = floor(time * 0.8);
    let glitch_seed = smoothHash(vec2<f32>(glitch_time, grid_uv.y * 0.5));
    let glitch_amount = step(0.985, glitch_seed) * 0.03;
    let glitch_offset = smoothHash(vec2<f32>(grid_uv.y * 0.3, glitch_time)) * 2.0 - 1.0;
    
    // Apply glitch to grid_uv if needed - avoid southern edge
    if (glitch_amount > 0.0 && uv.y > 0.1) {
        grid_uv.x += glitch_offset * glitch_amount;
    }
    
    // Depth effect - characters further away are dimmer
    let depth_factor = 0.7 + 0.3 * smoothHash(vec2<f32>(grid_uv.x * 2.0, 0.5));
    
    // Subtle color variations - more interesting patterns
    let time_factor = time * 0.2;
    let x_pattern = sin(grid_uv.x * 20.0 + time * 0.1) * 0.5 + 0.5; // Horizontal pattern
    let color_seed = smoothHash(vec2<f32>(grid_uv.x * 0.5, time_factor));
    let color_shift = smoothstep(0.95, 1.0, color_seed * x_pattern); // Smoother transition
    
    // Smoother color amount transition with pattern
    let y_pattern = sin(grid_uv.y * 15.0 - time * 0.05) * 0.5 + 0.5; // Vertical pattern
    let color_amount = smoothHash(vec2<f32>(grid_uv.y * 0.3, time_factor * 0.5)) * y_pattern;
    
    // Base matrix color with more interesting variation
    let base_intensity = 1.3 + 0.3 * head_glow; // Brighter heads
    // Change from green/purple to dark gray (#2c2c2c)
    let intensity_variation = 0.8 + 0.2 * sin(time * 0.3 + grid_uv.x * 5.0); // Subtle intensity variation
    // Dark gray #2c2c2c in normalized RGB is (0.173, 0.173, 0.173)
    var matrix_color = vec3<f32>(0.173, 0.173, 0.173) * intensity_variation * char_brightness * char_visible * base_intensity * depth_factor;
    
    // Apply color aberration effect for glitched horizontal bars
    if (has_color_aberration) {
        // RGB channel split
        let split_amount = 0.02;
        var split_r = matrix_color;
        var split_g = matrix_color;
        var split_b = matrix_color;
        
        // Shift red and blue channels
        split_r.r = matrix_color.r * 5.0; // Boosted from 3.5 - Boost red channel
        split_r.g *= 0.3; // Reduced from 0.5 - Reduce other channels
        split_r.b *= 0.3; // Reduced from 0.5
        
        split_b.b = matrix_color.b * 5.0; // Boosted from 3.5 - Boost blue channel
        split_b.r *= 0.3; // Reduced from 0.5 - Reduce other channels
        split_b.g *= 0.3; // Reduced from 0.5
        
        // Create glitched appearance by mixing colors based on position
        let mix_factor = fract(glitched_uv.y * 15.0 + time * 3.0);
        if (mix_factor < 0.33) {
            matrix_color = split_r;
        } else if (mix_factor < 0.66) {
            matrix_color = split_g;
        } else {
            matrix_color = split_b;
        }
        
        // Add digital noise to glitched areas
        let noise_intensity = 0.6; // Increased from 0.4
        let digital_noise = vec3<f32>(
            random(glitched_uv + vec2<f32>(time * 0.1, 0.0)),
            random(glitched_uv + vec2<f32>(0.0, time * 0.1)),
            random(glitched_uv + vec2<f32>(time * 0.1, time * 0.1))
        ) * noise_intensity;
        
        matrix_color = mix(matrix_color, digital_noise, 0.5); // Increased from 0.3
        
        // Add scan line effect to glitched areas
        let scan_line_frequency = 80.0; // Higher values = more scan lines
        let scan_line_speed = 30.0; // Speed of scan line animation
        let scan_line = step(0.5, sin(glitched_uv.y * scan_line_frequency + time * scan_line_speed) * 0.5 + 0.5);
        
        // Apply scan line effect
        matrix_color = mix(matrix_color, matrix_color * 0.2, scan_line * 0.7);
        
        // Add occasional bright flicker
        let flicker_speed = 15.0;
        let flicker = step(0.9, sin(time * flicker_speed) * 0.5 + 0.5);
        matrix_color = mix(matrix_color, matrix_color * 2.0, flicker * 0.3);
    }
    
    // More interesting color variations
    // Update alternate colors to be subtle variations of the dark gray
    let alt_color1 = vec3<f32>(0.195, 0.195, 0.195) * char_brightness * char_visible * base_intensity * depth_factor; // Slightly lighter gray
    let alt_color2 = vec3<f32>(0.155, 0.155, 0.155) * char_brightness * char_visible * base_intensity * depth_factor; // Slightly darker gray
    
    // Smoother color mixing with better transitions
    var color = matrix_color;
    color = mix(color, alt_color1, color_shift * color_amount * 0.7); // More subtle mixing
    color = mix(color, alt_color2, color_shift * (1.0 - color_amount) * 0.5); // Even more subtle
    
    // Rainbow psychedelic glitch effect
    let rainbow_freq = 0.3;
    let rainbow_glitch_time = floor(time * 2.0); // Different timing than regular glitch
    let rainbow_glitch_seed = smoothHash(vec2<f32>(rainbow_glitch_time * 0.5, grid_uv.x));
    let rainbow_trigger = step(0.65, rainbow_glitch_seed); // Increased frequency (35% chance instead of 25%)
    
    // Use finer grid for the rainbow effect
    let fine_grid_uv = floor(uv_aspect * glitch_grid_size) / glitch_grid_size;
    
    // Only apply to some characters for subtle effect - use fine grid for selection
    let rainbow_char_seed = hash(fine_grid_uv * 1.5 + time * 0.1);
    let rainbow_char_select = step(0.4, rainbow_char_seed); // More characters affected (60% instead of 25%)
    
    if (rainbow_trigger > 0.0 && rainbow_char_select > 0.0 && char_visible > 0.0) {
        // Rainbow color calculation - full spectrum shift - use fine grid for color variation
        let hue = fract(fine_grid_uv.x * 3.0 + fine_grid_uv.y * 2.0 + time * rainbow_freq);
        let rainbow_strength = smoothstep(0.0, 0.3, char_brightness) * 1.5; // Increased strength
        
        // HSV to RGB conversion for the rainbow effect
        let h = hue * 6.0;
        let i = floor(h);
        let f = h - i;
        let p = 0.0;
        let q = 1.0 - f;
        let t = f;
        
        var rgb: vec3<f32>;
        
        if (i < 1.0) {
            rgb = vec3<f32>(1.0, t, p);
        } else if (i < 2.0) {
            rgb = vec3<f32>(q, 1.0, p);
        } else if (i < 3.0) {
            rgb = vec3<f32>(p, 1.0, t);
        } else if (i < 4.0) {
            rgb = vec3<f32>(p, q, 1.0);
        } else if (i < 5.0) {
            rgb = vec3<f32>(t, p, 1.0);
        } else {
            rgb = vec3<f32>(1.0, p, q);
        }
        
        // Mix the rainbow color with the original based on the character brightness
        color = mix(color, rgb * char_brightness * base_intensity * 1.5, rainbow_strength); // Increased brightness
    }
    
    // Also add a global rainbow wave effect for more psychedelic feel
    // Use finer grid for the global effect too
    let wave_scale = 0.3 * glitch_resolution_multiplier;
    let global_rainbow_intensity = 0.15; // Subtle but noticeable
    let global_rainbow_speed = 0.5;
    let global_rainbow_hue = fract(uv.x * wave_scale + uv.y * (wave_scale * 0.66) + time * global_rainbow_speed);
    
    // Simple HSV to RGB for global effect
    let gh = global_rainbow_hue * 6.0;
    let gi = floor(gh);
    let gf = gh - gi;
    
    var global_rgb: vec3<f32>;
    if (gi < 1.0) {
        global_rgb = vec3<f32>(1.0, gf, 0.0);
    } else if (gi < 2.0) {
        global_rgb = vec3<f32>(1.0 - gf, 1.0, 0.0);
    } else if (gi < 3.0) {
        global_rgb = vec3<f32>(0.0, 1.0, gf);
    } else if (gi < 4.0) {
        global_rgb = vec3<f32>(0.0, 1.0 - gf, 1.0);
    } else if (gi < 5.0) {
        global_rgb = vec3<f32>(gf, 0.0, 1.0);
    } else {
        global_rgb = vec3<f32>(1.0, 0.0, 1.0 - gf);
    }
    
    // Add subtle global rainbow effect that's always present
    color += global_rgb * global_rainbow_intensity * char_visible;
    
    // Add subtle scan lines with variation
    let scan_freq = 0.5 + 0.1 * sin(time * 0.2); // Varying scan line frequency
    let scan_line = sin(uv.y * resolution.y * scan_freq) * 0.5 + 0.5;
    color *= 0.95 + scan_line * 0.1;
    
    // Add very subtle noise with variation
    let noise_amount = 0.02 + 0.01 * sin(time * 0.1); // Varying noise
    let noise = random(uv + time * 0.01) * noise_amount;
    color += noise;
    
    // Set the background color to #f0f0f0 (convert from hex to float: 240/255 = 0.94)
    let background_color = vec3<f32>(0.97, 0.97, 0.97);
    
    // Final output with white background - invert the effect by subtracting color from white background
    return vec4<f32>(background_color - color, 1.0);
} 