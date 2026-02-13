import * as THREE from "three";

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    const isMobile = window.innerWidth < 600;
    this.maxParticles = isMobile ? 12000 : 25000; // Increased for more background stars

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
    const shapeLimit = Math.floor(this.maxParticles * 0.7); // 70% Shape, 30% Background

    for (let i = 0; i < this.maxParticles; i++) {
      const role = i < shapeLimit ? "shape" : "background";

      // Initial positions for background stars (Atmosphere)
      let rx = 0,
        ry = 0,
        rz = 0;
      let vx = 0,
        vy = 0,
        vz = 0;

      if (role === "background") {
        const radius = 600 + Math.random() * 1200; // Closer range for better density
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        rx = radius * Math.sin(phi) * Math.cos(theta);
        ry = radius * Math.sin(phi) * Math.sin(theta);
        rz = radius * Math.cos(phi);

        // Initial inward drift - Brisk movement
        const speed = 30 + Math.random() * 40;
        vx = -(rx / radius) * speed;
        vy = -(ry / radius) * speed;
        vz = -(rz / radius) * speed;
      } else {
        // Shape stars start far away (hidden)
        const angle = Math.random() * Math.PI * 2;
        rx = Math.cos(angle) * 3000;
        ry = Math.sin(angle) * 3000;
        rz = (Math.random() - 0.5) * 1000;
      }

      this.particles.push({
        x: rx,
        y: ry,
        z: rz,
        vx: vx,
        vy: vy,
        vz: vz,
        role: role,
        state: "chaos",
        baseSize: Math.random() * 12 + 8,
        twinkleSpeed: Math.random() * 0.05 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
        bloomX: 0,
        bloomY: 0,
        bloomZ: 0,
        bloomMix: 0,
        // Shape Formation Blending
        shapeX: rx,
        shapeY: ry,
        shapeZ: rz,
        shapeMix: 0,
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
      if (p.role === "background") {
        const friction = 0.985; // Only dampen background stars
        p.vx *= friction;
        p.vy *= friction;
        p.vz *= friction;
      }
      // No friction for "shape" particles means they will continue at high speed forever until recycled/reused

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ATOMOSPHERIC DRIFT (Gentle Rotation)
      if (p.role === "background") {
        const rotSpeed = 0.06 * dt; // Increased for more dynamic feel
        const cos = Math.cos(rotSpeed);
        const sin = Math.sin(rotSpeed);
        const nx = p.x * cos - p.z * sin;
        const nz = p.x * sin + p.z * cos;
        p.x = nx;
        p.z = nz;
      }
      // The following block of code was provided in the instruction but appears to be
      // logic for a controller that *uses* the ParticleSystem, not part of the
      // ParticleSystem's internal update method. Inserting it here would cause
      // syntax errors due to undeclared variables (shapeName, this.shapeGenerator, etc.).
      // Therefore, it has been omitted to maintain a syntactically correct file.
      /*
      if (shapeName === "HEART_SHAPE") {
      points = this.shapeGenerator.generateHeartPoints(0, 0, heartScale, 6000); 
    } else {
      const fontSize = shapeName.length > 5 ? baseFontSize * 0.8 : baseFontSize;
      points = this.shapeGenerator.generateTextPoints(
        shapeName,
        0,
        0,
        fontSize,
        8000, 
      );
    }
      */
      // ROLE BASED BEHAVIOR (Background Looping / Recycling)
      if (p.role === "background") {
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        const limit = 2500;

        // If a star drifts too far, "recycle" it to the edge with inward velocity
        if (dist > limit) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          // Respawn at a distance that is visibly "entering" the frame (1800)
          const spawnDist = 2000;
          p.x = spawnDist * Math.sin(phi) * Math.cos(theta);
          p.y = spawnDist * Math.sin(phi) * Math.sin(theta);
          p.z = spawnDist * Math.cos(phi);

          // Give it a clear inward push
          const speed = 40 + Math.random() * 50;
          p.vx = -(p.x / spawnDist) * speed;
          p.vy = -(p.y / spawnDist) * speed;
          p.vz = -(p.z / spawnDist) * speed;
        }
      }

      // BLENDED RENDERING
      // 1. Base / Shape Interpolation
      let renderX = p.x * (1 - p.shapeMix) + p.shapeX * p.shapeMix;
      let renderY = p.y * (1 - p.shapeMix) + p.shapeY * p.shapeMix;
      let renderZ = p.z * (1 - p.shapeMix) + p.shapeZ * p.shapeMix;

      // 2. Bloom Overlay (Secondary Blend)
      renderX = renderX * (1 - p.bloomMix) + p.bloomX * p.bloomMix;
      renderY = renderY * (1 - p.bloomMix) + p.bloomY * p.bloomMix;
      renderZ = renderZ * (1 - p.bloomMix) + p.bloomZ * p.bloomMix;

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
