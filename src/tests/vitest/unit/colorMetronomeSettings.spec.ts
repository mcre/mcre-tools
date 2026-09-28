import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import {
  COLOR_METRONOME_STORAGE_KEY,
  useColorMetronomeSettings,
} from "@/composables/useColorMetronomeSettings";

describe("color metronome settings", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  const create = () => {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(useColorMetronomeSettings)!;
  };
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    vi.restoreAllMocks();
  });

  it("identifies a first visit once and saves defaults without playback state", () => {
    const preferences = create();
    expect(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)).toBeNull();
    expect(preferences.restore()).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)!),
    ).toEqual(preferences.settings.value);
    expect(preferences.restore()).toBe(false);
    expect(create().restore()).toBe(false);
  });

  it("treats reloading after a settings reset as a first visit", () => {
    const preferences = create();
    preferences.restore();
    preferences.setBpm(140);
    preferences.reset();
    const reloaded = create();
    expect(reloaded.restore()).toBe(true);
    expect(reloaded.settings.value.bpm).toBe(90);
  });

  it("does not claim a first visit if it cannot save defaults", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    const preferences = create();
    expect(preferences.restore()).toBe(false);
    expect(() => preferences.setBpm(120)).not.toThrow();
    expect(preferences.settings.value.bpm).toBe(120);
  });

  it("defaults to two beats with nine distinct colors and only restores on request", () => {
    localStorage.setItem(
      COLOR_METRONOME_STORAGE_KEY,
      JSON.stringify({ bpm: 150, beats: 4, subdivision: 2 }),
    );
    const preferences = create();
    expect(preferences.settings.value).toMatchObject({
      bpm: 90,
      beats: 2,
      subdivision: 1,
    });
    expect(preferences.settings.value.colors).toHaveLength(9);
    expect(new Set(preferences.settings.value.colors).size).toBe(9);
    expect(preferences.restore()).toBe(false);
    expect(preferences.settings.value).toMatchObject({
      bpm: 150,
      beats: 4,
      subdivision: 2,
    });
    expect(preferences.settings.value.colors.slice(0, 3)).toEqual([
      "#ffffff",
      "#404040",
      "#ff6347",
    ]);
  });

  it("saves settings and retains hidden beats' colors", () => {
    const preferences = create();
    preferences.restore();
    preferences.setBpm(123);
    preferences.setBeats(9);
    preferences.setSubdivision(3);
    preferences.setColor(0, "#4169e1");
    preferences.setColor(1, "#3cb371");
    preferences.setColor(8, "#123456");
    preferences.setBeats(2);
    const restored = create();
    restored.restore();
    restored.setBeats(9);
    expect(restored.settings.value).toMatchObject({
      bpm: 123,
      beats: 9,
      subdivision: 3,
    });
    expect(restored.settings.value.colors.slice(0, 2)).toEqual([
      "#4169e1",
      "#3cb371",
    ]);
    expect(restored.settings.value.colors[8]).toBe("#123456");
    expect(
      Object.keys(
        JSON.parse(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)!),
      ).toSorted(),
    ).toEqual(["beats", "bpm", "colors", "subdivision"]);
  });

  it("normalizes numbers and ignores incomplete or invalid inputs", () => {
    const preferences = create();
    preferences.setBpm(120.8);
    expect(preferences.settings.value.bpm).toBe(121);
    for (const value of ["", " ", "bad", Number.NaN, Infinity, null])
      preferences.setBpm(value);
    expect(preferences.settings.value.bpm).toBe(121);
    preferences.setBpm(999);
    expect(preferences.settings.value.bpm).toBe(250);
    preferences.setBpm(-5);
    expect(preferences.settings.value.bpm).toBe(30);
    preferences.setBeats(99);
    expect(preferences.settings.value.beats).toBe(9);
    preferences.setSubdivision(9);
    preferences.setColor(0, "not a color");
    expect(preferences.settings.value.subdivision).toBe(1);
    expect(preferences.settings.value.colors[0]).toBe("#ffffff");
  });

  it("resets all settings, removes only its storage key and saves subsequent edits", () => {
    const preferences = create();
    const defaults = {
      ...preferences.settings.value,
      colors: [...preferences.settings.value.colors],
    };
    preferences.restore();
    localStorage.setItem("another-tool", "keep");
    preferences.setBpm(180);
    preferences.setBeats(9);
    preferences.setSubdivision(4);
    preferences.setColor(0, "#000000");
    preferences.setColor(8, "#123456");
    preferences.setBeats(2);
    preferences.reset();
    expect(preferences.settings.value).toEqual(defaults);
    expect(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("another-tool")).toBe("keep");
    const restored = create();
    restored.restore();
    expect(restored.settings.value).toEqual(defaults);
    preferences.setBpm(140);
    expect(
      JSON.parse(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)!),
    ).toMatchObject({ bpm: 140 });
  });

  it("clears tap history when settings are reset", () => {
    const preferences = create();
    preferences.tapTempo(0);
    preferences.tapTempo(500);
    expect(preferences.settings.value.bpm).toBe(120);
    preferences.reset();
    preferences.tapTempo(1000);
    expect(preferences.settings.value.bpm).toBe(90);
    preferences.tapTempo(2000);
    expect(preferences.settings.value.bpm).toBe(60);
  });

  it("resets in memory even when storage is inaccessible", () => {
    const preferences = create();
    preferences.restore();
    preferences.setBpm(180);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    expect(() => preferences.reset()).not.toThrow();
    expect(preferences.settings.value.bpm).toBe(90);
    preferences.setBpm(100);
    expect(
      JSON.parse(localStorage.getItem(COLOR_METRONOME_STORAGE_KEY)!),
    ).toMatchObject({ bpm: 100 });
  });

  it.each([
    "broken JSON",
    "null",
    "[]",
    '{"bpm":"bad","beats":null,"subdivision":5,"colors":["bad"]}',
  ])("survives damaged storage: %s", (data) => {
    localStorage.setItem(COLOR_METRONOME_STORAGE_KEY, data);
    const preferences = create();
    expect(() => preferences.restore()).not.toThrow();
    expect(create().restore()).toBe(false);
    expect(preferences.settings.value).toMatchObject({
      bpm: 90,
      beats: 2,
      subdivision: 1,
    });
    expect(preferences.settings.value.colors[0]).toBe("#ffffff");
  });

  it("works when storage is inaccessible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full");
    });
    const preferences = create();
    expect(preferences.restore()).toBe(false);
    expect(() => preferences.setBpm(140)).not.toThrow();
    expect(preferences.settings.value.bpm).toBe(140);
  });

  it("averages the last four tap intervals and resets after a pause", () => {
    const preferences = create();
    for (const time of [0, 500, 1000, 1500, 2000]) preferences.tapTempo(time);
    expect(preferences.settings.value.bpm).toBe(120);
    preferences.tapTempo(3000);
    expect(preferences.settings.value.bpm).toBe(96);
    preferences.tapTempo(6000);
    expect(preferences.settings.value.bpm).toBe(96);
    preferences.tapTempo(7000);
    expect(preferences.settings.value.bpm).toBe(60);
  });
});
