export const AREA_MAX_SECTORS = 256;

export const circleAreaGeometry = (count: number, radius: number) => {
  if (
    !Number.isInteger(count) ||
    count < 4 ||
    count > AREA_MAX_SECTORS ||
    count % 2 !== 0
  )
    throw new RangeError("Use an even sector count from 4 to 256");
  if (!Number.isFinite(radius) || radius <= 0)
    throw new RangeError("Radius must be positive");
  const halfAngle = Math.PI / count;
  const halfChord = radius * Math.sin(halfAngle);
  const rowHeight = radius * Math.cos(halfAngle);
  return {
    halfChord,
    rowHeight,
    sectorAngle: 2 * halfAngle,
    sectorArea: radius ** 2 * halfAngle,
    halfCircumference: Math.PI * radius,
    baseWidth: count * halfChord,
    sagitta: radius - rowHeight,
  };
};

export const circleAreaSectorPath = (count: number, radius: number) => {
  const { halfChord, rowHeight } = circleAreaGeometry(count, radius);
  return `M0 0L${-halfChord} ${rowHeight}A${radius} ${radius} 0 0 0 ${halfChord} ${rowHeight}Z`;
};

export const circleAreaSectors = (
  count: number,
  radius: number,
  progress: number,
) => {
  const { halfChord, rowHeight } = circleAreaGeometry(count, radius);
  if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new RangeError("Invalid rearrangement position");
  // Each piece moves rigidly. Alternating sectors share a complete radius;
  // their curved boundaries approach straight lines as count grows.
  return Array.from({ length: count }, (_, index) => {
    const start = (index * 360) / count;
    const end = index % 2 === 0 ? 0 : 180;
    const turn = ((end - start + 540) % 360) - 180;
    return {
      x: progress === 0 ? 0 : (index - (count - 1) / 2) * halfChord * progress,
      y:
        progress === 0
          ? 0
          : (((index % 2 === 0 ? -1 : 1) * rowHeight) / 2) * progress,
      rotation: start + turn * progress,
    };
  });
};
