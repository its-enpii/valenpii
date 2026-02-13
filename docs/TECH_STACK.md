# Technology Stack Deep Dive

**Detailed analysis of each technology choice and integration patterns.**

---

## Core Technologies

### PixiJS v7 - WebGL Rendering Engine

**Why PixiJS over alternatives:**

| Technology | Performance | Bundle Size | Learning Curve | Mobile Support |
|------------|-------------|-------------|----------------|----------------|
| Canvas 2D | Baseline | 0KB | Easy | Good |
| PixiJS | 5-10x faster | 180KB | Medium | Excellent |
| Three.js | Overkill | 600KB | Hard | Good |
| Phaser | Game-focused | 1.2MB | Medium | Good |

**Integration Pattern:**

```javascript
import * as PIXI from 'pixi.js';

class PixiManager {
  constructor(container) {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0a0a0a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      powerPreference: 'high-performance',
      hello: false // Disable console banner
    });
    
    container.appendChild(this.app.view);
    this.app.ticker.add(this.update, this);
  }

  update(delta) {
    // delta is frame time multiplier (1 = 60fps)
    // Convert to seconds: dt = delta / 60
    const dt = delta / 60;
    this.particleSystem.update(dt);
  }
}
```

**Key Features Used:**

1. **Graphics API** - Batch rendering
   ```javascript
   const graphics = new PIXI.Graphics();
   graphics.beginFill(0xFFFFFF, 0.8);
   particles.forEach(p => {
     graphics.drawCircle(p.x, p.y, p.size);
   });
   graphics.endFill();
   ```

2. **Container Hierarchy**
   ```javascript
   app.stage (root)
   ├── particleContainer
   ├── uiContainer
   └── effectsContainer
   ```

3. **Filters** (optional glow)
   ```javascript
   import { GlowFilter } from '@pixi/filter-glow';
   const glow = new GlowFilter({
     distance: 15,
     outerStrength: 2,
     color: 0xff1493
   });
   container.filters = [glow];
   ```

**Performance Optimization:**

```javascript
// Use ParticleContainer for static particles (10x faster)
import { ParticleContainer } from 'pixi.js';

const particles = new ParticleContainer(1000, {
  scale: false,
  position: true,
  rotation: false,
  uvs: false,
  alpha: true
});

// Caveat: Limited features but massive performance gain
```

---

### GSAP 3 - Animation Engine

**Why GSAP over alternatives:**

- **CSS Transitions**: Limited control, no complex sequences
- **Web Animations API**: Poor mobile support, fewer easing options
- **anime.js**: Lighter but fewer features
- **GSAP**: Industry standard, best performance, most features

**Core Usage Patterns:**

```javascript
import gsap from 'gsap';

// 1. Simple tween
gsap.to(particle, {
  x: targetX,
  y: targetY,
  duration: 1.5,
  ease: 'expo.out'
});

// 2. Timeline for sequences
const tl = gsap.timeline();
tl.to(particles, { alpha: 0, duration: 0.3 })
  .call(() => this.reshapeParticles())
  .to(particles, { alpha: 1, duration: 0.5 });

// 3. Stagger for wave effects
gsap.to(particles, {
  y: '+=20',
  duration: 0.8,
  stagger: {
    each: 0.02,
    from: 'center'
  },
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1
});

// 4. Custom ease for natural movement
gsap.to(particle, {
  x: target.x,
  y: target.y,
  duration: 1.5,
  ease: 'elastic.out(1, 0.3)' // Bouncy
});
```

**Advanced: Custom Plugin**

```javascript
gsap.registerPlugin({
  name: 'particle',
  init(target, value) {
    this.target = target;
    this.start = { x: target.x, y: target.y };
    this.end = value;
  },
  render(progress, data) {
    const eased = data.ease(progress);
    data.target.x = data.start.x + (data.end.x - data.start.x) * eased;
    data.target.y = data.start.y + (data.end.y - data.start.y) * eased;
  }
});
```

**Performance Tips:**

```javascript
// ✅ Batch updates
gsap.set(particles, { alpha: 0.5 }); // Single call

// ❌ Individual updates
particles.forEach(p => gsap.set(p, { alpha: 0.5 })); // N calls

// ✅ Kill animations on cleanup
timeline.kill();

// ✅ Use will-change for better performance
gsap.set(element, { willChange: 'transform' });
```

---

### opentype.js - Font Path Extraction

**Purpose:** Convert text to vector coordinates for particle placement.

**Integration:**

