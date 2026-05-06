import { describe, expect, it, vi } from "vitest";
import { scheduleThirdPartyScripts } from "@/utils/thirdPartyScripts";

describe("third-party scripts", () => {
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
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });
});
