# Testing Strategy

**Comprehensive testing approach for production quality.**

---

## Testing Pyramid

```
        /\
       /E2E\          (10%) - Full flow tests
      /------\
     /Integration\    (30%) - Component interaction
    /------------\
   /  Unit Tests  \   (60%) - Individual functions
  /----------------\
```

---

## Unit Testing

### ParticleSystem Tests

```javascript
describe('ParticleSystem', () => {
  let system;

  beforeEach(() => {
    system = new ParticleSystem(mockApp);
  });

  test('should spawn from pool', () => {
    expect(system.pool.length).toBe(1000);
    system.spawn(100);
    expect(system.pool.length).toBe(900);
    expect(system.active.length).toBe(100);
  });

  test('should recycle particles', () => {
    system.spawn(50);
    system.active[0].life = 0;
    system.update(0.016);
    expect(system.pool.length).toBe(951);
  });

  test('should apply forces', () => {
    system.spawn(1, { x: 0, y: 0, velocity: 0 });
    system.applyForce(10, 0);
    system.update(0.016);
    expect(system.active[0].vx).toBeGreaterThan(0);
  });
});
```

### ShapeGenerator Tests

```javascript
describe('ShapeGenerator', () => {
  test('should generate heart shape', () => {
    const points = ShapeGenerator.heartShape(100, 50);
    expect(points).toHaveLength(100);
    points.forEach(p => {
      expect(p).toHaveProperty('x');
      expect(p).toHaveProperty('y');
    });
  });

  test('should center and scale points', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const scaled = ShapeGenerator._centerAndScale(points);
    // Check centered around screen
    const avgX = scaled.reduce((s,p) => s + p.x, 0) / scaled.length;
    expect(avgX).toBeCloseTo(window.innerWidth / 2, 1);
  });
});
```

---

## Integration Testing

### Mode Transitions

```javascript
describe('ShakeMode FSM', () => {
  test('should transition through states', async () => {
    const mode = new ShakeMode(mockParticles);
    expect(mode.state).toBe('idle');

    mode._onMotion({ accelerationIncludingGravity: { x: 20, y: 15, z: 10 } });
    expect(mode.state).toBe('shaking');

    await wait(100);
    mode._onMotion({ accelerationIncludingGravity: { x: 2, y: 1, z: 1 } });
    expect(mode.state).toBe('settling');

    await wait(1600);
    expect(mode.state).toBe('formed');
  });
});
```

---

## Performance Testing

### FPS Benchmarks

```javascript
describe('Performance', () => {
  test('should maintain 60fps with 1000 particles', async () => {
    const system = new ParticleSystem(app, { maxParticles: 1000 });
    system.spawn(1000);

    const fps = [];
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      system.update(0.016);
      const end = performance.now();
      fps.push(1000 / (end - start));
      await nextFrame();
    }

    const avgFPS = fps.reduce((a,b) => a+b) / fps.length;
    expect(avgFPS).toBeGreaterThan(55);
  });
});
```

### Memory Leak Detection

```javascript
describe('Memory', () => {
  test('should not leak on mode switch', () => {
    const initial = performance.memory.usedJSHeapSize;

    for (let i = 0; i < 100; i++) {
      const mode = new ShakeMode(particles);
      mode.destroy();
    }

    const final = performance.memory.usedJSHeapSize;
    const growth = (final - initial) / 1048576; // MB
    expect(growth).toBeLessThan(5);
  });
});
```

---

## Device Testing Matrix

| Device | Browser | Resolution | Test Cases |
|--------|---------|------------|-----------|
| iPhone 14 | Safari 17 | 1170×2532 | All |
| iPhone 11 | Safari 16 | 828×1792 | All |
| iPhone 8 | Safari 15 | 750×1334 | Performance critical |
| Pixel 7 | Chrome 120 | 1080×2400 | All |
| Galaxy S21 | Chrome 119 | 1080×2400 | All |
| OnePlus 9 | Chrome 118 | 1080×2400 | Gestures |

---

## E2E Testing (Manual)

### Shake Mode
- [ ] Shake detection triggers
- [ ] Chaos animation plays
- [ ] Shape formation completes
- [ ] Multiple shapes cycle
- [ ] Returns to idle

### Pinch Mode
- [ ] Two-finger pinch detected
- [ ] Bloom responds in real-time
- [ ] Full bloom shows message
- [ ] Collapse animation smooth
- [ ] Works in both orientations

### Cross-feature
- [ ] Mode switching works
- [ ] No memory leaks
- [ ] Performance stable
- [ ] No visual glitches

---

## Automated Testing Setup

```bash
# Install dependencies
npm install --save-dev jest @testing-library/jest-dom

# Run tests
npm test

# Coverage
npm test -- --coverage
```

---

**Target:** >80% code coverage, 100% critical path coverage.
