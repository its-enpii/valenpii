import * as THREE from "three";

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    const isMobile = window.innerWidth < 600;
    this.maxParticles = isMobile ? 6000 : 16000; // Lowered from 8k for 60fps on mobile

    this.particles = [];
    this.geometry = new THREE.BufferGeometry();

    // Attributes
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);
  }

  async init() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    // STAR TEXTURE GENERATION
    // Clear canvas
    ctx.clearRect(0, 0, 64, 64);

    // 1. Soft Glow Background (Subtle)
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.5)"); // Lower opacity core
    grad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // 2. Sharp "Star" Cross (The main visible shape)
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4; // Thicker lines to be visible at small scale

    // Vertical
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 64);

    // Horizontal
    ctx.moveTo(0, 32);
    ctx.lineTo(64, 32);
    ctx.stroke();

    // 3. Diagonal rays (smaller)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Slightly dimmer
    ctx.lineWidth = 2;
    ctx.moveTo(16, 16);
    ctx.lineTo(48, 48);
    ctx.moveTo(48, 16);
    ctx.lineTo(16, 48);
    ctx.stroke();

    // 4. Solid Core
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);

    const vertexShader = `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        float pSize = size * ( 600.0 / -mvPosition.z ); 
        gl_PointSize = min(pSize, 80.0); 
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform sampler2D pointTexture;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4( vColor, 1.0 );
        gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
        if (gl_FragColor.a < 0.1) discard;
      }
    `;

    this.material = new THREE.ShaderMaterial({
      uniforms: { pointTexture: { value: texture } },
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );
    this.geometry.setAttribute(
      "size",
      new THREE.BufferAttribute(this.sizes, 1),
    );

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  createPool(count) {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        state: "chaos",
        baseSize: Math.random() * 12 + 8, // Balanced size: noticeable but not massive
        twinkleSpeed: Math.random() * 0.05 + 0.02,
        twinkleOffset: Math.random() * Math.PI * 2,
        // Bloom Blending
        bloomX: 0,
        bloomY: 0,
        bloomZ: 0,
        bloomMix: 0,
      });
    }
  }

  update(dt, mouse) {
    const posAttr = this.geometry.attributes.position;
    const sizeAttr = this.geometry.attributes.size;
    const time = Date.now() * 0.002;

    // Convert mouse to world units (approx)
    const mX = mouse ? mouse.x * 400 : -9999;
    const mY = mouse ? mouse.y * 300 : -9999;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];

      // MAGIC TRAIL - Slight interactive push
      if (mX > -9000) {
        const dx = p.x - mX;
        const dy = p.y - mY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 15000) {
          // Optimized: avoid Math.sqrt for high-frequency physics
          const force = (1 - distSq / 15000) * 80 * dt;
          p.vx += dx * force * 0.1;
          p.vy += dy * force * 0.1;
        }
      }

      // BASE PHYSICS (The "Chaos" drift)
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // BLENDED RENDERING
      // If bloomMix > 0, we pull the visual position toward bloom target
      const renderX = p.x * (1 - p.bloomMix) + p.bloomX * p.bloomMix;
      const renderY = p.y * (1 - p.bloomMix) + p.bloomY * p.bloomMix;
      const renderZ = p.z * (1 - p.bloomMix) + p.bloomZ * p.bloomMix;

      posAttr.array[i * 3] = renderX;
      posAttr.array[i * 3 + 1] = renderY;
      posAttr.array[i * 3 + 2] = renderZ;

      const twinkle =
        Math.sin(time * p.twinkleSpeed + p.twinkleOffset) * 0.5 + 0.5;

      // HEARTBEAT LOGIC (Soft Glow)
      // Pulse speed: ~1.2 beats per second (72 BPM)
      // Use simple Sin wave for "Soft" beat, not sharp Pow
      const beat = Math.sin(time * 3.0) * 0.5 + 0.5; // Range 0.0 -> 1.0, smooth
      const beatScale = 1.0 + beat * 0.15; // 1.0 -> 1.15 (15% max increase - Very Soft)

      let scale = 0.6 + twinkle * 0.4;

      // GLOW BOOST + HEARTBEAT
      if (p.bloomMix > 0.1) {
        scale *= (1 + p.bloomMix * 0.6) * beatScale; // Pulse during bloom
      } else if (p.state === "forming") {
        scale *= 1.1 * beatScale; // Reduced from 1.4x to keep shapes sharp/less blurry
      } else if (p.state === "chaos") {
        scale *= 3.0; // Increased significantly for mobile presence
      }

      sizeAttr.array[i] = p.baseSize * scale;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }
}
