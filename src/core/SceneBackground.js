import * as THREE from "three";

export class SceneBackground {
  constructor(scene) {
    this.scene = scene;
    this.init();
  }

  init() {
    // Create a large plane to act as our background "Canvas"
    const geometry = new THREE.PlaneGeometry(8000, 8000);

    // Shader to create a radial gradient from center
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      void main() {
        // Calculate distance from center (vUv is 0-1)
        float d = distance(vUv, vec2(0.5, 0.5));
        
        // Colors from center (Extreme Dark Burgundy) to edges (Black)
        // Drastically lowered to be almost invisible, just a "vibe"
        vec3 colorCenter = vec3(0.04, 0.0, 0.02); 
        vec3 colorEdge = vec3(0.0, 0.0, 0.0);
        
        // Sharper transition: Fades to black much faster (around 30% from center)
        // This ensures the corners and most of the screen are deep black
        vec3 finalColor = mix(colorCenter, colorEdge, smoothstep(0.0, 0.3, d));
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = -2500; // Far behind all particles (even background stars)
    this.scene.add(this.mesh);
  }
}
