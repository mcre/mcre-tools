import { describe, expect, it } from "vitest";
import {
  circleAreaGeometry,
  circleAreaSectorPath,
  circleAreaSectors,
} from "@/utils/piArea";

describe("rearranging circular sectors", () => {
  it.each([4, 8, 32, 256])(
    "preserves the area and arc length of %s sectors",
    (count) => {
      for (const radius of [0.5, 1, 3]) {
        const geometry = circleAreaGeometry(count, radius);
        expect(geometry.sectorAngle * count).toBeCloseTo(2 * Math.PI, 12);
        expect(geometry.sectorArea * count).toBeCloseTo(
          Math.PI * radius ** 2,
          12,
        );
        expect(geometry.halfCircumference).toBeCloseTo(Math.PI * radius, 12);
        expect(Math.hypot(geometry.halfChord, geometry.rowHeight)).toBeCloseTo(
          radius,
          12,
        );
        const path = circleAreaSectorPath(count, radius);
        expect(path).toContain(`A${radius} ${radius} 0 0 0`);
        for (const progress of [0, 0.3, 1]) {
          const sectors = circleAreaSectors(count, radius, progress);
          expect(sectors).toHaveLength(count);
          for (const sector of sectors) {
            const rotation = (sector.rotation * Math.PI) / 180;
            expect(
              Math.cos(rotation) ** 2 + Math.sin(rotation) ** 2,
            ).toBeCloseTo(1, 12);
            expect(Number.isFinite(sector.x + sector.y + sector.rotation)).toBe(
              true,
            );
          }
        }
      }
    },
  );

  it("starts with one circle and packs sectors along shared radii without gaps", () => {
    for (const count of [4, 8, 32, 256]) {
      const geometry = circleAreaGeometry(count, 1);
      const circle = circleAreaSectors(count, 1, 0);
      for (let i = 0; i < count; i++) {
        expect(circle[i]!.x).toBe(0);
        expect(circle[i]!.y).toBe(0);
        expect(circle[i]!.rotation).toBeCloseTo((i * 360) / count, 12);
      }
      const packed = circleAreaSectors(count, 1, 1);
      const point = (index: number, x: number, y: number) => {
        const sector = packed[index]!;
        const angle = (sector.rotation * Math.PI) / 180;
        return {
          x: sector.x + x * Math.cos(angle) - y * Math.sin(angle),
          y: sector.y + x * Math.sin(angle) + y * Math.cos(angle),
        };
      };
      for (let i = 0; i < count - 1; i++) {
        const edge = (i % 2 === 0 ? 1 : -1) * geometry.halfChord;
        const a = point(i, edge, geometry.rowHeight);
        expect(a.x).toBeCloseTo(packed[i + 1]!.x, 12);
        expect(a.y).toBeCloseTo(packed[i + 1]!.y, 12);
        const b = point(i + 1, edge, geometry.rowHeight);
        expect(b.x).toBeCloseTo(packed[i]!.x, 12);
        expect(b.y).toBeCloseTo(packed[i]!.y, 12);
      }
    }
  });

  it("approaches a rectangle of width pi times the radius and height one radius", () => {
    let previous = circleAreaGeometry(4, 1);
    for (const count of [8, 16, 32, 64, 128, 256]) {
      const next = circleAreaGeometry(count, 1);
      expect(next.baseWidth).toBeGreaterThan(previous.baseWidth);
      expect(next.baseWidth).toBeLessThan(Math.PI);
      expect(next.rowHeight).toBeGreaterThan(previous.rowHeight);
      expect(next.rowHeight).toBeLessThan(1);
      expect(next.sagitta).toBeLessThan(previous.sagitta);
      expect(next.sagitta).toBeGreaterThan(0);
      previous = next;
    }
    expect(previous.baseWidth).toBeCloseTo(Math.PI, 3);
    expect(previous.rowHeight).toBeCloseTo(1, 3);
  });

  it("rejects invalid cuts, radii and transition positions", () => {
    for (const count of [2, 5, 8.5, 258, Number.NaN])
      expect(() => circleAreaGeometry(count, 1)).toThrow(RangeError);
    for (const radius of [0, -1, Infinity])
      expect(() => circleAreaGeometry(8, radius)).toThrow(RangeError);
    for (const progress of [-1, 1.1, Number.NaN])
      expect(() => circleAreaSectors(8, 1, progress)).toThrow(RangeError);
  });
});
