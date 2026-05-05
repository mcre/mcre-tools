import { computed } from "vue";
import { useI18n } from "vue-i18n";

export const useHeaderUtil = () => {
  const { t, locale, availableLocales, fallbackLocale } = useI18n();
  const i18nUtil = useI18nUtil();

  const getHead = (tool?: string) => {
    const distUrl = `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`;
    const site = computed(() => t("common.title"));
    const localeName = computed(() => t("localeName"));
    const localeValue = computed(() => locale.value);
    const path = computed(() => i18nUtil.path(tool || "/"));
    const canonicalUrl = computed(() => `${distUrl}${path.value}`);
    const title = computed(() =>
      tool ? `${t(`tools.${tool}.title`)} - ${site.value}` : site.value,
    );
    const iconDir = tool || "favicon";
    const imageUrl = computed(() => `${distUrl}/img/${iconDir}/180.png`);
    const description = computed(() =>
      tool ? t(`tools.${tool}.description`) : t(`common.description`),
    );
    const structuredData = computed(() => {
      const websiteId = `${distUrl}/#website`;
      const website = {
        "@type": "WebSite",
        "@id": websiteId,
        name: site.value,
        url: `${distUrl}${i18nUtil.path("/")}`,
        inLanguage: localeValue.value,
        description: t("common.description"),
      };

      if (!tool) {
        return {
          "@context": "https://schema.org",
          "@graph": [website],
        };
      }

      return {
        "@context": "https://schema.org",
        "@graph": [
          website,
          {
            "@type": "WebApplication",
            "@id": `${canonicalUrl.value}#webapp`,
            name: t(`tools.${tool}.title`),
            url: canonicalUrl.value,
            description: description.value,
            inLanguage: localeValue.value,
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Any",
            image: imageUrl.value,
            isPartOf: {
              "@id": websiteId,
            },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${canonicalUrl.value}#breadcrumb`,
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: site.value,
                item: `${distUrl}${i18nUtil.path("/")}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: t(`tools.${tool}.title`),
                item: canonicalUrl.value,
              },
            ],
          },
        ],
      };
    });

    return {
      htmlAttrs: {
        lang: localeValue,
      },
      title,
      link: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
        ...availableLocales.map((lang) => ({
          rel: "alternate",
          hreflang: lang,
          href: `${distUrl}/${lang}/${tool || ""}`,
        })),
        {
          rel: "alternate",
          hreflang: "x-default",
          href: `${distUrl}/${fallbackLocale.value}/${tool || ""}`,
        },
        {
          id: "favicon-16",
          href: `/img/${iconDir}/16.png`,
        },
        {
          id: "favicon-32",
          href: `/img/${iconDir}/32.png`,
        },
        {
          id: "favicon-180",
          href: `/img/${iconDir}/180.png`,
        },
      ],
      meta: [
        {
          name: "robots",
          content: "all",
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          property: "og:locale",
          content: localeName,
        },
        {
          property: "og:site_name",
          content: site,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:url",
          content: canonicalUrl,
        },
        {
          property: "og:image",
          content: imageUrl,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          name: "note:card",
          content: "summary",
        },
        {
          name: "twitter:card",
          content: "summary",
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
        {
          name: "twitter:image",
          content: imageUrl,
        },
      ],
      script: [
        {
          type: "application/ld+json",
          textContent: computed(() => JSON.stringify(structuredData.value)),
        },
      ],
    } as any;
  };

  const getOgpHead = () => {
    const route = useRoute();

    const distUrl = `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`;
    const ogpUrl = `https://${import.meta.env.VITE_OGP_DOMAIN_NAME}`;

    const imageFullPath = computed(() => `${ogpUrl}${route.fullPath}`);
    const currentFullPath = computed(() => `${distUrl}${route.fullPath}`);

    return {
      meta: [
        {
          property: "og:url",
          content: currentFullPath,
        },
        {
          property: "og:image",
          content: imageFullPath,
        },
        {
          name: "note:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:image",
          content: imageFullPath,
        },
      ],
    } as any;
  };

  return {
    getHead,
    getOgpHead,
  };
};
