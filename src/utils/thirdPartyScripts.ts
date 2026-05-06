const GOOGLE_TAG_ID = "G-9GF85RN3RN";
const ADSENSE_CLIENT_ID = "ca-pub-6775396247014328";
const DEFAULT_ALLOWED_HOSTNAMES = ["tools.mcre.info"];

type ThirdPartyWindow = Window &
  typeof globalThis & {
    adsbygoogle?: unknown[];
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };

export type ThirdPartyScriptsOptions = {
  allowedHostnames?: string[];
  delayMs?: number;
  win?: ThirdPartyWindow;
};

function appendScript(
  win: ThirdPartyWindow,
  id: string,
  src: string,
  options: { crossOrigin?: string } = {},
) {
  if (win.document.querySelector(`script#${id}`)) return;

  const script = win.document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
  win.document.head.append(script);
}

function injectThirdPartyScripts(win: ThirdPartyWindow) {
  win.dataLayer = win.dataLayer || [];
  win.gtag = function gtag(...args: unknown[]) {
    win.dataLayer?.push(args);
  };
  win.gtag("js", new Date());
  win.gtag("config", GOOGLE_TAG_ID);

  appendScript(
    win,
    "third-party-google-tag",
    `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`,
  );
  win.adsbygoogle = win.adsbygoogle || [];
  appendScript(
    win,
    "third-party-adsense",
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`,
    { crossOrigin: "anonymous" },
  );
}

export function scheduleThirdPartyScripts({
  allowedHostnames = DEFAULT_ALLOWED_HOSTNAMES,
  delayMs = 5000,
  win = window as ThirdPartyWindow,
}: ThirdPartyScriptsOptions = {}) {
  if (!allowedHostnames.includes(win.location.hostname)) return;
  if (
    win.document.documentElement.dataset.thirdPartyScriptsScheduled === "true"
  ) {
    return;
  }

  win.document.documentElement.dataset.thirdPartyScriptsScheduled = "true";
  const schedule = () => {
    win.setTimeout(() => injectThirdPartyScripts(win), delayMs);
  };

  if (win.document.readyState === "complete") {
    schedule();
    return;
  }

  win.addEventListener("load", schedule, { once: true });
}
