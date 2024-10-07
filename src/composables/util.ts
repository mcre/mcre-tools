import { useHead } from '@unhead/vue'
import { ToolParams } from '@/router/index'

export const useUtil = () => {
  const setToolTitle = (
    toolParams?: ToolParams,
  ) => {
    const site = import.meta.env.VITE_APP_TITLE;

    let path: string;
    let title: string;
    let iconDir: string;
    let description : string;

    if (toolParams) {
      path = toolParams.path
      title = toolParams.title + " - " + site
      iconDir = toolParams.iconDir
      description = toolParams.description
    } else {
      path = "/"
      title = site
      iconDir = "favicon"
      description = "便利ツールやジョークツールなど、いろいろ置いていきます。"
    }

    const distUrl = `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`
    useHead({
      title: title,
      link: [
        {
          id: 'favicon-16',
          href: `/img/${iconDir}/16.png`,
        },
        {
          id: 'favicon-32',
          href: `/img/${iconDir}/32.png`,
        },
        {
          id: 'favicon-180',
          href: `/img/${iconDir}/180.png`,
        },
      ],
      meta: [
        {
          id: "robots",
          content: "all",
        },
        {
          id: "description",
          content: description,
        },
        {
          id: "og-title",
          content: title,
        },
        {
          id: "og-url",
          content: `${distUrl}${path}`,
        },
        {
          id: "og-image",
          content: `${distUrl}/img/${iconDir}/180.png`,
        },
        {
          id: "og-description",
          content: description,
        },
        {
          id: "tw-card",
          content: "summary",
        },
        {
          id: "tw-image",
          content: `${distUrl}/img/${iconDir}/180.png`,
        }
      ]
    })
  };

  const updateOgp = (toolParams: ToolParams, ogpImagePath: string) => {
    const distUrl = `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`
    const ogpUrl = `https://${import.meta.env.VITE_OGP_DOMAIN_NAME}`

    const imageFullPath = `${ogpUrl}${ogpImagePath}`;

    let currentUrl = `${distUrl}${toolParams.path}`
    if (!import.meta.env.SSR)
      currentUrl = document.documentURI

    useHead({
      meta: [
        {
          id: "og-url",
          content: currentUrl,
        },
        {
          id: "og-image",
          content: imageFullPath,
        },
        {
          id: "tw-card",
          content: "summary_large_image",
        },
        {
          id: "tw-image",
          content: imageFullPath,
        }
      ]
    })
  };

  const isKanji = (character: any): boolean => {
    if (typeof character !== "string") return false;
    const regex = new RegExp("^[\u4e00-\u9fff]$");
    return regex.test(character);
  };

  return {
    setToolTitle,
    updateOgp,
    isKanji,
  };
};
