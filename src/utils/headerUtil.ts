import { useI18n } from "vue-i18n";
import { computed } from "vue";

export const useHeaderUtil = () => {
  const { t, locale, availableLocales, fallbackLocale } = useI18n();
  const i18nUtil = useI18nUtil();

  const getHead = (tool?: string) => {
    const site = computed(() => t("common.title"));
    const localeName = computed(() => t("localeName"));
    const localeValue = computed(() => locale.value);
    const path = computed(() => (tool ? i18nUtil.path(tool) : "/"));
    const ogUrl = computed(() => `${distUrl}${path.value}`);
    const title = computed(() =>
      tool ? `${t(`tools.${tool}.title`)} - ${site.value}` : site.value,
    );
    const iconDir = tool ? tool : "favicon";
    const description = computed(() =>
      tool ? t(`tools.${tool}.description`) : t(`common.description`),
    );

    const distUrl = `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`;

    return {
      htmlAttrs: {
        lang: localeValue,
      },
      title: title,
      link: [
        ...availableLocales.map((lang) => ({
          rel: "alternate",
          hreflang: lang,
          href: `${distUrl}/${lang}/${tool ? tool : ""}`,
        })),
        {
          rel: "alternate",
          hreflang: "x-default",
          href: `${distUrl}/${fallbackLocale.value}/${tool ? tool : ""}`,
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
          id: "robots",
          content: "all",
        },
        {
          id: "description",
          content: description,
        },
        {
          id: "og-locale",
          content: localeName,
        },
        {
          id: "og-site-name",
          content: site,
        },
        {
          id: "og-title",
          content: title,
        },
        {
          id: "og-url",
          content: ogUrl,
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
          id: "note-card",
          content: "summary",
        },
        {
          id: "tw-card",
          content: "summary",
        },
        {
          id: "tw-image",
          content: `${distUrl}/img/${iconDir}/180.png`,
        },
      ],
    };
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
          id: "og-url",
          content: currentFullPath,
        },
        {
          id: "og-image",
          content: imageFullPath,
        },
        {
          id: "note-card",
          content: "summary_large_image",
        },
        {
          id: "tw-card",
          content: "summary_large_image",
        },
        {
          id: "tw-image",
          content: imageFullPath,
        },
      ],
    };
  };

  return {
    getHead,
    getOgpHead,
  };
};
