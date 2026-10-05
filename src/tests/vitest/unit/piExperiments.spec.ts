import { describe, expect, it } from "vitest";
import {
  estimatePi,
  isInsideUnitCircle,
  monteCarloBatchSize,
  monteCarloGraphRange,
  monteCarloGraphY,
  polygonBounds,
  polygonDisplayValues,
  polygonSidesForPosition,
  polygonSliderPosition,
  polygonVertices,
  polygonVerticesForDisplay,
  rollingCircle,
  sampleSquarePoint,
} from "@/utils/piExperiments";

describe("Monte Carlo geometry", () => {
  it.each([
    [0, 0, true],
    [1, 0, true],
    [-1, 0, true],
    [0.6, 0.8, true],
    [1, 1, false],
    [0.8, 0.8, false],
  ])("classifies (%s, %s), including the boundary", (x, y, inside) => {
    expect(isInsideUnitCircle(x, y)).toBe(inside);
  });

  it("maps two independent uniform draws to the whole square", () => {
    const values = [0, 0.75, 0.5, 0.25];
    const random = () => values.shift()!;
    expect(sampleSquarePoint(random)).toEqual({ x: -1, y: 0.5, inside: false });
    expect(sampleSquarePoint(random)).toEqual({ x: 0, y: -0.5, inside: true });
    expect(values).toEqual([]);
  });

  it("has no estimate before sampling and uses 4M / N afterward", () => {
    expect(estimatePi(0, 0)).toBeNull();
    expect(estimatePi(0, 1)).toBe(0);
    expect(estimatePi(1, 1)).toBe(4);
    expect(estimatePi(785, 1000)).toBe(3.14);
    expect(() => estimatePi(2, 1)).toThrow(RangeError);
  });
});

describe("Monte Carlo controls and graph", () => {
  it.each([
    [0, 100],
    [1, 1000],
    [1.5, 3162],
    [2, 10_000],
    [3, 100_000],
    [-1, 100],
    [4, 1_000_000],
    [5, 1_000_000],
  ])(
    "maps slider position %s to a bounded logarithmic batch of %s",
    (position, expected) => {
      expect(monteCarloBatchSize(position)).toBe(expected);
    },
  );

  it("starts with a narrow range around pi", () => {
    const range = monteCarloGraphRange([]);
    expect(range.min).toBe(3);
    expect(range.max).toBe(3.3);
    expect(range.decimals).toBe(1);
  });

  it("keeps pi and the latest estimate visible, including early outliers", () => {
    const range = monteCarloGraphRange([{ total: 1, estimate: 4 }]);
    expect(range.min).toBeLessThan(Math.PI);
    expect(range.max).toBeGreaterThanOrEqual(4);
  });

  it("zooms around recent estimates without retaining the range of early outliers", () => {
    const range = monteCarloGraphRange([
      { total: 1, estimate: 0 },
      { total: 100, estimate: 4 },
      { total: 100_000, estimate: 3.14 },
      { total: 1_000_000, estimate: 3.142 },
    ]);
    expect(range.min).toBeLessThan(3.14);
    expect(range.max).toBeGreaterThan(3.142);
    expect(range).toEqual({ min: 3.13, max: 3.15, decimals: 2 });
    expect(range.min).toBeLessThan(Math.PI);
    expect(range.max).toBeGreaterThan(Math.PI);
  });

  it("narrows the range as estimates get closer, with readable distinct bounds", () => {
    const wide = monteCarloGraphRange([{ total: 10_000, estimate: 3.1 }]);
    const narrow = monteCarloGraphRange([
      { total: 1_000_000, estimate: Math.PI },
    ]);
    expect(narrow.max - narrow.min).toBeLessThan(wide.max - wide.min);
    expect(narrow.max).toBeGreaterThan(narrow.min);
    expect(narrow.min.toFixed(narrow.decimals)).not.toBe(
      narrow.max.toFixed(narrow.decimals),
    );
    expect(monteCarloGraphY(Math.PI, narrow)).toBeGreaterThan(10);
    expect(monteCarloGraphY(Math.PI, narrow)).toBeLessThan(102);
  });

  it("projects actual values onto the axis without clamping old outliers", () => {
    const range = { min: 3.1, max: 3.2, decimals: 1 };
    expect(monteCarloGraphY(range.min, range)).toBe(102);
    expect(monteCarloGraphY(range.max, range)).toBe(10);
    expect(monteCarloGraphY(4, range)).toBeLessThan(10);
    expect(monteCarloGraphY(0, range)).toBeGreaterThan(102);
  });

  it("does not exaggerate the tiny error in the reported 294-million-trial case", () => {
    const range = monteCarloGraphRange([
      { total: 290_000_000, estimate: 3.1415 },
      { total: 294_000_000, estimate: 3.14151 },
    ]);
    expect(range).toEqual({ min: 3.14, max: 3.143, decimals: 3 });
    expect(
      Math.abs(
        monteCarloGraphY(3.14151, range) - monteCarloGraphY(Math.PI, range),
      ),
    ).toBeLessThan(3);
    expect(monteCarloGraphY(Math.PI, range)).toBeGreaterThan(30);
    expect(monteCarloGraphY(Math.PI, range)).toBeLessThan(80);
  });

  it("keeps the same scale for small fluctuations on either side of pi", () => {
    const baseline = monteCarloGraphRange([
      { total: 1_000_000, estimate: Math.PI },
    ]);
    expect(baseline).toEqual({ min: 3.14, max: 3.143, decimals: 3 });
    for (const offset of [-0.0001, 0.0001, -0.00001, 0.00001]) {
      expect(
        monteCarloGraphRange([
          { total: 1_000_000, estimate: Math.PI + offset },
        ]),
      ).toEqual(baseline);
    }
  });
});

