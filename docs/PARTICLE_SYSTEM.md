# Particle System Implementation

**Core particle engine with object pooling and batch rendering.**

---

## Architecture Overview

```
ParticleSystem
├── Pool (inactive particles)
├── Active (visible particles)
├── Graphics (PixiJS batch renderer)
└── Config (performance settings)
```

---

## Core Implementation

### Particle Data Structure

```javascript
/**
 * @typedef {Object} Particle
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} vx - X velocity
 * @property {number} vy - Y velocity
 * @property {number} ax - X acceleration
 * @property {number} ay - Y acceleration
 * @property {number} size - Radius in pixels
 * @property {number} alpha - Opacity (0-1)
 * @property {number} color - Hex color (0xRRGGBB)
 * @property {number} life - Remaining lifetime
 * @property {number} maxLife - Initial lifetime
 * @property {boolean} active - Is particle visible
 * @property {Object} target - Target position for morphing
 */

function createParticle() {
  return {
    x: 0, y: 0,
    vx: 0, vy: 0,
    ax: 0, ay: 0,
    size: 2,
    alpha: 1,
    color: 0xFFFFFF,
    life: 1,
    maxLife: 1,
    active: false,
    target: null
  };
}
```

### ParticleSystem Class

```javascript
import * as PIXI from 'pixi.js';

class ParticleSystem {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      maxParticles: config.maxParticles || 1000,
      damping: config.damping || 0.98,
      gravity: config.gravity || 0,
      ...config
    };

    // Object pool
    this.pool = [];
    this.active = [];

    // Rendering
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
    this.app.stage.addChild(this.container);

    // Pre-allocate pool
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.pool.push(createParticle());
    }
  }

  /**
   * Spawn particles
   * @param {number} count - Number of particles
   * @param {Object} config - Spawn configuration
   */
  spawn(count, config = {}) {
    const {
      x = this.app.screen.width / 2,
      y = this.app.screen.height / 2,
      spread = 100,
      velocity = 5,
      size = 2,
      color = 0xFFFFFF,
      life = Infinity
    } = config;

    for (let i = 0; i < count && this.pool.length > 0; i++) {
      const p = this.pool.pop();
      
      // Initialize
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * velocity;
      const offset = Math.random() * spread;
      
      p.x = x + Math.cos(angle) * offset;
      p.y = y + Math.sin(angle) * offset;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.ax = 0;
      p.ay = 0;
      p.size = size * (0.8 + Math.random() * 0.4);
      p.alpha = 1;
      p.color = color;
      p.life = life;
      p.maxLife = life;
      p.active = true;
      p.target = null;

      this.active.push(p);
    }

    return this.active.length;
  }

  /**
   * Update all particles
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const { damping, gravity } = this.config;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];

      // Physics
      p.vy += gravity * dt;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Lifetime
      if (p.life !== Infinity) {
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
      }

      // Target morphing
      if (p.target) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        p.x += dx * 0.1; // Smooth lerp
        p.y += dy * 0.1;
      }

      // Deactivate dead particles
      if (p.life <= 0 || p.alpha <= 0) {
        this.recycle(i);
      }
    }

    this._render();
  }

  /**
   * Batch render all active particles
   */
  _render() {
    const g = this.graphics;
    g.clear();

    // Group by color for efficiency
    const byColor = new Map();
    this.active.forEach(p => {
      if (!byColor.has(p.color)) byColor.set(p.color, []);
      byColor.get(p.color).push(p);
    });

    // Render each color group
    byColor.forEach((particles, color) => {
      g.beginFill(color);
      particles.forEach(p => {
        if (p.alpha > 0) {
          g.drawCircle(p.x, p.y, p.size);
        }
      });
      g.endFill();
    });
  }

  /**
   * Apply force to all particles
   * @param {number} fx - Force X
   * @param {number} fy - Force Y
   */
  applyForce(fx, fy) {
    this.active.forEach(p => {
      p.ax += fx;
      p.ay += fy;
    });
  }

  /**
   * Apply explosion force from point
   * @param {number} x - Explosion X
   * @param {number} y - Explosion Y
   * @param {number} force - Force magnitude
   */
  explode(x, y, force) {
    this.active.forEach(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.hypot(dx, dy) + 0.1;
      const strength = force / (dist * dist);
      p.vx += (dx / dist) * strength;
      p.vy += (dy / dist) * strength;
    });
  }

  /**
   * Set target positions for morphing
   * @param {Array<{x,y}>} targets - Target positions
   */
  setTargets(targets) {
    this.active.forEach((p, i) => {
      p.target = targets[i % targets.length];
    });
  }

  /**
   * Clear all targets
   */
  clearTargets() {
    this.active.forEach(p => p.target = null);
  }

  /**
   * Recycle particle back to pool
   * @param {number} index - Index in active array
   */
  recycle(index) {
    const p = this.active.splice(index, 1)[0];
    p.active = false;
    p.target = null;
    this.pool.push(p);
  }

  /**
   * Clear all particles
   */
  clear() {
    while (this.active.length > 0) {
      this.recycle(0);
    }
    this.graphics.clear();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clear();
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
```

