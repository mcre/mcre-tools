import aspida from "@aspida/fetch";
import api from "@/apis/$api";

export const createApiBaseURL = (domainName: string) => {
  if (domainName.startsWith("http://") || domainName.startsWith("https://")) {
    return domainName;
  }
  return `https://${domainName}`;
};

export const useApi = () => {
  return api(
    aspida(fetch, {
      baseURL: createApiBaseURL(import.meta.env.VITE_API_DOMAIN_NAME),
    }),
  );
};
