import type { AspidaClient, BasicHeaders } from 'aspida';
import type { Methods as Methods_27ohb9 } from './v1/jukugo/_char@string/left-search';
import type { Methods as Methods_1n8a51e } from './v1/jukugo/_char@string/right-search';

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? '' : baseURL).replace(/\/$/, '');
  const PATH0 = '/v1/jukugo';
  const PATH1 = '/left-search';
  const PATH2 = '/right-search';
  const GET = 'GET';

  return {
    v1: {
      jukugo: {
        _char: (val2: string) => {
          const prefix2 = `${PATH0}/${val2}`;

          return {
            left_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_27ohb9['get']['resBody'], BasicHeaders, Methods_27ohb9['get']['status']>(prefix, `${prefix2}${PATH1}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_27ohb9['get']['resBody'], BasicHeaders, Methods_27ohb9['get']['status']>(prefix, `${prefix2}${PATH1}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH1}`,
            },
            right_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1n8a51e['get']['resBody'], BasicHeaders, Methods_1n8a51e['get']['status']>(prefix, `${prefix2}${PATH2}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1n8a51e['get']['resBody'], BasicHeaders, Methods_1n8a51e['get']['status']>(prefix, `${prefix2}${PATH2}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH2}`,
            },
          };
        },
      },
    },
  };
};

export type ApiInstance = ReturnType<typeof api>;
export default api;
