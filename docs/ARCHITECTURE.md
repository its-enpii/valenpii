# System Architecture

**High-level system design and architectural decisions for Valentine Particle Magic.**

---

## Architecture Pattern: Modular MVC + FSM

### Core Pattern
```
Model (Data)         Controller (Logic)      View (Rendering)
    ↓                       ↓                       ↓
ParticleData  →  ParticleSystem/Modes  →  PixiJS Renderer
    ↑                       ↑                       ↑
ShapeData     →  ShapeGenerator         →  GSAP Animations
```

### State Management: Finite State Machines (FSM)

Both main features use FSM for predictable state transitions:

```javascript
// Shake Mode FSM
const ShakeStates = {
  IDLE: 'idle',           // Waiting for shake
  SHAKING: 'shaking',     // Active shake detected
  SETTLING: 'settling',   // Particles transitioning
  FORMED: 'formed',       // Shape complete
  RESETTING: 'resetting'  // Returning to idle
};

// Pinch Mode FSM
const PinchStates = {
  CLUSTERED: 'clustered',   // Particles at center
  BLOOMING: 'blooming',     // Active pinch gesture
  BLOOMED: 'bloomed',       // Fully expanded
  COLLAPSING: 'collapsing'  // Pinch in reverse
};
```

**Why FSM?**
- Predictable behavior
- Easy to debug
- Clear state transitions
- No race conditions

---

## Module Structure

### 1. Application Core (`Application.js`)

**Responsibilities:**
- Lifecycle management (init, update, destroy)
- PixiJS app initialization
- Mode switching
- Global state coordination

```javascript
class Application {
  constructor(container) {
    this.app = new PIXI.Application({...});
    this.particleSystem = new ParticleSystem(this.app);
    this.currentMode = null;
  }

  switchMode(mode) {
    this.currentMode?.destroy();
    this.currentMode = mode === 'shake' 
      ? new ShakeMode(this.particleSystem)
      : new PinchMode(this.particleSystem);
  }

  update(deltaTime) {
    this.particleSystem.update(deltaTime);
    this.currentMode?.update(deltaTime);
  }
}
```

---

### 2. Particle System (`ParticleSystem.js`)

**Responsibilities:**
- Particle lifecycle (spawn, update, destroy)
- Object pooling
- Batch rendering
- Force application

**Architecture:**
```javascript
class ParticleSystem {
  constructor(pixiApp) {
    this.container = new PIXI.Container();
    this.pool = [];           // Recycled particles
    this.active = [];         // Currently visible
    this.graphics = new PIXI.Graphics(); // Batch draw
  }

  spawn(count, config) {
    // Get from pool or create new
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() || this._createParticle();
      this._initParticle(p, config);
      this.active.push(p);
    }
  }

  update(dt) {
    for (const p of this.active) {
      p.vx *= 0.98; // Damping
      p.vy *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this._batchDraw();
  }

  recycle(particle) {
    // Return to pool
    this.pool.push(particle);
  }
}
```

**Key Design Decisions:**

1. **Object Pooling**: Avoid GC pressure
   ```javascript
   // Bad: Creates garbage
   particles = particles.map(() => new Particle());
   
   // Good: Reuse objects
   particle = pool.pop() || new Particle();
   ```

2. **Batch Rendering**: Single draw call
   ```javascript
   // Bad: One draw per particle (1000 calls)
   particles.forEach(p => graphics.drawCircle(p.x, p.y, p.size));
   
   // Good: Batch (1 call)
   graphics.clear();
   particles.forEach(p => graphics.circle(p.x, p.y, p.size));
   graphics.fill(0xFFFFFF);
   ```

3. **Fixed Timestep**: Consistent physics
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

### 3. Shape Generator (`ShapeGenerator.js`)

**Responsibilities:**
- Text to coordinates conversion (opentype.js)
- Mathematical shape generation (heart, circle, etc.)
- Point sampling and distribution
- Coordinate scaling and centering

```javascript
class ShapeGenerator {
  static async textToPoints(text, font, options = {}) {
    const path = font.getPath(text, 0, 0, options.fontSize);
    const points = [];
    
    // Sample path at fixed intervals
    path.commands.forEach(cmd => {
      if (cmd.type === 'L' || cmd.type === 'Q' || cmd.type === 'C') {
        const samples = this._sampleCommand(cmd, options.density);
        points.push(...samples);
      }
    });
    
    return this._distributePoints(points, options.count);
  }

  static heartShape(count, size) {
    // Parametric heart equation
    const points = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const x = size * 16 * Math.pow(Math.sin(t), 3);
      const y = -size * (13 * Math.cos(t) - 5 * Math.cos(2*t) 
                 - 2 * Math.cos(3*t) - Math.cos(4*t));
      points.push({ x, y });
    }
    return points;
  }

  static _distributePoints(samples, targetCount) {
    // Evenly distribute points along sampled path
    if (samples.length === targetCount) return samples;
    
    const step = samples.length / targetCount;
    const distributed = [];
    for (let i = 0; i < targetCount; i++) {
      const index = Math.floor(i * step);
      distributed.push(samples[index]);
    }
    return distributed;
  }
}
```

