import * as THREE from "three";
import gsap from "gsap";
import { ShapeGenerator } from "./ShapeGenerator.js";

export class ShakeController {
  constructor(particleSystem) {
    this.particleSystem = particleSystem;
    this.shapeGenerator = new ShapeGenerator();

    this.shapes = ["Love", "HEART_SHAPE", "Be Mine"];
    this.currentShapeIndex = 0;
    this.shakeThreshold = 8; // Lowered from 15 for better mobile sensitivity
    this.sustainTimeout = 1500; // 1.5s delay after stopping shake as requested
    this.isReady = false; // Guard against initial sensor noise

    this.colors = [
      new THREE.Color(0xff1493),
      new THREE.Color(0xff69b4),
      new THREE.Color(0xffb6c1),
      new THREE.Color(0xdc143c),
      new THREE.Color(0xffffff),
      new THREE.Color(0xff0000),
    ];

    this.isShaking = false;
    this.lastShakeTime = 0;
    this.onDeviceMotion = this.onDeviceMotion.bind(this);
    this.checkMotionPermission = this.checkMotionPermission.bind(this);
  }

  async init() {
    await this.shapeGenerator.load();
    this.particleSystem.createPool(this.particleSystem.maxParticles);
    this.setChaosMode(true);
    this.setupPermissions();
    // FALLBACK: Single click/tap to switch shapes if shake is unavailable
    window.addEventListener("click", () => {
      if (!this.isShaking) {
        this.handleShake(20); // Force a shake trigger
      }
    });

    // Safety delay
    setTimeout(() => {
      this.isReady = true;
    }, 2000);
  }

