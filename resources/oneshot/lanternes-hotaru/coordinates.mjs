// Source placements use pixels in the finished map image. Foundry documents use
// canvas pixels, including padding rounded up to complete grid squares (v14).
export const SCENE_GRID_SIZE = 100;
export const SCENE_PADDING = 0.1;

export function mapOrigin({ width, height, padding = SCENE_PADDING, gridSize = SCENE_GRID_SIZE, shiftX = 0, shiftY = 0 }) {
  return {
    x: Math.ceil((padding * width) * (1 / gridSize)) * gridSize - shiftX,
    y: Math.ceil((padding * height) * (1 / gridSize)) * gridSize - shiftY,
  };
}

export function mapToCanvas(scene, point) {
  const origin = mapOrigin(scene);
  return { x: point.x + origin.x, y: point.y + origin.y };
}