**Mathematical Shapes:**

```javascript
// Circle
x = r * cos(θ)
y = r * sin(θ)

// Heart (parametric)
x = 16 * sin³(t)
y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)

// Flower petal
x = r * cos(t) * cos(n*t)
y = r * sin(t) * cos(n*t)
```

---

### 4. Feature Modes

#### ShakeMode (`ShakeMode.js`)

```javascript
class ShakeMode {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.state = ShakeStates.IDLE;
    this.shapeIndex = 0;
    this.shapes = ['LOVE', 'heart', 'XOXO'];
    
    this._initMotionListener();
  }

  _initMotionListener() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      DeviceMotionEvent.requestPermission()
        .then(state => {
          if (state === 'granted') {
            window.addEventListener('devicemotion', this._onMotion);
          }
        });
    } else {
      window.addEventListener('devicemotion', this._onMotion);
    }
  }

  _onMotion = (e) => {
    const acc = e.accelerationIncludingGravity;
    const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
    
    if (magnitude > SHAKE_THRESHOLD && this.state === ShakeStates.IDLE) {
      this._transitionTo(ShakeStates.SHAKING);
    }
  }

  _transitionTo(newState) {
    const prevState = this.state;
    this.state = newState;
    
    switch(newState) {
      case ShakeStates.SHAKING:
        this._applyChaos();
        break;
      case ShakeStates.SETTLING:
        this._formShape();
        break;
      case ShakeStates.FORMED:
        setTimeout(() => this._transitionTo(ShakeStates.IDLE), 3000);
        break;
    }
  }

  _applyChaos() {
    // Apply random forces to particles
    this.particles.active.forEach(p => {
      p.vx += (Math.random() - 0.5) * CHAOS_FORCE;
      p.vy += (Math.random() - 0.5) * CHAOS_FORCE;
    });
  }

  _formShape() {
    const shape = this.shapes[this.shapeIndex];
    const targetPoints = ShapeGenerator.generate(shape);
    
    // Animate particles to target positions
    this.particles.active.forEach((p, i) => {
      const target = targetPoints[i % targetPoints.length];
      gsap.to(p, {
        x: target.x,
        y: target.y,
        duration: 1.5,
        ease: 'expo.out',
        onComplete: () => {
          if (i === this.particles.active.length - 1) {
            this._transitionTo(ShakeStates.FORMED);
          }
        }
      });
    });
  }
}
```

#### PinchMode (`PinchMode.js`)

```javascript
class PinchMode {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.state = PinchStates.CLUSTERED;
    this.bloomFactor = 0; // 0-1
    
    this._initTouchListeners();
    this._initCluster();
  }

  _initTouchListeners() {
    let touch1 = null, touch2 = null, initialDistance = 0;
    
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touch1 = e.touches[0];
        touch2 = e.touches[1];
        initialDistance = this._getDistance(touch1, touch2);
        this._transitionTo(PinchStates.BLOOMING);
      }
    });
    
    window.addEventListener('touchmove', (e) => {
      if (this.state === PinchStates.BLOOMING && e.touches.length === 2) {
        const currentDistance = this._getDistance(e.touches[0], e.touches[1]);
        this.bloomFactor = Math.min(1, currentDistance / initialDistance);
        this._updateBloom();
      }
    });
    
    window.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this._transitionTo(PinchStates.CLUSTERED);
      }
    });
  }

  _getDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  _updateBloom() {
    // Interpolate between cluster and bloom positions
    this.particles.active.forEach((p, i) => {
      const cluster = this.clusterPositions[i];
      const bloom = this.bloomPositions[i];
      
      p.x = cluster.x + (bloom.x - cluster.x) * this.bloomFactor;
      p.y = cluster.y + (bloom.y - cluster.y) * this.bloomFactor;
      p.size = 2 + 2 * this.bloomFactor; // Grow slightly
      p.alpha = 0.6 + 0.4 * this.bloomFactor; // Brighten
    });
  }
}
```

---

## Data Flow

### Initialization Flow
```
User loads page
    ↓
Application.init()
    ↓
PixiJS setup → ParticleSystem.init() → ShapeGenerator load fonts
    ↓
Mode selection (Shake/Pinch)
    ↓
Mode.init() → Spawn particles → Start render loop
```

### Interaction Flow (Shake)
```
Device motion event
    ↓
Calculate magnitude
    ↓
Magnitude > threshold?
    ↓ Yes
FSM: IDLE → SHAKING
    ↓
Apply chaos forces
    ↓
Detect shake stop
    ↓
FSM: SHAKING → SETTLING
    ↓
Calculate target shape
    ↓
GSAP animate to targets
    ↓
FSM: SETTLING → FORMED
    ↓
Timeout 3s
    ↓
FSM: FORMED → IDLE
```

