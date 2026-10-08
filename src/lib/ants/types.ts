export const DT = 1 / 30;

export interface ModelConfig {
  speed: number;
  sensorDistance: number;
  sensorIndividuality?: number;
  sensorAngle: number;
  turnRate: number;
  randomTurn: number;
  foodSmellRadius: number;
  foodSmellTurnRate: number;
  deposit: number;
  distanceDecay: number;
  evaporation: number;
  diffusion: number;
  maxPheromone: number;
  explorationRate?: number;
  returnExplorationRate?: number;
  explorationDuration?: number;
  individuality?: number;
  pheromoneExponent?: number;
  pheromoneFloor?: number;
  averageSteering?: number;
  pheromoneChoiceChance?: number;
  returnChoiceChance?: number;
  frontWeight?: number;
  returnRandomMultiplier?: number;
}
export interface Layout {
  schemaVersion: 1;
  seed: number;
  columns: number;
  rows: number;
  antCount: number;
  nest: { x: number; y: number; radius: number };
  walls: number[];
  food: { index: number; amount: number }[];
  config: ModelConfig;
}
export interface Ant {
  x: number;
  y: number;
  heading: number;
  carrying: 0 | 1;
  distanceSinceSource: number;
  pace: number;
  wander: number;
  curiosity: number;
  exploreTicks: number;
}
export interface Snapshot {
  ants: Ant[];
  food: Uint16Array;
  homePheromone: Float32Array;
  foodPheromone: Float32Array;
  tick: number;
  rngState: number;
  delivered: number;
}
export interface Simulation extends Snapshot {
  layout: Layout;
  walls: Uint8Array;
  homePheromoneWork: Float32Array;
  foodPheromoneWork: Float32Array;
  homePheromoneDeposits: Float32Array;
  foodPheromoneDeposits: Float32Array;
}
export type EditTool = "food" | "wall" | "erase";
export interface Point {
  x: number;
  y: number;
}
