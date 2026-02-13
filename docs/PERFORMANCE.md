# Performance Optimization Guide

**Achieving 60fps with 1000+ particles on mobile devices.**

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| FPS | 60 (16.67ms/frame) | Profiling, optimization |
| Memory | <150MB | Object pooling, cleanup |
| Load Time | <2s | Code splitting, lazy loading |
| First Paint | <1s | Critical CSS inline |

---

## Optimization Strategies

### 1. Object Pooling
**Impact:** Eliminates GC pauses

```javascript
class ParticlePool {
  constructor(size) {
    this.pool = Array(size).fill().map(() => createParticle());
    this.active = [];
  }

  acquire() {
    return this.pool.pop() || createParticle();
  }

  release(particle) {
    particle.active = false;
    this.pool.push(particle);
  }
}
```

### 2. Batch Rendering
**Impact:** 100x fewer draw calls

```javascript
graphics.clear();
graphics.beginFill(0xFFFFFF);
particles.forEach(p => graphics.drawCircle(p.x, p.y, p.size));
graphics.endFill();
```

### 3. Device-Tier Adaptive Quality

```javascript
const config = {
  high: { particles: 1000, effects: true },
  mid: { particles: 600, effects: false },
  low: { particles: 400, effects: false }
}[DeviceDetector.getTier()];
```

### 4. Fixed Timestep

```javascript
const FIXED_DT = 1/60;
let accumulator = 0;

function update(deltaTime) {
  accumulator += deltaTime;
  while (accumulator >= FIXED_DT) {
    physics.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }
}
```

---

## Profiling

### FPS Monitor

```javascript
class FPSMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
  }

  update() {
    const now = performance.now();
    const fps = 1000 / (now - this.lastTime);
    this.lastTime = now;
    
    this.frames.push(fps);
    if (this.frames.length > 60) this.frames.shift();
    
    return this.average();
  }

  average() {
    return this.frames.reduce((a,b) => a+b) / this.frames.length;
  }
}
```

---

## Memory Management

```javascript
class Feature {
  constructor() {
    this._handlers = new Map();
  }

  on(event, handler) {
    const bound = handler.bind(this);
    this._handlers.set(handler, bound);
    window.addEventListener(event, bound);
  }

  destroy() {
    this._handlers.forEach((bound, original) => {
      window.removeEventListener(event, bound);
    });
    this._handlers.clear();
  }
}
```

---

## Mobile Optimizations

1. **Passive touch listeners** for scroll performance
2. **Hardware acceleration** with `translateZ(0)`
3. **Batch DOM updates** in RAF
4. **Reduce particle count** on low-end devices

---

**Goal:** 60fps on iPhone 8+ and equivalent Android devices.
