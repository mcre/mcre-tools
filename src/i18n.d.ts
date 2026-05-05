import type { ComputedRef } from "vue";

type Translation = (
  path: string,
  option?: Record<string, any>,
) => ComputedRef<string>;
interface I18n {
  locale: string;
  language: Record<string, any>;
  t: Translation;
}
