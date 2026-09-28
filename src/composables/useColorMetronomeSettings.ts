export interface ColorMetronomeSettings {
  bpm: number;
  beats: number;
  subdivision: number;
  colors: string[];
}

export const COLOR_METRONOME_STORAGE_KEY =
  "mcre-tools.color-metronome.settings.v1";

export const createColorMetronomeSettings = (): ColorMetronomeSettings => ({
  bpm: 90,
  beats: 2,
  subdivision: 1,
  colors: [
    "#ffffff",
    "#404040",
    "#ff6347",
    "#f4c542",
    "#9370db",
    "#00bcd4",
    "#ff8c00",
    "#e56baf",
    "#8b6f47",
  ],
});

const numberInput = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return;
  if (typeof value === "string" && !value.trim()) return;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : undefined;
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const validColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export const useColorMetronomeSettings = () => {
  const settings = ref(createColorMetronomeSettings());
  let restored = false;
  let lastTap: number | undefined;
  let intervals: number[] = [];

  const setBpm = (value: unknown) => {
    const number = numberInput(value);
    if (number !== undefined) settings.value.bpm = clamp(number, 30, 250);
  };
  const setBeats = (value: unknown) => {
    const number = numberInput(value);
    if (number !== undefined) settings.value.beats = clamp(number, 1, 9);
  };
  const setSubdivision = (value: unknown) => {
    const number = numberInput(value);
    if (number !== undefined && [1, 2, 3, 4].includes(number))
      settings.value.subdivision = number;
  };
  const setColor = (index: number, color: unknown) => {
    if (Number.isInteger(index) && index >= 0 && index < 9 && validColor(color))
      settings.value.colors[index] = color.toLowerCase();
  };

  const save = () => {
    if (!restored) return false;
    try {
      window.localStorage.setItem(
        COLOR_METRONOME_STORAGE_KEY,
        JSON.stringify(settings.value),
      );
      return true;
    } catch {
      // The metronome remains usable without persistence.
      return false;
    }
  };

  const restore = () => {
    if (restored) return false;
    let firstVisit = false;
    try {
      const saved = window.localStorage.getItem(COLOR_METRONOME_STORAGE_KEY);
      firstVisit = saved === null;
      const stored: unknown = JSON.parse(saved ?? "null");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        const data = stored as Record<string, unknown>;
        setBpm(data.bpm);
        setBeats(data.beats);
        setSubdivision(data.subdivision);
        if (Array.isArray(data.colors))
          for (const [index, color] of data.colors.slice(0, 9).entries())
            setColor(index, color);
      }
    } catch {
      // Storage may be disabled or contain an older, invalid value.
    }
    restored = true;
    // Saving defaults makes later visits recognizable without storing playback state.
    return firstVisit && save();
  };

  const reset = () => {
    // Suppress automatic saving while removing the saved preferences.
    restored = false;
    settings.value = createColorMetronomeSettings();
    lastTap = undefined;
    intervals = [];
    try {
      window.localStorage.removeItem(COLOR_METRONOME_STORAGE_KEY);
    } catch {
      // In-memory settings can still be reset when storage is unavailable.
    }
    restored = true;
  };

  watch(settings, save, { deep: true, flush: "sync" });

  const tapTempo = (now = performance.now()) => {
    if (lastTap === undefined || now - lastTap > 2500 || now <= lastTap) {
      intervals = [];
    } else {
      intervals = [...intervals, now - lastTap].slice(-4);
      setBpm(
        60_000 /
          (intervals.reduce((sum, interval) => sum + interval, 0) /
            intervals.length),
      );
    }
    lastTap = now;
  };

  return {
    settings: readonly(settings),
    restore,
    reset,
    setBpm,
    setBeats,
    setSubdivision,
    setColor,
    tapTempo,
  };
};
