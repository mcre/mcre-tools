export const useUtil = () => {
  const setTitle = (title?: string | null) => {
    const site = "MCRE TOOLS";
    let newTitle = "";
    if (title) {
      newTitle = title + " - " + site;
    } else {
      newTitle = site;
    }
    document.title = newTitle;

    const elem1 = document.querySelector("meta[id='ogtitle']");
    if (elem1) elem1.setAttribute("content", newTitle);

    const elem3 = document.querySelector("meta[id='ogurl']");
    if (elem3) elem3.setAttribute("content", document.documentURI);
  };

  return {
    setTitle,
  };
};
