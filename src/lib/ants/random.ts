// Mulberry32: all model randomness passes through this saved uint32 state.
export const random = (state: { rngState: number }): number => {
  state.rngState = (state.rngState + 0x6d_2b_79_f5) >>> 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};
