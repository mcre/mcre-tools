import type { Simulation } from "./types";

// Read-only view. Rendering never consumes the model PRNG or mutates its arrays.
export const createAntRenderer = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  const ground = document.createElement("canvas"),
    groundContext = ground.getContext("2d")!;
  let pixels: ImageData | undefined;
  let previousTick = -1,
    previousVisibility: boolean | undefined;
  const resize = () => {
    const box = canvas.getBoundingClientRect(),
      ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
  };
  const draw = (s: Simulation, pheromones: boolean, force = false) => {
    const { columns, rows, nest } = s.layout;
    if (!pixels || ground.width !== columns || ground.height !== rows) {
      ground.width = columns;
      ground.height = rows;
      pixels = groundContext.createImageData(columns, rows);
      force = true;
    }
    if (
      force ||
      previousVisibility !== pheromones ||
      Math.abs(s.tick - previousTick) >= 3
    ) {
      const data = pixels.data;
      for (let i = 0; i < s.walls.length; i++) {
        const offset = i * 4;
        let r = 244,
          g = 238,
          b = 219;
        if (pheromones) {
          const home = s.homePheromone[i] / 18,
            food = s.foodPheromone[i] / 18,
            total = home + food;
          if (total > 0) {
            const strength = Math.min(0.8, total);
            r += ((home * 243 + food * 74) / total - r) * strength;
            g += ((home * 156 + food * 183) / total - g) * strength;
            b += ((home * 63 + food * 244) / total - b) * strength;
          }
        }
        if (s.walls[i]) {
          r = 79;
          g = 87;
          b = 82;
        } else if (s.food[i]) {
          r = 94;
          g = 158;
          b = 62;
        }
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
      groundContext.putImageData(pixels, 0, 0);
      previousTick = s.tick;
      previousVisibility = pheromones;
    }
    ctx.setTransform(canvas.width / columns, 0, 0, canvas.height / rows, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ground, 0, 0);
    ctx.fillStyle = "#b57842";
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, nest.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#62452e";
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, nest.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.45;
    ctx.strokeStyle = "#282d28";
    ctx.beginPath();
    for (const ant of s.ants) {
      const dx = Math.cos(ant.heading) * 0.9,
        dy = Math.sin(ant.heading) * 0.9;
      ctx.moveTo(ant.x - dx, ant.y - dy);
      ctx.lineTo(ant.x + dx, ant.y + dy);
    }
    ctx.stroke();
    for (const carrying of [0, 1]) {
      ctx.fillStyle = carrying ? "#3b382b" : "#252b24";
      ctx.beginPath();
      for (const ant of s.ants) {
        if (ant.carrying !== carrying) continue;
        ctx.moveTo(ant.x + 0.4, ant.y);
        ctx.arc(ant.x, ant.y, 0.4, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.fillStyle = "#77824e";
    ctx.beginPath();
    for (const ant of s.ants) {
      if (!ant.carrying) continue;
      const x = ant.x + Math.cos(ant.heading),
        y = ant.y + Math.sin(ant.heading);
      ctx.moveTo(x + 0.45, y);
      ctx.arc(x, y, 0.45, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  return { resize, draw };
};
