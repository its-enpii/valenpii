# 🌹 3D Starry Valentine: Particle Magic

A premium, interactive 3D Valentine's experience built with **Three.js** and **GSAP**. Watch thousands of stars dance and form romantic shapes through motion and touch.

## ✨ Features

### 1. Shake for Love 📱

- **Interaction**: Physically shake your device (or click once on Desktop).
- **Effect**: Thousands of stars fly from a chaotic galaxy to form dense 3D shapes.
- **Shapes**: Cycles through "LOVE", "BE MINE", and a crystalline Heart.

### 2. Pinch to Bloom 🌸

- **Interaction**: Use two fingers to pinch out (or use Scroll Wheel / Shift+Drag on Desktop).
- **Effect**: Gently pull stars from their natural drift into a glowing, breathing heart.
- **Reveal**: Flourishing text appears when the heart is fully bloomed.

### 3. Cosmic Atmosphere 🌌

- **Vast Galaxy**: Up to 25,000 unique stars with individual twinkling and motion.
- **Cinematic Bloom**: Soft pendaran glow via Post-processing.
- **Romantic Vignette**: Deep burgundy radial background for enhanced depth.

## 🛠️ Tech Stack

- **Graphics**: Three.js (BufferGeometry & Custom Shaders)
- **Animation**: GSAP (Batch Interpolation)
- **Tooling**: Vite (Minimal & Fast)
- **Typography**: opentype.js (Vector Path Sampling)

## 🚀 Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run development server**:

   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## 🎮 Controls

| Action          | Mobile          | Desktop (Simulation)           |
| :-------------- | :-------------- | :----------------------------- |
| **Form Shape**  | Shake Device    | Click once                     |
| **Bloom Heart** | Pinch Out       | Scroll Down                    |
| **Bloom Level** | Pinch Distance  | Shift + Mouse Drag Up          |
| **Explode**     | Release Fingers | Stop Scrolling / Release Mouse |

---

_Created with ❤️ for Valentine's Day 2026_
