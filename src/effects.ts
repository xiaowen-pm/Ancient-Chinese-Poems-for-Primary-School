import type { EffectName } from "./types.ts";

type Particle = { x: number; y: number; s: number; v: number; r: number };

export function startEffects(canvas: HTMLCanvasElement, getEffect: () => EffectName): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const resize = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  const points: Particle[] = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    s: Math.random() * 0.6 + 0.4,
    v: Math.random() * 0.5 + 0.3,
    r: Math.random() * 6,
  }));

  const frame = (time: number) => {
    const width = canvas.width;
    const height = canvas.height;
    const effect = getEffect();
    const plain = canvas.dataset.plain === "1";
    context.clearRect(0, 0, width, height);
    for (const point of points) {
      if (effect === "glow") {
        point.y -= 0.0004 * point.v;
        if (point.y < 0) point.y = 1;
        const alpha = 0.5 + 0.5 * Math.sin(time / 600 + point.r);
        context.fillStyle = plain
          ? `rgba(168,122,42,${alpha * 0.55})`
          : `rgba(255,240,200,${alpha * 0.7})`;
        context.beginPath();
        context.arc(point.x * width, point.y * height, 2 * point.s, 0, Math.PI * 2);
        context.fill();
      } else if (effect === "petal" || effect === "leaf") {
        point.y += 0.0012 * point.v;
        point.x += 0.0006 * Math.sin(time / 900 + point.r);
        if (point.y > 1) {
          point.y = -0.05;
          point.x = Math.random();
        }
        context.save();
        context.translate(point.x * width, point.y * height);
        context.rotate((time / 1000) * point.v + point.r);
        context.fillStyle =
          effect === "petal"
            ? plain
              ? "rgba(196,92,112,.8)"
              : "rgba(255,215,225,.85)"
            : plain
              ? "rgba(150,62,36,.8)"
              : "rgba(200,50,30,.85)";
        context.beginPath();
        context.ellipse(0, 0, 7 * point.s, 3.5 * point.s, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      } else {
        const radius = ((time / 40 + point.r * 80) % 90) * point.s;
        const ink = plain ? "70,96,92" : "255,255,255";
        context.strokeStyle = `rgba(${ink},${0.45 * (1 - radius / (90 * point.s))})`;
        context.beginPath();
        context.ellipse(point.x * width, point.y * height, radius, radius * 0.35, 0, 0, Math.PI * 2);
        context.stroke();
      }
    }
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}
