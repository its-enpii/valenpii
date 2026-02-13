# Shake for Love Implementation

**Device motion detection and chaos-to-shape formation.**

---

## State Machine

```javascript
const States = {
  IDLE: 'idle',
  SHAKING: 'shaking',
  SETTLING: 'settling',
  FORMED: 'formed'
};
```

---

## Core Implementation

```javascript
class ShakeMode {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.state = States.IDLE;
    this.shakeIntensity = 0;
    this.shapeIndex = 0;
    this.shapes = ['LOVE', 'HEART', 'XOXO'];
    
    this._initMotion();
  }

  async _initMotion() {
    // iOS 13+ permission
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        this._showFallbackButton();
        return;
      }
    }

    window.addEventListener('devicemotion', this._onMotion);
  }

  _onMotion = (e) => {
    const acc = e.accelerationIncludingGravity;
    const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
    
    if (magnitude > 15 && this.state === States.IDLE) {
      this._transition(States.SHAKING);
      this.shakeIntensity = magnitude;
    }

    if (magnitude < 5 && this.state === States.SHAKING) {
      this._transition(States.SETTLING);
    }
  }

  _transition(newState) {
    this.state = newState;
    
    switch(newState) {
      case States.SHAKING:
        this._applyChaos();
        break;
      case States.SETTLING:
        this._formShape();
        break;
      case States.FORMED:
        setTimeout(() => this._transition(States.IDLE), 3000);
        break;
    }
  }

  _applyChaos() {
    this.particles.active.forEach(p => {
      p.vx += (Math.random() - 0.5) * 50;
      p.vy += (Math.random() - 0.5) * 50;
    });
  }

  _formShape() {
    const shape = this.shapes[this.shapeIndex];
    const targets = ShapeGenerator.generate(shape);
    
    this.particles.active.forEach((p, i) => {
      const target = targets[i % targets.length];
      gsap.to(p, {
        x: target.x,
        y: target.y,
        duration: 1.5,
        ease: 'expo.out'
      });
    });
    
    this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
    this._transition(States.FORMED);
  }
}
```

---

## Calibration

```javascript
// Detect device sensitivity
class ShakeCalibrator {
  constructor() {
    this.samples = [];
  }

  record(magnitude) {
    this.samples.push(magnitude);
    if (this.samples.length > 100) this.samples.shift();
  }

  getThreshold() {
    const avg = this.samples.reduce((a,b) => a+b) / this.samples.length;
    return avg * 1.5; // 50% above average
  }
}
```

---

## Testing

```javascript
// Simulate shake for testing
function simulateShake(mode) {
  const mockEvent = {
    accelerationIncludingGravity: { x: 20, y: 15, z: 10 }
  };
  mode._onMotion(mockEvent);
}
```

---

**Key Points:**
- Threshold tuning per device
- Debounce shake detection
- Smooth chaos-to-order transition
- GSAP for shape formation

---
