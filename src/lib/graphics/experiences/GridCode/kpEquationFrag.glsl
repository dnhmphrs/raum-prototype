precision highp float; // Use high precision for better accuracy
varying vec2 vUv;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec2 mouse;

// Function to create a dynamic symmetric and positive definite matrix based on mouse input
mat3 createDynamicOmega(vec2 mouse) {
    mouse.x *= 0.2;
    mouse.y *= 0.2;
    float sinX = sin(3.14159 * mouse.x);
    float cosY = cos(3.14159 *mouse.y);

    // Define the matrix B
    mat3 B = mat3(
        1.0 + 0.5 * sinX, 0.5 * cosY, 0.2 * sinX,
        0.5 * cosY, 1.0 + 0.5 * cosY, 0.1 * sinX,
        0.2 * sinX, 0.1 * cosY, 1.0 + 0.5 * sinX
    );

    // Compute A = B^T * B to ensure positive definiteness
    return transpose(B) * B;
}

// Base phase vectors
const vec3 baseK = vec3(0.5, 1.0, 1.2060);
const vec3 baseL = vec3(-0.2, -1.3974, 0.6148);
const vec3 baseOmega = vec3(-1.1427, -6.2228, -0.3940);
const vec3 phi = vec3(0.0, 0.0, 0.0);

const int N = 2; // Reduced number of terms for better performance

// Function to compute the real part of the KP solution
float kpSolutionReal(vec3 z, mat3 Omega) {
    float sum = 0.0;

    // Iterate over the range of n values for 3 dimensions
    for (int n1 = -N; n1 <= N; ++n1) {
        for (int n2 = -N; n2 <= N; ++n2) {
            for (int n3 = -N; n3 <= N; ++n3) {
                vec3 n = vec3(float(n1), float(n2), float(n3));

                // Compute n^T * Omega * n
                float nt_Omega_n = dot(n, Omega * n);

                // Compute 2 * n^T * z
                float nt_z = 2.0 * dot(n, z);

                // Compute the real part of the exponential term
                float exponent = 3.14159 * (nt_Omega_n + nt_z);
                float realPart = cos(exponent); // Use cosine for the real part

                sum += realPart;
            }
        }
    }

    return sum;
}

void main() {
    // Map the fragment coordinates to the complex plane
    float x = vUv.x * 5.0 - 2.5;
    float y = vUv.y * 5.0 - 2.5;

    // Create a dynamic symmetric and positive definite matrix based on mouse input
    mat3 OmegaDynamic = createDynamicOmega(mouse);

    // Map mouse position to modify phase vectors
    // vec3 k = baseK + vec3(sin(mouse.x * 3.14) * 0.5, cos(mouse.y * 3.14) * 0.5, 0.0);
    // vec3 l = baseL + vec3(cos(mouse.x * 3.14) * 0.5, sin(mouse.y * 3.14) * 0.5, 0.0);
    // vec3 omega = baseOmega + vec3(sin(mouse.x * 3.14) * 0.2, cos(mouse.y * 3.14) * 0.2, mouse.x * mouse.y * 0.1);

    // Calculate the phase variable z using phase vectors
    vec3 z = baseK * x + baseL * y + phi;

    // Calculate the real part of the KP solution at z
    float kpValueReal = kpSolutionReal(z, OmegaDynamic);

    // Normalize kpValue to map to color range
    float normalizedKp = 0.5 + 0.5 * kpValueReal;

    // Create gradients for visualization
    vec3 gradient1 = mix(color1, color2, normalizedKp);
    vec3 gradient2 = mix(color3, gradient1, 0.25 + 0.25 * sin(normalizedKp));

    gl_FragColor = vec4(gradient2, 1.0);
}
