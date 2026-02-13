import * as THREE from "three";
import gsap from "gsap";
import { ShapeGenerator } from "../shake/ShapeGenerator.js";

export class BloomController {
  constructor(particleSystem) {
    this.particleSystem = particleSystem;
    this.active = false;
    this.center3D = new THREE.Vector3();
    this.initialDistance = 0;
    this.bloomFactor = 0;
    this.shapeGenerator = new ShapeGenerator();
    this.bloomParticles = [];
    this.targetShapePoints = [];
    this.textRevealed = false;

    // Use a subset of particles
    const isMobile = window.innerWidth < 600;
    const totalShapes = Math.floor(this.particleSystem.maxParticles * 0.75);
    this.poolStart = isMobile ? 3000 : 6000;
    this.poolEnd = isMobile ? 6000 : 9000; // Tighter pool for a thinner look

    // Simulation for Desktop
    this.isMouseDown = false;
    this.lastMouseY = 0;
    this.celebrated = false;
    this.touchCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.lockCenter = { x: 0, y: 0 };
    this.isLocked = false;
  }

  async init() {
    const isMobile = window.innerWidth < 600;
    const heartScale = isMobile ? 150 : 350; // Lowered from 180

    this.targetShapePoints = this.shapeGenerator.generateHeartPoints(
      0,
      0,
      heartScale,
      2800, // Reduced density for a thinner, more elegant heart
    );

    // Mobile Listeners
    window.addEventListener("touchstart", this.onTouchStart.bind(this), {
      passive: false,
    });
    window.addEventListener("touchmove", this.onTouchMove.bind(this), {
      passive: false,
    });
    window.addEventListener("touchend", this.onTouchEnd.bind(this));

    // Desktop Simulation (Shift + Drag)
    window.addEventListener("mousedown", this.onMouseDown.bind(this));
    window.addEventListener("mousemove", this.onMouseMove.bind(this));
    window.addEventListener("mouseup", this.onMouseUp.bind(this));

    // Desktop Simulation (Scrollwheel)
    window.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });
    this.scrollTimeout = null;

    // Show hint after 3 seconds if not hidden by shake
    setTimeout(() => {
      const hint = document.querySelector(".pinch-hint");
      if (hint && hint.classList.contains("hidden")) {
        hint.classList.remove("hidden");
      }
    }, 5000);
  }

  onWheel(e) {
    if (e.preventDefault) e.preventDefault();

    if (!this.active) {
      this.active = true;
      this.prepareBloomParticles(window.innerWidth / 2, window.innerHeight / 2);
    }

    const sensitivity = 0.001;
    const delta = Math.min(100, Math.max(-100, e.deltaY));
    this.bloomFactor = Math.min(
      1.0,
      Math.max(0, this.bloomFactor + delta * sensitivity),
    );

    this.updateBloom();

    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      if (!this.isMouseDown) {
        this.onTouchEnd();
      }
    }, 1000);
  }

  onMouseDown(e) {
    if (e.shiftKey) {
      this.active = true;
      this.initialDistance = 100;
      this.isMouseDown = true;
      this.lastMouseY = e.clientY;
      this.prepareBloomParticles(e.clientX, e.clientY);
    }
  }

  onMouseMove(e) {
    if (this.active && this.isMouseDown && e.shiftKey) {
      const delta = (this.lastMouseY - e.clientY) * 3; // Increased simulation speed
      this.bloomFactor = Math.min(1.0, Math.max(0, delta / 200));
      this.updateBloom();
    }
  }

  onMouseUp() {
    if (this.isMouseDown) {
      this.isMouseDown = false;
      this.onTouchEnd();
    }
  }

  onTouchStart(e) {
    if (e.touches && e.touches.length === 2) {
      if (e.preventDefault) e.preventDefault();
      this.active = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.initialDistance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      this.touchCenter.x = (t1.clientX + t2.clientX) / 2;
      this.touchCenter.y = (t1.clientY + t2.clientY) / 2;
      this.prepareBloomParticles(this.touchCenter.x, this.touchCenter.y);
    }
  }

  prepareBloomParticles(centerX, centerY) {
    const aspect = window.innerWidth / window.innerHeight;
    this.center3D.set(
      (centerX / window.innerWidth) * 2 - 1,
      -(centerY / window.innerHeight) * 2 + 1,
      0,
    );
    // Multiply by responsive bounds
    this.center3D.x *= 450; // Slightly wider range

    // Perfect mobile centering:
    // Camera Z=600, FOV=75 -> Total visible height at Z=0 is ~920 units.
    // Half height is ~460.
    this.center3D.y *= 460;

    // Add offset for mobile UI elements that might push focus higher
    if (aspect < 1) {
      this.center3D.y += 100; // Push center higher as users usually pinch in the lower half
    }

    this.bloomParticles = this.particleSystem.particles.slice(
      this.poolStart,
      this.poolEnd,
    );
    this.bloomParticles.forEach((p) => {
      p.state = "blooming";
      gsap.killTweensOf(p);
      p.vx = p.vy = p.vz = 0; // Stop drift briefly for cleaner form
    });
  }

  onTouchMove(e) {
    if (this.active && e.touches && e.touches.length === 2) {
      if (e.preventDefault) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDistance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );

      this.touchCenter.x = (t1.clientX + t2.clientX) / 2;
      this.touchCenter.y = (t1.clientY + t2.clientY) / 2;

      this.bloomFactor = Math.min(
        1.0,
        Math.max(0, (currentDistance / this.initialDistance - 1) * 0.8), // Reduced to 0.8 for smooth bloom
      );
      this.updateBloom();
    }
  }

  updateUI() {
    const instruction = document.querySelector(".instruction");
    const bloomMsg = document.querySelector("#bloom-message");
    const f = this.bloomFactor;

    if (!instruction || !bloomMsg) return;

    // ZONE 1: Idle / Start (0.0 - 0.2) -> Show Bottom Instruction
    if (f < 0.2) {
      instruction.classList.remove("hidden");
      bloomMsg.classList.add("hidden");

      const opacity = 1 - f / 0.2;
      instruction.style.opacity = Math.max(0, opacity);
    }
    // ZONE 2: Transition (0.2 - 0.8) -> Hide Everything
    else if (f < 0.8) {
      instruction.style.opacity = 0;
      bloomMsg.classList.add("hidden");
    }
    // ZONE 3: Full Bloom (0.8 - 1.0) -> Show Center Message
    else {
      instruction.classList.add("hidden");
      bloomMsg.classList.remove("hidden");

      const opacity = (f - 0.8) / 0.2;
      bloomMsg.style.opacity = Math.min(1, opacity);

      // LOCKING LOGIC: If full bloom, use the locked center. Otherwise follow fingers.
      const displayX = this.isLocked ? this.lockCenter.x : this.touchCenter.x;
      const displayY = this.isLocked ? this.lockCenter.y : this.touchCenter.y;

      bloomMsg.style.left = `${displayX}px`;
      bloomMsg.style.top = `${displayY}px`;
      bloomMsg.style.transform = `translate(-50%, -50%) scale(${1 + (f - 0.8)})`;
    }
  }

  updateBloom() {
    this.bloomParticles.forEach((p, i) => {
      const targetIndex = i % this.targetShapePoints.length;
      const target = this.targetShapePoints[targetIndex];
      const f = this.bloomFactor;

      p.bloomX = this.center3D.x + target.x;
      p.bloomY = this.center3D.y - target.y;
      p.bloomZ = target.z || 0;
      p.bloomMix = f; // This controls the density directly
    });

    // CELEBRATION BURST (One-time pop when full)
    if (this.bloomFactor > 0.99 && !this.celebrated) {
      this.celebrated = true;

      // LOCK POSITION for UI text
      this.isLocked = true;
      this.lockCenter.x = this.touchCenter.x;
      this.lockCenter.y = this.touchCenter.y;

      gsap.to(this.bloomParticles, {
        bloomMix: 1.5, // Over-bloom for a moment
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      });
    } else if (this.bloomFactor < 0.9) {
      this.celebrated = false;
      this.isLocked = false;
    }

    // Continuous UI update based on bloomFactor
    this.updateUI();
  }

  onTouchEnd() {
    this.active = false;
    this.bloomFactor = 0;
    this.isLocked = false; // Reset lock
    this.updateUI();

    // SEAMLESS EXPLOSION: No more tweening bloomMix to 0
    this.bloomParticles.forEach((p) => {
      // 1. Capture current visual position (Center + Offset)
      p.x = p.bloomX;
      p.y = p.bloomY;
      p.z = p.bloomZ;

      // 2. Kill shape influence
      p.bloomMix = 0;

      // 3. High-speed exit blast
      p.state = "chaos";
      const impulse = 180 + Math.random() * 120;
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * impulse;
      p.vy = Math.sin(angle) * impulse;
      p.vz = (Math.random() - 0.5) * impulse;
    });

    this.bloomParticles = []; // Clear the array as particles are now in chaos
  }

  update(dt) {
    if (this.active) {
      // Jitter during bloom
      this.bloomParticles.forEach((p) => {
        p.x += (Math.random() - 0.5) * 2;
        p.y += (Math.random() - 0.5) * 2;
      });
    }
  }
}
