import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { SceneBackground } from "./SceneBackground.js";
import { ShakeController } from "../features/shake/ShakeController.js";
import { BloomController } from "../features/bloom/BloomController.js";

export class App {
  constructor() {
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent to let CSS background show

    // 2. Camera Setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 4000);
    this.camera.position.z = 600;

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Performance for 16k stars
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(this.renderer.domElement);

    // 4. Post Processing (BLOOM EFFECT)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const isMobile = window.innerWidth < 600;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      isMobile ? 1.5 : 1.1, // Softer on Desktop
      0.8, // Radius
      isMobile ? 0.15 : 0.4, // Strict threshold for Desktop to prevent screen-burn
    );
    this.composer.addPass(this.bloomPass);

    // 5. Core Modules
    this.background = new SceneBackground(this.scene);
    this.particleSystem = new ParticleSystem(this.scene);
    this.shakeController = new ShakeController(this.particleSystem);
    this.bloomController = new BloomController(this.particleSystem);

    this.clock = new THREE.Clock();
  }

  async init() {
    await this.particleSystem.init();
    await this.shakeController.init();
    await this.bloomController.init();

    this.renderer.setAnimationLoop(() => this.render());
    window.addEventListener("resize", () => this.onResize());

    // Mouse Tracking for Magic Trail
    this.mouse = new THREE.Vector2(-999, -999);
    window.addEventListener("mousemove", (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          this.mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
          this.mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
      },
      { passive: true },
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) {
          this.mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
          this.mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
      },
      { passive: true },
    );
  }

  render() {
    const dt = Math.min(0.05, this.clock.getDelta());

    this.shakeController.update(dt);
    this.bloomController.update(dt);

    // Role-based coordinate
    this.particleSystem.isInteracting =
      this.shakeController.isShaking || this.bloomController.active;

    this.particleSystem.update(dt, this.mouse);

    // Use Composer for Bloom
    this.composer.render();
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }
}
