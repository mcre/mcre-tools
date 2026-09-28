import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleThirdPartyScripts } from "@/utils/thirdPartyScripts";

describe("third-party scripts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/ja/");
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.stubGlobal("dataLayer", []);
    vi.stubGlobal("gtag", undefined);
    vi.stubGlobal("adsbygoogle", undefined);
  });

  afterEach(() => {
    document.querySelector("#third-party-google-tag")?.remove();
    document.querySelector("#third-party-adsense")?.remove();
    delete document.documentElement.dataset.thirdPartyScriptsScheduled;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not inject analytics or ads scripts on non-production hostnames", () => {
    scheduleThirdPartyScripts({ delayMs: 0 });

    expect(
      document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
    ).toBeNull();
    expect(
      document.querySelector('script[src*="pagead2.googlesyndication.com"]'),
    ).toBeNull();
  });

  it("injects analytics and ads scripts after window load and delay on allowed hostnames", () => {
    scheduleThirdPartyScripts({
      allowedHostnames: [window.location.hostname],
      delayMs: 5000,
    });

    expect(
      document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
    ).toBeNull();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(4999);
    expect(
      document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
    ).toBeNull();

    vi.advanceTimersByTime(1);

    expect(
      document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('script[src*="pagead2.googlesyndication.com"]'),
    ).not.toBeNull();
  });

  it("queues initialization and event commands as Arguments objects for Google tag", () => {
    const win = window as Window & {
      dataLayer: IArguments[];
      gtag: (...args: unknown[]) => void;
    };
    scheduleThirdPartyScripts({
      allowedHostnames: [window.location.hostname],
      delayMs: 0,
    });
    window.dispatchEvent(new Event("load"));
    vi.runAllTimers();

    const eventParameters = { page_path: "/ja/clock" };
    win.gtag("event", "page_view", eventParameters);

    expect(win.dataLayer).toHaveLength(3);
    for (const command of win.dataLayer) {
      // gtag.js treats Arguments as commands; plain arrays are not equivalent.
      expect(Object.prototype.toString.call(command)).toBe(
        "[object Arguments]",
      );
    }
    expect(Array.from(win.dataLayer[0]!)).toEqual(["js", expect.any(Date)]);
    expect(Array.from(win.dataLayer[1]!)).toEqual(["config", "G-9GF85RN3RN"]);
    expect(Array.from(win.dataLayer[2]!)).toEqual([
      "event",
      "page_view",
      eventParameters,
    ]);
  });

  it.each([
    "/ja/qr-code?text=private",
    "/en/qr-code/?text=private",
    "/qr-code?text=private",
    "/ja/qr-code/index.html?text=private",
  ])("keeps analytics and ads enabled on %s", (path) => {
    window.history.replaceState({}, "", path);
    scheduleThirdPartyScripts({
      allowedHostnames: [window.location.hostname],
      delayMs: 0,
    });
    window.dispatchEvent(new Event("load"));
    vi.runAllTimers();
    expect(document.querySelector("#third-party-google-tag")).not.toBeNull();
    expect(document.querySelector("#third-party-adsense")).not.toBeNull();
    expect(
      (window as Window & { dataLayer: unknown[] }).dataLayer,
    ).toHaveLength(2);
  });

  it("keeps analytics and ads enabled when entering QR during the delay", () => {
    scheduleThirdPartyScripts({
      allowedHostnames: [window.location.hostname],
      delayMs: 5000,
    });
    window.dispatchEvent(new Event("load"));
    window.history.replaceState({}, "", "/ja/qr-code?text=private");
    vi.runAllTimers();
    expect(document.querySelector("#third-party-google-tag")).not.toBeNull();
    expect(document.querySelector("#third-party-adsense")).not.toBeNull();
  });

  it("keeps analytics and ads enabled after leaving a QR page", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue(
      "https://tools.mcre.info/ja/qr-code?text=private",
    );
    scheduleThirdPartyScripts({
      allowedHostnames: [window.location.hostname],
      delayMs: 0,
    });
    window.dispatchEvent(new Event("load"));
    vi.runAllTimers();
    expect(document.querySelector("#third-party-google-tag")).not.toBeNull();
    expect(document.querySelector("#third-party-adsense")).not.toBeNull();
  });
});
