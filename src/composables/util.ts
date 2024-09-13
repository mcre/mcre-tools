export const useUtil = () => {
  const setTitle = (
    title?: string | null,
    favicon: string = "favicon",
    description: string = "便利ツールやジョークツールなど、いろいろ置いていきます。"
  ) => {
    const site = import.meta.env.VITE_APP_TITLE;
    let newTitle = "";
    if (title) {
      newTitle = title + " - " + site;
    } else {
      newTitle = site;
    }
    document.title = newTitle;

    const favicon16 = document.querySelector("link[id='favicon-16']");
    if (favicon16) favicon16.setAttribute("href", `/img/${favicon}/16.png`);

    const favicon32 = document.querySelector("link[id='favicon-32']");
    if (favicon32) favicon32.setAttribute("href", `/img/${favicon}/32.png`);

    const favicon180 = document.querySelector("link[id='favicon-180']");
    if (favicon180) favicon180.setAttribute("href", `/img/${favicon}/180.png`);

    const metaDescription = document.querySelector("meta[id='description']");
    if (metaDescription) metaDescription.setAttribute("content", description);

    const ogURl = document.querySelector("meta[id='og-url']");
    if (ogURl) ogURl.setAttribute("content", document.documentURI);

    const ogSiteName = document.querySelector("meta[id='og-site-name']");
    if (ogSiteName)
      if (title) ogSiteName.setAttribute("content", title);
      else ogSiteName.setAttribute("content", site);

    const ogImage = document.querySelector("meta[id='og-image']");
    if (ogImage)
      ogImage.setAttribute(
        "content",
        `https://${import.meta.env.VITE_APP_DOMAIN_NAME}/img/${favicon}/180.png`
      );

    const ogDescription = document.querySelector("meta[id='og-description']");
    if (ogDescription) ogDescription.setAttribute("content", description);
  };

  const isKanji = (character: any): boolean => {
    if (typeof character !== "string") return false;
    const regex = new RegExp("^[\u4e00-\u9fff]$");
    return regex.test(character);
  };

  return {
    setTitle,
    isKanji,
  };
};
