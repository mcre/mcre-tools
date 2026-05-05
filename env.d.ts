/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_DOMAIN_NAME: string;
  readonly VITE_DISTRIBUTION_DOMAIN_NAME: string;
  readonly VITE_OGP_DOMAIN_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
