import { useI18n } from "vue-i18n";

export const useI18nUtil = () => {
  const { locale } = useI18n();

  const path = (pathString: string) => {
    let modifiedPathString = pathString;
    if (modifiedPathString.charAt(0) === "/") {
      modifiedPathString = modifiedPathString.slice(1);
    }

    return `/${locale.value}/${modifiedPathString}`;
  };

  return {
    path,
  };
};