```javascript
import opentype from 'opentype.js';

class FontManager {
  constructor() {
    this.fonts = new Map();
  }

  async loadFont(name, url) {
    return new Promise((resolve, reject) => {
      opentype.load(url, (err, font) => {
        if (err) reject(err);
        else {
          this.fonts.set(name, font);
          resolve(font);
        }
      });
    });
  }

  textToPoints(text, fontName, options = {}) {
    const font = this.fonts.get(fontName);
    if (!font) throw new Error(`Font ${fontName} not loaded`);

    const {
      fontSize = 200,
      density = 2, // Points per unit
      letterSpacing = 0
    } = options;

    const path = font.getPath(text, 0, 0, fontSize);
    const points = [];

    // Sample path commands
    let currentX = 0;
    let currentY = 0;

    path.commands.forEach(cmd => {
      switch(cmd.type) {
        case 'M': // MoveTo
          currentX = cmd.x;
          currentY = cmd.y;
          points.push({ x: currentX, y: currentY });
          break;

        case 'L': // LineTo
          const samples = this._sampleLine(
            currentX, currentY,
            cmd.x, cmd.y,
            density
          );
          points.push(...samples);
          currentX = cmd.x;
          currentY = cmd.y;
          break;

        case 'C': // Cubic Bezier
          const bezierSamples = this._sampleCubicBezier(
            currentX, currentY,
            cmd.x1, cmd.y1,
            cmd.x2, cmd.y2,
            cmd.x, cmd.y,
            density
          );
          points.push(...bezierSamples);
          currentX = cmd.x;
          currentY = cmd.y;
          break;

        case 'Q': // Quadratic Bezier
          const quadSamples = this._sampleQuadraticBezier(
            currentX, currentY,
            cmd.x1, cmd.y1,
            cmd.x, cmd.y,
            density
          );
          points.push(...quadSamples);
          currentX = cmd.x;
          currentY = cmd.y;
          break;
      }
    });

    return this._centerAndScale(points);
  }

  _sampleLine(x1, y1, x2, y2, density) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const samples = Math.max(2, Math.floor(distance * density));
    const points = [];

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      points.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t
      });
    }

    return points;
  }

  _sampleCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, density) {
    const points = [];
    const samples = Math.floor(density * 20);

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const t2 = t * t;
      const t3 = t2 * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;

      points.push({
        x: mt3*x0 + 3*mt2*t*x1 + 3*mt*t2*x2 + t3*x3,
        y: mt3*y0 + 3*mt2*t*y1 + 3*mt*t2*y2 + t3*y3
      });
    }

    return points;
  }

  _centerAndScale(points) {
    // Find bounding box
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Scale to fit screen
    const scale = Math.min(
      window.innerWidth * 0.8 / width,
      window.innerHeight * 0.8 / height
    );

    return points.map(p => ({
      x: (p.x - centerX) * scale + window.innerWidth / 2,
      y: (p.y - centerY) * scale + window.innerHeight / 2
    }));
  }
}
```

**Font Loading Strategy:**

```javascript
// Preload critical fonts
const fonts = [
  { name: 'display', url: '/fonts/display.ttf' },
  { name: 'mono', url: '/fonts/mono.ttf' }
];

Promise.all(
  fonts.map(f => fontManager.loadFont(f.name, f.url))
).then(() => {
  console.log('All fonts loaded');
  app.init();
});
```

---

### Howler.js - Audio Management (Optional)

**Why Audio?**
- Subtle feedback enhances UX
- Reinforces interactions
- Adds emotional dimension

**Implementation:**

```javascript
import { Howl, Howler } from 'howler';

class AudioManager {
  constructor() {
    this.sounds = new Map();
    this.enabled = true;
    Howler.volume(0.3); // Global volume
  }

  load(name, src, options = {}) {
    const sound = new Howl({
      src: [src],
      volume: options.volume || 1.0,
      loop: options.loop || false,
      preload: true
    });

    this.sounds.set(name, sound);
    return sound;
  }

  play(name, options = {}) {
    if (!this.enabled) return;
    
    const sound = this.sounds.get(name);
    if (!sound) return;

    if (options.volume) sound.volume(options.volume);
    sound.play();
  }

  toggle() {
    this.enabled = !this.enabled;
    Howler.mute(!this.enabled);
  }
}

// Usage
const audio = new AudioManager();
audio.load('shake', '/sounds/shake.mp3', { volume: 0.5 });
audio.load('bloom', '/sounds/bloom.mp3', { volume: 0.4 });
audio.load('settle', '/sounds/settle.mp3', { volume: 0.3 });

// In shake mode
onShake() {
  audio.play('shake');
}

onSettle() {
  audio.play('settle');
}
```