  setupPermissions() {
    const btn = document.getElementById("permission-btn");
    if (btn) {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
      ) {
        btn.classList.remove("hidden");
        btn.addEventListener("click", this.checkMotionPermission);
      } else {
        window.addEventListener("devicemotion", this.onDeviceMotion);
      }
    }
  }

  checkMotionPermission() {
    DeviceMotionEvent.requestPermission()
      .then((state) => {
        if (state === "granted") {
          window.addEventListener("devicemotion", this.onDeviceMotion);
          document.getElementById("permission-btn").classList.add("hidden");
        }
      })
      .catch(console.error);
  }

  triggerShakeSimulation() {
    this.handleShake(20);
    let pulses = 0;
    const interval = setInterval(() => {
      this.handleShake(20);
      pulses++;
      if (pulses > 10) clearInterval(interval);
    }, 100);
  }

  onDeviceMotion(e) {
    let mag = 0;

    // Check linear acceleration (most precise)
    const acc = e.acceleration;
    if (acc && typeof acc.x === "number" && acc.x !== null) {
      // Use max absolute component for better axis-independent sensitivity
      mag = Math.max(Math.abs(acc.x), Math.abs(acc.y), Math.abs(acc.z));
    }
    // Fallback to acceleration with gravity
    else if (e.accelerationIncludingGravity) {
      const accG = e.accelerationIncludingGravity;
      if (typeof accG.x === "number") {
        // Look for deviation from gravity on ANY axis
        const dx = Math.abs(accG.x);
        const dy = Math.abs(accG.y);
        const dz = Math.abs(accG.z);
        // We look for any component that significantly changes
        // Since gravity is 9.8 on ONE axis, we look for values far from 0 OR far from 9.8
        mag = Math.max(dx, dy, Math.abs(dz - 9.8));
      }
    }
    this.handleShake(mag);
  }

  handleShake(magnitude) {
    if (!this.isReady) return;

    // Hysteresis logic:
    // 8.0 to START (aggressive enough)
    // 3.0 to SUSTAIN (keep it alive during slow parts of shake)
    const sustainThreshold = 3.0;

    if (magnitude > this.shakeThreshold) {
      this.lastShakeTime = Date.now();
      if (!this.isShaking) {
        this.startShaking();
      }
    } else if (this.isShaking && magnitude > sustainThreshold) {
      // Keep resetting the timer while movement is still detected
      this.lastShakeTime = Date.now();
    }
  }

  startShaking() {
    this.isShaking = true;
    const shapeName = this.shapes[this.currentShapeIndex];
    let points = [];

    // RESPONSIVE SCALING
    const isMobile = window.innerWidth < 600;
    const heartScale = isMobile ? 150 : 300; // Lowered from 220
    const baseFontSize = isMobile ? 100 : 220; // Lowered from 120

    if (shapeName === "HEART_SHAPE") {
      points = this.shapeGenerator.generateHeartPoints(0, 0, heartScale, 8000);
    } else {
      const fontSize = shapeName.length > 5 ? baseFontSize * 0.8 : baseFontSize;
      points = this.shapeGenerator.generateTextPoints(
        shapeName,
        0,
        0,
        fontSize,
        10000,
      );
    }

    const particles = this.particleSystem.particles;
    const targets = [];

    particles.forEach((p, i) => {
      if (p.role !== "shape") return;

      if (i < points.length) {
        p.state = "forming";
        p.shapeX = points[i].x;
        p.shapeY = -points[i].y;
        p.shapeZ = points[i].z || 0;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        targets.push(p);
      } else if (p.state !== "chaos" && p.state !== "blooming") {
        p.state = "chaos";
        p.shapeMix = 0; // Ensure they don't try to form
      }
    });

    // BATCH ANIMATION: Use a proxy to animate shapeMix for all targets
    const proxy = { value: 0 };
    gsap.killTweensOf(targets); // Kill any existing individual tweens just in case
    gsap.to(proxy, {
      value: 1,
      duration: 1.0,
      ease: "power3.out",
      onUpdate: () => {
        targets.forEach((p) => {
          if (p.state === "forming") p.shapeMix = proxy.value;
        });
      },
    });
  }

  stopShaking() {
    this.isShaking = false;
    this.currentShapeIndex = (this.currentShapeIndex + 1) % this.shapes.length;

    // INSTANT SEAMLESS EXPLOSION
    const shapeParticles = this.particleSystem.particles.filter(
      (p) => p.state === "forming",
    );

    shapeParticles.forEach((p) => {
      // 1. Capture current visual position into the physical 'x'
      p.x = p.shapeX;
      p.y = p.shapeY;
      p.z = p.shapeZ;

      // 2. Kill the influence of the shape formation
      p.shapeMix = 0;

      // 3. Apply high-speed exit blast
      p.state = "chaos";
      const impulse = 150 + Math.random() * 150;
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * impulse;
      p.vy = Math.sin(angle) * impulse;
      p.vz = (Math.random() - 0.5) * impulse;
    });

    // Cleanup background stars (optional, ensures they return nicely)
    this.setChaosMode();
  }

  setChaosMode(initial = false) {
    const particles = this.particleSystem.particles;
    const colorAttr = this.particleSystem.geometry.attributes.color;

    particles.forEach((p, i) => {
      if (p.state === "blooming") return; // Don't interrupt bloom

      p.state = "chaos";
      const radius = 600 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const tx = radius * Math.sin(phi) * Math.cos(theta);
      const ty = radius * Math.sin(phi) * Math.sin(theta);
      const tz = radius * Math.cos(phi);

      if (initial) {
        p.x = tx;
        p.y = ty;
        p.z = tz;
        const color =
          this.colors[Math.floor(Math.random() * this.colors.length)];
        colorAttr.array[i * 3] = color.r;
        colorAttr.array[i * 3 + 1] = color.g;
        colorAttr.array[i * 3 + 2] = color.b;
      } else {
        // OPTIMIZED: High-speed explosion back to chaos
        gsap.killTweensOf(p);
        const impulse = 120 + Math.random() * 80; // Doubled speed (60-120 -> 120-200)
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * impulse;
        p.vy = Math.sin(angle) * impulse;
        p.vz = (Math.random() - 0.5) * impulse;
      }
    });
    colorAttr.needsUpdate = true;
  }

  update(dt) {
    if (
      this.isShaking &&
      Date.now() - this.lastShakeTime > this.sustainTimeout
    ) {
      this.stopShaking();
    }

    const particles = this.particleSystem.particles;
    for (const p of particles) {
      if (p.state === "forming") {
        // Heartbeat Logic for Shake
        const time = Date.now() * 0.002;
        const beat = Math.pow(Math.sin(time * 3.0), 60);
        const beatTranslate = beat * 1.5; // Slight push outward

        // We can't easily scale the whole shape here without storing the target original position.
        // So we add a small jitter/push that simulates energy.
        // OR better: we don't do full shape scaling here because it's complex to reconstruct the center.
        // Let's just add a "breath" effect to the noise.

        p.x += (Math.random() - 0.5) * (1.5 + beatTranslate);
        p.y += (Math.random() - 0.5) * (1.5 + beatTranslate);
        p.z += (Math.random() - 0.5) * (2 + beatTranslate);
      } else if (p.state === "chaos") {
        // GALAXY DRIFT handled by ParticleSystem for all background stars
      }
    }
  }
}
