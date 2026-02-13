# Shape Generation Implementation

**Converting text and mathematical shapes to particle coordinates.**

---

## Text to Particles (opentype.js)

### Font Loading

```javascript
import opentype from 'opentype.js';

class FontManager {
  constructor() {
    this.fonts = new Map();
  }

  async load(name, url) {
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
}
```

### Path Sampling

```javascript
class ShapeGenerator {
  static textToPoints(text, font, options = {}) {
    const { fontSize = 200, density = 2 } = options;
    const path = font.getPath(text, 0, 0, fontSize);
    
    const points = [];
    let currentX = 0, currentY = 0;

    path.commands.forEach(cmd => {
      switch(cmd.type) {
        case 'M': // MoveTo
          currentX = cmd.x;
          currentY = cmd.y;
          points.push({ x: currentX, y: currentY });
          break;

        case 'L': // LineTo
          points.push(...this._sampleLine(
            currentX, currentY, cmd.x, cmd.y, density
          ));
          currentX = cmd.x;
          currentY = cmd.y;
          break;

        case 'C': // Cubic Bezier
          points.push(...this._sampleCubicBezier(
            currentX, currentY,
            cmd.x1, cmd.y1, cmd.x2, cmd.y2,
            cmd.x, cmd.y, density
          ));
          currentX = cmd.x;
          currentY = cmd.y;
          break;
      }
    });

    return this._centerAndScale(points);
  }

  static _sampleLine(x1, y1, x2, y2, density) {
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

  static _sampleCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, density) {
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
}
```

---

## Mathematical Shapes

### Heart Shape

```javascript
static heartShape(count, size) {
  const points = [];
  
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    
    // Parametric heart equation
    const x = size * 16 * Math.pow(Math.sin(t), 3);
    const y = -size * (
      13 * Math.cos(t) - 
      5 * Math.cos(2*t) - 
      2 * Math.cos(3*t) - 
      Math.cos(4*t)
    );
    
    points.push({ x, y });
  }
  
  return this._centerAndScale(points);
}
```

### Circle

```javascript
static circle(count, radius) {
  const points = [];
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  
  return this._centerAndScale(points);
}
```

### Flower

```javascript
static flower(count, radius, petals = 5) {
  const points = [];
  
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const r = radius * (1 + 0.5 * Math.cos(petals * t));
    
    points.push({
      x: r * Math.cos(t),
      y: r * Math.sin(t)
    });
  }
  
  return this._centerAndScale(points);
}
```

---

## Coordinate Transformation

### Center and Scale

```javascript
static _centerAndScale(points) {
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

  // Scale to fit 80% of screen
  const scale = Math.min(
    window.innerWidth * 0.8 / width,
    window.innerHeight * 0.8 / height
  );

  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;

  return points.map(p => ({
    x: (p.x - centerX) * scale + screenCenterX,
    y: (p.y - centerY) * scale + screenCenterY
  }));
}
```

---

## Usage Examples

```javascript
// Load font
await fontManager.load('display', '/fonts/display.ttf');

// Generate text shape
const lovePoints = ShapeGenerator.textToPoints(
  'LOVE',
  fontManager.get('display'),
  { fontSize: 200, density: 2 }
);

// Generate mathematical shape
const heartPoints = ShapeGenerator.heartShape(500, 100);

// Use with particle system
particleSystem.setTargets(lovePoints);
```

---

**Key Points:**
- Sample curves at consistent density
- Center shapes on screen
- Scale proportionally
- Cache generated shapes

---
