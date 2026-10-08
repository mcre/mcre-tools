import type { ModelConfig } from "./types";

export const DEFAULT_MODEL_CONFIG: Readonly<ModelConfig> = Object.freeze({
  speed: 9,
  sensorDistance: 5,
  sensorAngle: 0.7,
  turnRate: 4.5,
  randomTurn: 0.09,
  foodSmellRadius: 8,
  foodSmellTurnRate: 1.2,
  deposit: 2.5,
  distanceDecay: 35,
  evaporation: 0.12,
  diffusion: 0.6,
  maxPheromone: 100,
  pheromoneExponent: 0.9,
  pheromoneChoiceChance: 1,
  returnChoiceChance: 1,
  individuality: 0.6,
  averageSteering: 1,
  sensorIndividuality: 1,
  explorationRate: 0,
  explorationDuration: 2,
});