### Interaction Flow (Pinch)
```
Touch start (2 fingers)
    ↓
Record initial distance
    ↓
FSM: CLUSTERED → BLOOMING
    ↓
Touch move
    ↓
Calculate current distance
    ↓
bloomFactor = current / initial
    ↓
Interpolate positions
    ↓
Update particles (real-time)
    ↓
Touch end
    ↓
FSM: BLOOMING → CLUSTERED
    ↓
Animate back to cluster
```

---

## Performance Architecture

### Render Pipeline
```
RequestAnimationFrame
    ↓
Calculate deltaTime
    ↓
Update physics (fixed timestep)
    ↓
Update FSM state
    ↓
Cull off-screen particles
    ↓
Batch render visible particles
    ↓
Update UI elements
    ↓
Next frame
```

### Memory Management

**Object Lifecycle:**
```javascript
// Creation
const particle = {
  x: 0, y: 0, vx: 0, vy: 0,
  size: 2, alpha: 1, color: 0xFFFFFF
};

// Activation (from pool)
particle.active = true;
particle.x = spawnX;
particle.y = spawnY;

// Deactivation (return to pool)
particle.active = false;
particle.vx = 0;
particle.vy = 0;
// Keep object in memory

// Never: particle = null (causes GC)
```

**Event Listener Management:**
```javascript
class Feature {
  init() {
    this._boundHandler = this._handler.bind(this);
    window.addEventListener('event', this._boundHandler);
  }

  destroy() {
    window.removeEventListener('event', this._boundHandler);
    this._boundHandler = null;
  }
}
```

---

## Scalability Considerations

### Device Tier Detection
```javascript
class DeviceDetector {
  static getTier() {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 4;
    const gpu = this._detectGPU();
    
    if (cores >= 6 && memory >= 8 && gpu === 'high') return 'high';
    if (cores >= 4 && memory >= 4) return 'mid';
    return 'low';
  }

  static getConfig(tier) {
    return {
      high: { particles: 1000, quality: 'ultra' },
      mid: { particles: 600, quality: 'high' },
      low: { particles: 400, quality: 'medium' }
    }[tier];
  }
}
```

### Adaptive Quality
```javascript
class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.samples = [];
  }

  update(deltaTime) {
    this.fps = 1 / deltaTime;
    this.samples.push(this.fps);
    if (this.samples.length > 60) this.samples.shift();
    
    const avgFPS = this.samples.reduce((a,b) => a+b) / this.samples.length;
    
    if (avgFPS < 50) {
      // Reduce quality
      this._reduceParticleCount();
      this._disableEffects();
    }
  }
}
```

---

## Security Considerations

### Input Validation
```javascript
// Validate gesture input
function sanitizeTouch(touch) {
  return {
    x: Math.max(0, Math.min(window.innerWidth, touch.clientX)),
    y: Math.max(0, Math.min(window.innerHeight, touch.clientY))
  };
}
```

### Permission Handling
```javascript
// iOS 13+ motion permission
async function requestMotionPermission() {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Permission denied', error);
      return false;
    }
  }
  return true; // Android/Desktop - no permission needed
}
```

---

## Testing Architecture

### Unit Testing Strategy
```javascript
// ParticleSystem tests
describe('ParticleSystem', () => {
  it('should pool particles correctly', () => {
    const system = new ParticleSystem();
    system.spawn(100);
    expect(system.active.length).toBe(100);
    
    system.despawn(50);
    expect(system.pool.length).toBe(50);
  });
});
```

### Integration Testing
```javascript
// Mode transitions
describe('ShakeMode FSM', () => {
  it('should transition IDLE → SHAKING → SETTLING → FORMED', async () => {
    const mode = new ShakeMode(mockParticles);
    expect(mode.state).toBe('idle');
    
    mode._onMotion(mockShakeEvent);
    expect(mode.state).toBe('shaking');
    
    await wait(100);
    expect(mode.state).toBe('settling');
    
    await wait(1500);
    expect(mode.state).toBe('formed');
  });
});
```

---

## Deployment Architecture

### Build Pipeline
```
Source Code
    ↓
Vite bundler
    ↓
Tree-shaking + minification
    ↓
Code splitting (pixi, gsap, app)
    ↓
Asset optimization
    ↓
Generate source maps
    ↓
Production bundle
```

### CDN Strategy
```javascript
// Critical: inline
<script src="./main.js" defer></script>

// Heavy libs: CDN fallback
<script src="https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js"
        onerror="this.src='./vendor/pixi.min.js'"></script>
```

---

## Architectural Trade-offs

| Decision | Pro | Con | Rationale |
|----------|-----|-----|-----------|
| PixiJS over Canvas2D | 5x faster rendering | +180KB bundle | Performance critical |
| Object pooling | Zero GC pauses | More complex code | 60fps requirement |
| FSM for modes | Predictable states | Verbose | Easier debugging |
| GSAP for animation | Smoothest easing | +50KB | Professional polish |
| Batch rendering | 1 draw call | Less flexibility | Mobile performance |

---

*Architecture designed for 60fps, mobile-first, production-grade quality.*
