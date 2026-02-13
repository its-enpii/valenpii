# Pinch to Bloom Implementation

**Multi-touch gesture recognition and real-time particle morphing.**

---

## State Machine

```javascript
const States = {
  CLUSTERED: 'clustered',
  BLOOMING: 'blooming', 
  BLOOMED: 'bloomed'
};
```

---

## Core Implementation

```javascript
class PinchMode {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.state = States.CLUSTERED;
    this.bloomFactor = 0; // 0-1
    
    this._initCluster();
    this._initTouch();
  }

  _initCluster() {
    const center = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };

    this.particles.spawn(500, {
      ...center,
      spread: 50,
      velocity: 0
    });

    // Store cluster positions
    this.clusterPositions = this.particles.active.map(p => ({
      x: p.x, y: p.y
    }));

    // Generate bloom positions (heart shape)
    this.bloomPositions = ShapeGenerator.heartShape(500, 200);
  }

  _initTouch() {
    let touch1, touch2, initialDistance;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touch1 = e.touches[0];
        touch2 = e.touches[1];
        initialDistance = this._distance(touch1, touch2);
        this.state = States.BLOOMING;
      }
    });

    window.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (this.state === States.BLOOMING && e.touches.length === 2) {
        const currentDistance = this._distance(e.touches[0], e.touches[1]);
        this.bloomFactor = Math.min(1, currentDistance / initialDistance);
        this._updateBloom();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (this.bloomFactor > 0.9) {
        this.state = States.BLOOMED;
        this._showMessage();
      } else {
        this._collapseToCluster();
      }
    });
  }

  _distance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  _updateBloom() {
    // Real-time interpolation
    this.particles.active.forEach((p, i) => {
      const cluster = this.clusterPositions[i];
      const bloom = this.bloomPositions[i];
      
      p.x = cluster.x + (bloom.x - cluster.x) * this.bloomFactor;
      p.y = cluster.y + (bloom.y - cluster.y) * this.bloomFactor;
      p.size = 2 + 2 * this.bloomFactor;
      p.alpha = 0.6 + 0.4 * this.bloomFactor;
    });
  }

  _collapseToCluster() {
    this.particles.active.forEach((p, i) => {
      gsap.to(p, {
        x: this.clusterPositions[i].x,
        y: this.clusterPositions[i].y,
        size: 2,
        alpha: 0.6,
        duration: 0.8,
        ease: 'back.out(1.7)'
      });
    });
    
    this.bloomFactor = 0;
    this.state = States.CLUSTERED;
  }
}
```

---

## Gesture Handler

```javascript
class PinchGestureHandler {
  constructor(element) {
    this.element = element;
    this.touches = new Map();
    this._bind();
  }

  _bind() {
    this.element.addEventListener('touchstart', this._onStart, { passive: false });
    this.element.addEventListener('touchmove', this._onMove, { passive: false });
    this.element.addEventListener('touchend', this._onEnd);
  }

  _onStart = (e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(t => {
      this.touches.set(t.identifier, {
        x: t.clientX,
        y: t.clientY,
        startTime: Date.now()
      });
    });

    if (this.touches.size === 2) {
      this.onPinchStart?.(this._getPinchData());
    }
  }

  _onMove = (e) => {
    e.preventDefault();

    Array.from(e.changedTouches).forEach(t => {
      const data = this.touches.get(t.identifier);
      if (data) {
        data.x = t.clientX;
        data.y = t.clientY;
      }
    });

    if (this.touches.size === 2) {
      this.onPinchMove?.(this._getPinchData());
    }
  }

  _onEnd = (e) => {
    Array.from(e.changedTouches).forEach(t => {
      this.touches.delete(t.identifier);
    });

    if (this.touches.size < 2) {
      this.onPinchEnd?.();
    }
  }

  _getPinchData() {
    const [t1, t2] = Array.from(this.touches.values());
    const distance = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    const center = {
      x: (t1.x + t2.x) / 2,
      y: (t1.y + t2.y) / 2
    };
    return { distance, center };
  }

  destroy() {
    this.element.removeEventListener('touchstart', this._onStart);
    this.element.removeEventListener('touchmove', this._onMove);
    this.element.removeEventListener('touchend', this._onEnd);
  }
}
```

---

## Performance Optimization

```javascript
// Throttle updates for smoothness
class ThrottledPinch extends PinchMode {
  _updateBloom() {
    if (!this._updateScheduled) {
      this._updateScheduled = true;
      requestAnimationFrame(() => {
        super._updateBloom();
        this._updateScheduled = false;
      });
    }
  }
}
```

---

## Testing

```javascript
// Simulate pinch gesture
function simulatePinch(mode) {
  // Start
  mode._initTouch();
  const startEvent = {
    touches: [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 200 }
    ]
  };
  window.dispatchEvent(new TouchEvent('touchstart', startEvent));

  // Move
  setTimeout(() => {
    const moveEvent = {
      touches: [
        { clientX: 50, clientY: 50 },
        { clientX: 350, clientY: 350 }
      ]
    };
    window.dispatchEvent(new TouchEvent('touchmove', moveEvent));
  }, 100);

  // End
  setTimeout(() => {
    window.dispatchEvent(new TouchEvent('touchend'));
  }, 500);
}
```

---

**Key Points:**
- Prevent default zoom behavior
- Real-time interpolation (<16ms)
- Smooth collapse animation
- Touch identifier tracking

---