---

## Advanced Features

### Particle Emitter

```javascript
class ParticleEmitter {
  constructor(particleSystem, config = {}) {
    this.system = particleSystem;
    this.config = {
      rate: config.rate || 10, // Particles per second
      ...config
    };
    this.accumulator = 0;
  }

  update(dt) {
    this.accumulator += dt * this.config.rate;
    const toSpawn = Math.floor(this.accumulator);
    
    if (toSpawn > 0) {
      this.system.spawn(toSpawn, this.config);
      this.accumulator -= toSpawn;
    }
  }
}
```

### Particle Attractors

```javascript
class Attractor {
  constructor(x, y, strength) {
    this.x = x;
    this.y = y;
    this.strength = strength;
  }

  apply(particles) {
    particles.forEach(p => {
      const dx = this.x - p.x;
      const dy = this.y - p.y;
      const distSq = dx*dx + dy*dy + 1;
      const force = this.strength / distSq;
      
      p.ax += (dx / Math.sqrt(distSq)) * force;
      p.ay += (dy / Math.sqrt(distSq)) * force;
    });
  }
}
```

### Spatial Partitioning (Optimization)

```javascript
class SpatialGrid {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.grid = [];
  }

  clear() {
    this.grid = Array(this.cols * this.rows).fill().map(() => []);
  }

  insert(particle) {
    const col = Math.floor(particle.x / this.cellSize);
    const row = Math.floor(particle.y / this.cellSize);
    const index = row * this.cols + col;
    
    if (index >= 0 && index < this.grid.length) {
      this.grid[index].push(particle);
    }
  }

  getNearby(x, y, radius) {
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
    
    const nearby = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        nearby.push(...this.grid[row * this.cols + col]);
      }
    }
    return nearby;
  }
}
```

---

## Performance Optimizations

### 1. Object Pooling (Implemented Above)

**Impact:** Zero GC pauses, 2-3x performance improvement

```javascript
// Bad: Creates garbage
function spawn() {
  return particles.map(() => ({ x: 0, y: 0, ... }));
}

// Good: Reuse objects
function spawn() {
  const p = pool.pop() || createParticle();
  p.x = 0; p.y = 0;
  return p;
}
```

### 2. Batch Rendering

**Impact:** 10-100x fewer draw calls

```javascript
// Bad: N draw calls
particles.forEach(p => {
  graphics.clear();
  graphics.beginFill(p.color);
  graphics.drawCircle(p.x, p.y, p.size);
  graphics.endFill();
});

// Good: 1 draw call
graphics.clear();
graphics.beginFill(0xFFFFFF);
particles.forEach(p => graphics.drawCircle(p.x, p.y, p.size));
graphics.endFill();
```

### 3. Culling Off-screen Particles

