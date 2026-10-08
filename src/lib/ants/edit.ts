import type { EditTool, Point, Simulation } from "./types";
import { applyEdit, cellIndex } from "./model";
export interface Stroke {
  tool: EditTool;
  amount: number;
  radius: number;
  visited: Set<number>;
  previous?: Point;
}
export const createStroke = (
  tool: EditTool,
  amount = 100,
  diameter = 1,
): Stroke => ({
  tool,
  amount,
  radius: Math.floor(Math.max(1, diameter) / 2),
  visited: new Set(),
});
export const extendStroke = (s: Simulation, stroke: Stroke, point: Point) => {
  const start = stroke.previous ?? point;
  const steps = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(point.x - start.x), Math.abs(point.y - start.y)) * 2,
    ),
  );
  const cells = new Set<number>();
  for (let k = 0; k <= steps; k++) {
    const x = start.x + ((point.x - start.x) * k) / steps,
      y = start.y + ((point.y - start.y) * k) / steps;
    const cx = Math.floor(x),
      cy = Math.floor(y);
    for (let dy = -stroke.radius; dy <= stroke.radius; dy++) {
      for (let dx = -stroke.radius; dx <= stroke.radius; dx++) {
        if (dx * dx + dy * dy > stroke.radius * stroke.radius) continue;
        const i = cellIndex(s.layout, cx + dx, cy + dy);
        if (i >= 0 && !stroke.visited.has(i)) {
          cells.add(i);
          stroke.visited.add(i);
        }
      }
    }
  }
  applyEdit(s, stroke.tool, cells, stroke.amount);
  stroke.previous = point;
};
