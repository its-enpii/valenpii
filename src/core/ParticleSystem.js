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

    // Phase 65: Interaction Pulses (Shockwaves)
    this.pulses = [];
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
        
        // Hard cap to prevent white-out on desktop. 45.0 is safe for all.
        gl_PointSize = min(pSize, 45.0); 
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
    const isMobile = window.innerWidth < 600;
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

        // Initial inward drift - Brisk movement (Phase 56)
        const speed = 120 + Math.random() * 100;
        vx = -(rx / radius) * speed;
        vy = -(ry / radius) * speed;
        vz = -(rz / radius) * speed;
      } else {
        // Shape stars start in chaos with a vibrant random drift
        const radius = 1000 + Math.random() * 1000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        rx = radius * Math.sin(phi) * Math.cos(theta);
        ry = radius * Math.sin(phi) * Math.sin(theta);
        rz = radius * Math.cos(phi);

        const impulse = 120 + Math.random() * 80;
        const angle = Math.random() * Math.PI * 2;
        vx = Math.cos(angle) * impulse;
        vy = Math.sin(angle) * impulse;
        vz = (Math.random() - 0.5) * impulse;
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
        baseSize: isMobile ? Math.random() * 12 + 8 : Math.random() * 8 + 4, // Half size on Desktop
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

    // Phase 67: Corrected mapping for full-corner coverage
    const mX = mouse ? mouse.x * 450 : -9999;
    const mY = mouse ? mouse.y * 460 : -9999;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];

      // Phase 65/68: Shockwave Pulse Processing (Perspective Aware)
      this.pulses.forEach((pulse) => {
        // Project particle world position to its apparent screen position at Z=0
        // Camera is at Z=600. Factor = 600 / (600 - p.z)
        const perspectiveFactor = 600 / Math.max(1, 600 - p.z);
        const apparentX = p.x * perspectiveFactor;
        const apparentY = p.y * perspectiveFactor;

        const dx = apparentX - pulse.x;
        const dy = apparentY - pulse.y;
        const distSq = dx * dx + dy * dy;

        // Shockwave shell (Expanding ring)
        const age = 1.0 - pulse.life; // 0 -> 1
        const currentRadius = pulse.maxRadius * age;
        const dist = Math.sqrt(distSq);

        // Define a shell thickness (e.g., 60 units)
        const thickness = 70; // Slightly increased for Phase 68
        const diff = Math.abs(dist - currentRadius);

        if (diff < thickness) {
          // Push force increases with life and proximity to shell edge
          const force =
            (1 - diff / thickness) * pulse.strength * pulse.life * dt;
          const mag = dist || 1;

          // Apply push in world space, adjusted for perspective to look consistent
          p.vx += (dx / mag) * force * (1 / perspectiveFactor);
          p.vy += (dy / mag) * force * (1 / perspectiveFactor);

          // Phase 68: Add a tiny Z-kick to make it feel 3D
          p.vz += (Math.random() - 0.5) * force * 0.5;
        }
      });

      // BASE PHYSICS (The "Chaos" drift)
      if (p.state === "chaos") {
        const friction = 0.992; // Phase 63: Reduced friction for better inertia (0.985 -> 0.992)
        p.vx *= friction;
        p.vy *= friction;
        p.vz *= friction;

        if (p.role === "background") {
          // Phase 56: Minimum Vitality Check
          const speedSq = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
          if (speedSq < 1600) {
            // min speed ~40
            const boost = 1.05;
            p.vx *= boost;
            p.vy *= boost;
            p.vz *= boost;

            // Add a tiny random jitter to prevent "dead" straight lines
            p.vx += (Math.random() - 0.5) * 5;
            p.vy += (Math.random() - 0.5) * 5;
            p.vz += (Math.random() - 0.5) * 5;
          }
        } else {
          // Constant Brownian noise jitter for shape stars (Phase 56)
          p.vx += (Math.random() - 0.5) * 2.0;
          p.vy += (Math.random() - 0.5) * 2.0;
          p.vz += (Math.random() - 0.5) * 2.0;
        }
      }
      // No friction for "shape" particles means they will continue at high speed forever until recycled/reused

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ATOMOSPHERIC DRIFT (Gentle Rotation)
      if (p.role === "background") {
        const rotSpeed = 0.15 * dt; // Increased for Phase 39 (0.06 -> 0.15)
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
      // ROLE BASED BEHAVIOR (Global Looping / Recycling - Phase 64)
      const distSq = p.x * p.x + p.y * p.y + p.z * p.z;
      const limitSq = 4000 * 4000; // Phase 64: Expanded to 4000

      if (distSq > limitSq) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const spawnDist = 2500;
        p.x = spawnDist * Math.sin(phi) * Math.cos(theta);
        p.y = spawnDist * Math.sin(phi) * Math.sin(theta);
        p.z = spawnDist * Math.cos(phi);

        // Phase 64: Centrifugal Recycling (Avoids visual center)
        // Target the "outer ring" (1500 - 2500 range)
        const targetRadius = 1500 + Math.random() * 1000;
        const targetTheta = Math.random() * Math.PI * 2;
        const targetPhi = Math.acos(2 * Math.random() - 1);

        const targetX =
          targetRadius * Math.sin(targetPhi) * Math.cos(targetTheta);
        const targetY =
          targetRadius * Math.sin(targetPhi) * Math.sin(targetTheta);
        const targetZ = targetRadius * Math.cos(targetPhi);

        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const dz = targetZ - p.z;
        const dMag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

        const speed = 120 + Math.random() * 150;
        p.vx = (dx / dMag) * speed;
        p.vy = (dy / dMag) * speed;
        p.vz = (dz / dMag) * speed;
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
      if (p.state === "blooming" || p.state === "forming") {
        scale *= 1.1 * beatScale; // Uniform subtle glow for all interactive shapes
      } else if (p.state === "chaos") {
        scale *= 1.8; // Phase 64: Reduced (3.0 -> 1.8) for dense star parity
      }

      sizeAttr.array[i] = p.baseSize * scale;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    // Update and prune pulses
    this.pulses.forEach((p) => (p.life -= dt * 1.5)); // Fast decay
    this.pulses = this.pulses.filter((p) => p.life > 0);

    // Auto-Pulse for Desktop Hover (Transient Magic Trail)
    if (mX > -9000) {
      // Trigger a small pulse every 2nd frame or so to keep it fluid but light
      if (Math.random() > 0.7) {
        this.addPulse(mX, mY, 80, 150);
      }
    }
  }

  addPulse(x, y, strength = 400, radius = 300) {
    this.pulses.push({
      x,
      y,
      strength,
      maxRadius: radius,
      life: 1.0,
    });

    // Limit active pulses for performance
    if (this.pulses.length > 10) this.pulses.shift();
  }
}