**Sound Design Tips:**
- Keep files small (<50KB each)
- Use MP3 for broad compatibility
- Subtle, non-intrusive sounds
- Spatial audio for bloom (optional)

---

## Device APIs

### DeviceMotion API

**Shake Detection Algorithm:**

```javascript
class ShakeDetector {
  constructor(threshold = 15, debounce = 500) {
    this.threshold = threshold;
    this.debounce = debounce;
    this.lastShake = 0;
    this.enabled = false;
  }

  async init() {
    // Request permission (iOS 13+)
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      this.enabled = permission === 'granted';
    } else {
      this.enabled = true;
    }

    if (this.enabled) {
      window.addEventListener('devicemotion', this._onMotion);
    }

    return this.enabled;
  }

  _onMotion = (event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    // Calculate magnitude
    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const magnitude = Math.sqrt(x*x + y*y + z*z);

    // Detect shake
    const now = Date.now();
    if (magnitude > this.threshold && now - this.lastShake > this.debounce) {
      this.lastShake = now;
      this.onShake?.(magnitude);
    }
  }

  destroy() {
    window.removeEventListener('devicemotion', this._onMotion);
  }
}
```

**Calibration:**
- iPhone: threshold ~15
- Android: threshold ~20-25 (varies by device)
- Consider adding user calibration UI

---

### Touch Events API

**Multi-touch Gesture Recognition:**

```javascript
class GestureHandler {
  constructor(element) {
    this.element = element;
    this.touches = new Map();
    
    this._bind();
  }

  _bind() {
    this.element.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.element.addEventListener('touchend', this._onTouchEnd);
    this.element.addEventListener('touchcancel', this._onTouchEnd);
  }

  _onTouchStart = (e) => {
    e.preventDefault(); // Prevent zoom

    Array.from(e.changedTouches).forEach(touch => {
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now()
      });
    });

    if (this.touches.size === 2) {
      this._initPinch();
    }
  }

  _onTouchMove = (e) => {
    e.preventDefault();

    Array.from(e.changedTouches).forEach(touch => {
      const data = this.touches.get(touch.identifier);
      if (data) {
        data.x = touch.clientX;
        data.y = touch.clientY;
      }
    });

    if (this.touches.size === 2) {
      this._updatePinch();
    }
  }

  _onTouchEnd = (e) => {
    Array.from(e.changedTouches).forEach(touch => {
      this.touches.delete(touch.identifier);
    });

    if (this.touches.size < 2) {
      this.onPinchEnd?.();
    }
  }

  _initPinch() {
    const [t1, t2] = Array.from(this.touches.values());
    this.initialDistance = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    this.initialCenter = {
      x: (t1.x + t2.x) / 2,
      y: (t1.y + t2.y) / 2
    };
    this.onPinchStart?.(this.initialDistance, this.initialCenter);
  }

  _updatePinch() {
    const [t1, t2] = Array.from(this.touches.values());
    const currentDistance = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    const currentCenter = {
      x: (t1.x + t2.x) / 2,
      y: (t1.y + t2.y) / 2
    };

    const scale = currentDistance / this.initialDistance;
    const deltaCenter = {
      x: currentCenter.x - this.initialCenter.x,
      y: currentCenter.y - this.initialCenter.y
    };

    this.onPinchMove?.(scale, deltaCenter, currentCenter);
  }

  destroy() {
    this.element.removeEventListener('touchstart', this._onTouchStart);
    this.element.removeEventListener('touchmove', this._onTouchMove);
    this.element.removeEventListener('touchend', this._onTouchEnd);
    this.element.removeEventListener('touchcancel', this._onTouchEnd);
  }
}
```

---

## Build Tools

### Vite Configuration

```javascript
// vite.config.js
export default {
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pixi': ['pixi.js'],
          'vendor-animation': ['gsap'],
          'vendor-font': ['opentype.js']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    https: true // Required for DeviceMotion testing
  }
};
```

---

## Bundle Analysis

### Production Bundle (Estimated)

```
dist/
├── index.html                    2 KB
├── assets/
│   ├── vendor-pixi.[hash].js   180 KB (gzipped: 60 KB)
│   ├── vendor-animation.[hash] 50 KB (gzipped: 18 KB)
│   ├── vendor-font.[hash].js   70 KB (gzipped: 25 KB)
│   └── main.[hash].js          40 KB (gzipped: 15 KB)
├── fonts/
│   └── display.woff2           50 KB
└── sounds/                     150 KB (optional)

Total: ~340 KB (gzipped: ~120 KB)
Load time on 4G: <2 seconds
```

---

*Technology choices optimized for performance, developer experience, and production quality.*