```javascript
_render() {
  const { width, height } = this.app.screen;
  const margin = 50; // Render slightly off-screen

  this.graphics.clear();
  this.graphics.beginFill(0xFFFFFF);
  
  this.active.forEach(p => {
    if (p.x > -margin && p.x < width + margin &&
        p.y > -margin && p.y < height + margin) {
      this.graphics.drawCircle(p.x, p.y, p.size);
    }
  });
  
  this.graphics.endFill();
}
```

### 4. Fixed Timestep

```javascript
const FIXED_DT = 1/60;
let accumulator = 0;

function update(deltaTime) {
  accumulator += deltaTime;
  
  while (accumulator >= FIXED_DT) {
    particleSystem.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }
}
```

### 5. SIMD-friendly Math

```javascript
// Group operations for better CPU cache usage
// Update all X positions, then Y positions
for (let i = 0; i < particles.length; i++) {
  particles[i].vx *= damping;
}
for (let i = 0; i < particles.length; i++) {
  particles[i].x += particles[i].vx * dt;
}
```

---

## Testing

### Unit Tests

```javascript
describe('ParticleSystem', () => {
  let system;

  beforeEach(() => {
    system = new ParticleSystem(mockApp, { maxParticles: 100 });
  });

  it('should spawn particles from pool', () => {
    expect(system.pool.length).toBe(100);
    expect(system.active.length).toBe(0);

    system.spawn(50);
    
    expect(system.pool.length).toBe(50);
    expect(system.active.length).toBe(50);
  });

  it('should recycle particles', () => {
    system.spawn(50);
    system.active[0].life = 0;
    system.update(0.016);

    expect(system.active.length).toBe(49);
    expect(system.pool.length).toBe(51);
  });

  it('should apply forces correctly', () => {
    system.spawn(1, { x: 0, y: 0, velocity: 0 });
    const p = system.active[0];
    
    system.applyForce(10, 0);
    system.update(0.016);

    expect(p.vx).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThan(0);
  });
});
```

### Performance Benchmarks

```javascript
function benchmarkParticles(count) {
  const system = new ParticleSystem(app, { maxParticles: count });
  system.spawn(count);

  const samples = [];
  let frames = 0;

  function measure() {
    const start = performance.now();
    system.update(0.016);
    const end = performance.now();
    
    samples.push(end - start);
    frames++;

    if (frames < 300) {
      requestAnimationFrame(measure);
    } else {
      const avg = samples.reduce((a,b) => a+b) / samples.length;
      console.log(`${count} particles: ${avg.toFixed(2)}ms avg`);
    }
  }

  requestAnimationFrame(measure);
}

// Test different counts
[100, 500, 1000, 2000].forEach(benchmarkParticles);
```

---

## Usage Examples

### Basic Explosion Effect

```javascript
const system = new ParticleSystem(app);
system.spawn(200, {
  x: centerX,
  y: centerY,
  velocity: 100,
  spread: 10,
  life: 2
});
```

### Continuous Stream

```javascript
const emitter = new ParticleEmitter(system, {
  x: sourceX,
  y: sourceY,
  rate: 30,
  velocity: 50
});

app.ticker.add((delta) => {
  emitter.update(delta / 60);
});
```

### Morphing to Shape

```javascript
const heartPoints = ShapeGenerator.heartShape(500, 100);
system.spawn(500);
system.setTargets(heartPoints);

// Particles will smoothly interpolate to heart shape
```

---

## Common Issues

### Issue: Particles lag on mobile
**Solution:** Reduce particle count based on device tier

```javascript
const tier = DeviceDetector.getTier();
const count = { high: 1000, mid: 600, low: 400 }[tier];
```

### Issue: Memory leak
**Solution:** Always recycle particles, remove event listeners

```javascript
destroy() {
  this.clear(); // Recycle all particles
  window.removeEventListener('resize', this._onResize);
}
```

### Issue: Jittery movement
**Solution:** Use fixed timestep

```javascript
const FIXED_DT = 1/60;
// ... (see Fixed Timestep section above)
```

---

*Particle system designed for 60fps with 1000+ particles on mobile devices.*
