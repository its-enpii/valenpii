import opentype from "opentype.js";

export class ShapeGenerator {
  constructor() {
    this.font = null;
    this.fontUrl =
      "https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf";
  }

  async load() {
    return new Promise((resolve, reject) => {
      opentype.load(this.fontUrl, (err, font) => {
        if (err) reject(err);
        else {
          this.font = font;
          resolve(font);
        }
      });
    });
  }

  generateTextPoints(text, x, y, fontSize = 100, maxPoints = 5000) {
    if (!this.font) return [];
    const path = this.font.getPath(text, x, y, fontSize);
    const points = [];

    // Adaptive Step based on string length to avoid "eating" all particles
    // "Love" (4 chars) -> step 0.5
    // "Be Mine" (7 chars) -> step 0.8
    const step = text.length > 5 ? 1.0 : 0.6;

    let curX = 0,
      curY = 0;
    path.commands.forEach((cmd) => {
      if (cmd.type === "M") {
        curX = cmd.x;
        curY = cmd.y;
        points.push({ x: curX, y: curY });
      } else if (cmd.type === "L") {
        this.interpolateLine(curX, curY, cmd.x, cmd.y, step, points);
        curX = cmd.x;
        curY = cmd.y;
      } else if (cmd.type === "Q") {
        this.interpolateQuad(
          curX,
          curY,
          cmd.x1,
          cmd.y1,
          cmd.x,
          cmd.y,
          step,
          points,
        );
        curX = cmd.x;
        curY = cmd.y;
      } else if (cmd.type === "C") {
        this.interpolateBezier(
          curX,
          curY,
          cmd.x1,
          cmd.y1,
          cmd.x2,
          cmd.y2,
          cmd.x,
          cmd.y,
          step,
          points,
        );
        curX = cmd.x;
        curY = cmd.y;
      }
    });

    // Hard CAP points to ensure we never run out of background stars
    const result = points.slice(0, maxPoints);
    return this.centerPoints(result);
  }

  interpolateLine(x1, y1, x2, y2, step, points) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(dist / step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      points.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
    }
  }

  interpolateQuad(x1, y1, cx, cy, x2, y2, step, points) {
    const dist = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
    const steps = Math.max(5, Math.floor(dist / step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const invT = 1 - t;
      points.push({
        x: invT * invT * x1 + 2 * invT * t * cx + t * t * x2,
        y: invT * invT * y1 + 2 * invT * t * cy + t * t * y2,
      });
    }
  }

  interpolateBezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2, step, points) {
    const dist =
      Math.hypot(cx1 - x1, cy1 - y1) +
      Math.hypot(cx2 - cx1, cy2 - cy1) +
      Math.hypot(x2 - cx2, y2 - cy2);
    const steps = Math.max(10, Math.floor(dist / step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const invT = 1 - t;
      points.push({
        x:
          invT * invT * invT * x1 +
          3 * invT * invT * t * cx1 +
          3 * invT * t * t * cx2 +
          t * t * t * x2,
        y:
          invT * invT * invT * y1 +
          3 * invT * invT * t * cy1 +
          3 * invT * t * t * cy2 +
          t * t * t * y2,
      });
    }
  }

  generateHeartPoints(cx, cy, size = 100, numPoints = 1000) {
    const points = [];
    const thickness = 40; // Control the volume thickness

    for (let i = 0; i < numPoints; i++) {
      // Base Heart Shape
      const t = (i / numPoints) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      );

      // Scale to size
      const baseX = cx + hx * (size / 16);
      const baseY = cy + hy * (size / 16);

      // Add volumetric spread (Random point inside a sphere logic, or simple box)
      // Using simple box distribution for uniform thickness
      const dx = (Math.random() - 0.5) * thickness;
      const dy = (Math.random() - 0.5) * thickness;
      const dz = (Math.random() - 0.5) * thickness * 2; // Thicker in Z for 3D feel

      points.push({ x: baseX + dx, y: baseY + dy, z: dz });
    }
    return points;
  }

  centerPoints(points) {
    if (points.length === 0) return points;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const cx = minX + (maxX - minX) / 2;
    const cy = minY + (maxY - minY) / 2;
    return points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }
}
