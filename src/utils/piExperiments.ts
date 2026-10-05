export interface SquarePoint {
  x: number;
  y: number;
  inside: boolean;
}

export const isInsideUnitCircle = (x: number, y: number) => x * x + y * y <= 1;

export const sampleSquarePoint = (
  random: () => number = Math.random,
): SquarePoint => {
  const x = 2 * random() - 1;
  const y = 2 * random() - 1;
  return { x, y, inside: isInsideUnitCircle(x, y) };
};

export const estimatePi = (inside: number, total: number) => {
  if (
    !Number.isInteger(total) ||
    !Number.isInteger(inside) ||
    inside < 0 ||
    total < inside
  )
    throw new RangeError("Invalid sample counts");
  return total === 0 ? null : (4 * inside) / total;
};

export const monteCarloBatchSize = (position: number) =>
  Math.round(100 * 10 ** Math.max(0, Math.min(4, position)));

export interface MonteCarloGraphRange {
  min: number;
  max: number;
  decimals: number;
}

export const monteCarloGraphRange = (
  history: readonly { total: number; estimate: number }[],
): MonteCarloGraphRange => {
  const latest = history.at(-1);
  if (!latest) return { min: 3, max: 3.3, decimals: 1 };
  // Zoom using the last 90% of trials so early outliers do not keep the
  // scale wide forever. All history is still drawn, clipped to this range.
  const recent = history.filter((point) => point.total >= latest.total / 10);
  const low = Math.min(Math.PI, ...recent.map((point) => point.estimate));
  const high = Math.max(Math.PI, ...recent.map((point) => point.estimate));
  // Use stable, readable scales. Stop at a 0.003-wide interval so tiny
  // sampling errors do not look like a large persistent offset from pi.
  const scales: MonteCarloGraphRange[] = [
    { min: 3.14, max: 3.143, decimals: 3 },
    { min: 3.13, max: 3.15, decimals: 2 },
    { min: 3.1, max: 3.2, decimals: 1 },
    { min: 3, max: 3.3, decimals: 1 },
  ];
  return (
    scales.find(({ min, max }) => {
      const padding = (max - min) * 0.1;
      return low >= min + padding && high <= max - padding;
    }) ?? { min: 0, max: 4, decimals: 0 }
  );
};

export const monteCarloGraphY = (value: number, range: MonteCarloGraphRange) =>
  102 - ((value - range.min) / (range.max - range.min)) * 92;

const validateRadius = (radius: number) => {
  if (!Number.isFinite(radius) || radius <= 0)
    throw new RangeError("Radius must be positive");
};
const validatePolygon = (sides: number, radius: number) => {
  if (!Number.isInteger(sides) || sides < 3)
    throw new RangeError("A polygon needs at least three sides");
  validateRadius(radius);
};

export const MAX_POLYGON_SIDES = 1_000_000;
export const POLYGON_VERTEX_LIMIT = 256;

export const polygonSidesForPosition = (position: number) => {
  if (!Number.isFinite(position))
    throw new RangeError("Invalid slider position");
  const bounded = Math.max(0, Math.min(100, position));
  // Reserve the first 30% for small polygons so they stay easy to select.
  return Math.round(
    bounded <= 30
      ? 3 + (9 * bounded) / 30
      : 12 * (MAX_POLYGON_SIDES / 12) ** ((bounded - 30) / 70),
  );
};

export const polygonSliderPosition = (sides: number) => {
  validatePolygon(sides, 1);
  const bounded = Math.min(MAX_POLYGON_SIDES, sides);
  return bounded <= 12
    ? ((bounded - 3) / 9) * 30
    : 30 + (70 * Math.log(bounded / 12)) / Math.log(MAX_POLYGON_SIDES / 12);
};

export const polygonBounds = (sides: number, radius = 1) => {
  validatePolygon(sides, radius);
  // Each half-side subtends pi / n at the center.
  // The inscribed hexagon is exactly three diameters long.
  const lower = sides === 6 ? 3 : sides * Math.sin(Math.PI / sides);
  const upper = sides * Math.tan(Math.PI / sides);
  return {
    lower,
    upper,
    innerPerimeter: 2 * radius * lower,
    outerPerimeter: 2 * radius * upper,
  };
};

export const polygonDisplayValues = (sides: number, radius = 1) => {
  const bounds = polygonBounds(sides, radius);
  const decimals = Math.min(12, Math.max(6, 2 * Math.ceil(Math.log10(sides))));
  const scale = 10 ** decimals;
  // Round outward so the displayed interval still contains pi.
  return {
    decimals,
    lower: (Math.floor(bounds.lower * scale) / scale).toFixed(decimals),
    upper: (Math.ceil(bounds.upper * scale) / scale).toFixed(decimals),
    innerPerimeter: bounds.innerPerimeter.toFixed(decimals),
    outerPerimeter: bounds.outerPerimeter.toFixed(decimals),
  };
};

export const polygonVertices = (
  sides: number,
  radius: number,
  outer: boolean,
) => {
  validatePolygon(sides, radius);
  const vertexRadius = outer ? radius / Math.cos(Math.PI / sides) : radius;
  return Array.from({ length: sides }, (_, index) => {
    const angle =
      (2 * Math.PI * index) / sides -
      Math.PI / 2 +
      (outer ? Math.PI / sides : 0);
    return {
      x: vertexRadius * Math.cos(angle),
      y: vertexRadius * Math.sin(angle),
    };
  });
};

export const polygonVerticesForDisplay = (
  sides: number,
  radius: number,
  outer: boolean,
) => {
  validatePolygon(sides, radius);
  return sides >= POLYGON_VERTEX_LIMIT
    ? []
    : polygonVertices(sides, radius, outer);
};

export const rollingCircle = (radius: number, angle: number) => {
  validateRadius(radius);
  if (!Number.isFinite(angle) || angle < 0)
    throw new RangeError("Angle must be nonnegative");
  return {
    diameter: 2 * radius,
    circumference: 2 * Math.PI * radius,
    distance: radius * angle,
    distanceInDiameters: angle / 2,
    turns: angle / (2 * Math.PI),
  };
};