describe("regular polygon bounds", () => {
  it("allows every integer polygon, including triangles, squares and pentagons, on the slider", () => {
    for (let sides = 3; sides <= 1536; sides++) {
      expect(polygonSidesForPosition(polygonSliderPosition(sides))).toBe(sides);
    }
    for (const sides of [10_000, 100_000, 999_999, 1_000_000])
      expect(polygonSidesForPosition(polygonSliderPosition(sides))).toBe(sides);
    expect(polygonSidesForPosition(0)).toBe(3);
    expect(polygonSidesForPosition(6.7)).toBe(5);
    expect(polygonSidesForPosition(10)).toBe(6);
    expect(polygonSidesForPosition(30)).toBe(12);
    expect(polygonSidesForPosition(100)).toBe(1_000_000);
    expect(polygonSidesForPosition(-1)).toBe(3);
    expect(polygonSidesForPosition(101)).toBe(1_000_000);
    expect(() => polygonSidesForPosition(Number.NaN)).toThrow(RangeError);
  });

  it("retains accurate distinct bounds up to a million sides", () => {
    let previous = polygonBounds(1536);
    for (const sides of [10_000, 100_000, 1_000_000]) {
      const next = polygonBounds(sides);
      expect(next.lower).toBeGreaterThan(previous.lower);
      expect(next.lower).toBeLessThan(Math.PI);
      expect(next.upper).toBeLessThan(previous.upper);
      expect(next.upper).toBeGreaterThan(Math.PI);
      previous = next;
    }
    expect(previous.upper - previous.lower).toBeLessThan(2e-11);
    expect(previous.upper - previous.lower).toBeGreaterThan(1e-11);
  });

  it("adds decimal places without rounding pi outside the displayed interval", () => {
    expect(polygonDisplayValues(6)).toEqual({
      decimals: 6,
      lower: "3.000000",
      upper: "3.464102",
      innerPerimeter: "6.000000",
      outerPerimeter: "6.928203",
    });
    expect(polygonDisplayValues(1_000_000)).toEqual({
      decimals: 12,
      lower: "3.141592653584",
      upper: "3.141592653601",
      innerPerimeter: "6.283185307169",
      outerPerimeter: "6.283185307200",
    });
    for (const sides of [3, 5, 96, 1536, 10_000, 100_000, 1_000_000]) {
      const bounds = polygonBounds(sides);
      const display = polygonDisplayValues(sides);
      expect(Number(display.lower)).toBeLessThanOrEqual(bounds.lower);
      expect(Number(display.upper)).toBeGreaterThanOrEqual(bounds.upper);
      expect(Number(display.lower)).toBeLessThan(Math.PI);
      expect(Number(display.upper)).toBeGreaterThan(Math.PI);
    }
  });

  it("limits vertex allocation and uses circles from 256 sides onward", () => {
    for (const sides of [3, 5, 96, 255])
      expect(polygonVerticesForDisplay(sides, 112, false)).toHaveLength(sides);
    for (const sides of [256, 1536, 1_000_000]) {
      expect(polygonVerticesForDisplay(sides, 112, false)).toEqual([]);
      expect(polygonVerticesForDisplay(sides, 112, true)).toEqual([]);
    }
    expect(() => polygonVerticesForDisplay(2, 112, false)).toThrow(RangeError);
    expect(() => polygonVerticesForDisplay(1_000_000, 0, false)).toThrow(
      RangeError,
    );
  });

  it.each([3, 4, 5])("brackets pi with a regular %s-gon", (sides) => {
    const bounds = polygonBounds(sides);
    expect(bounds.lower).toBeLessThan(Math.PI);
    expect(bounds.upper).toBeGreaterThan(Math.PI);
  });
  it("uses true perimeters divided by the diameter", () => {
    const result = polygonBounds(6, 2);
    expect(result.innerPerimeter).toBeCloseTo(12);
    expect(result.outerPerimeter).toBeCloseTo(8 * Math.sqrt(3));
    expect(result.lower).toBeCloseTo(3);
    expect(result.upper).toBeCloseTo(2 * Math.sqrt(3));
  });

  it("strictly brackets pi and tightens both bounds at every doubling", () => {
    let previous = polygonBounds(6);
    for (let sides = 12; sides <= 1536; sides *= 2) {
      const next = polygonBounds(sides);
      expect(next.lower).toBeGreaterThan(previous.lower);
      expect(next.lower).toBeLessThan(Math.PI);
      expect(next.upper).toBeLessThan(previous.upper);
      expect(next.upper).toBeGreaterThan(Math.PI);
      previous = next;
    }
    expect(previous.upper - previous.lower).toBeLessThan(0.00001);
  });

  it.each([1, 3, 100])("keeps the same bounds at radius %s", (radius) => {
    expect(polygonBounds(96, radius).lower).toBe(polygonBounds(96).lower);
    expect(polygonBounds(96, radius).upper).toBe(polygonBounds(96).upper);
  });

  it("draws inner vertices on the circle and outer edges tangent to it", () => {
    for (const sides of [3, 4, 5, 6, 12, 96]) {
      const inner = polygonVertices(sides, 10, false);
      const outer = polygonVertices(sides, 10, true);
      expect(inner).toHaveLength(sides);
      expect(outer).toHaveLength(sides);
      for (const point of inner)
        expect(Math.hypot(point.x, point.y)).toBeCloseTo(10);
      for (let index = 0; index < sides; index++) {
        const a = outer[index]!;
        const b = outer[(index + 1) % sides]!;
        const distance =
          Math.abs(a.x * b.y - a.y * b.x) / Math.hypot(b.x - a.x, b.y - a.y);
        expect(distance).toBeCloseTo(10);
      }
    }
  });

  it("rejects impossible polygon sizes", () => {
    for (const sides of [0, 2, 6.5, Infinity])
      expect(() => polygonBounds(sides)).toThrow(RangeError);
    expect(() => polygonBounds(6, 0)).toThrow(RangeError);
  });
});

describe("rolling without slipping", () => {
  it.each([0.5, 1, 2, 10])(
    "travels one circumference after one turn at radius %s",
    (radius) => {
      const result = rollingCircle(radius, 2 * Math.PI);
      expect(result.diameter).toBe(2 * radius);
      expect(result.distance).toBeCloseTo(result.circumference);
      expect(result.distanceInDiameters).toBeCloseTo(Math.PI);
      expect(result.turns).toBe(1);
    },
  );

  it.each([0, Math.PI / 2, Math.PI, 3 * Math.PI])(
    "matches angle and distance at %s radians",
    (angle) => {
      const result = rollingCircle(3, angle);
      expect(result.distance).toBe(3 * angle);
      expect(result.distanceInDiameters).toBe(angle / 2);
      expect(result.turns).toBe(angle / (2 * Math.PI));
    },
  );

  it("rejects invalid radius or angle", () => {
    expect(() => rollingCircle(0, 1)).toThrow(RangeError);
    expect(() => rollingCircle(1, -1)).toThrow(RangeError);
    expect(() => rollingCircle(1, Number.NaN)).toThrow(RangeError);
  });
});
