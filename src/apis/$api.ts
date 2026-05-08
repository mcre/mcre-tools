import type { AspidaClient, BasicHeaders } from 'aspida';
import type { Methods as Methods_bqem5l } from './v1/group-roulette/rooms';
import type { Methods as Methods_2waeiu } from './v1/jukugo/_character@string/left-search';
import type { Methods as Methods_1w1sy1j } from './v1/jukugo/_character@string/right-search';

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? '' : baseURL).replace(/\/$/, '');
  const PATH0 = '/v1/group-roulette/rooms';
  const PATH1 = '/v1/jukugo';
  const PATH2 = '/left-search';
  const PATH3 = '/right-search';
  const GET = 'GET';
  const POST = 'POST';

  return {
    v1: {
      group_roulette: {
        rooms: {
          /**
           * @returns 作成成功
           */
          post: (option?: { config?: T | undefined } | undefined) =>
            fetch<Methods_bqem5l['post']['resBody'], BasicHeaders, Methods_bqem5l['post']['status']>(prefix, PATH0, POST, option).json(),
          /**
           * @returns 作成成功
           */
          $post: (option?: { config?: T | undefined } | undefined) =>
            fetch<Methods_bqem5l['post']['resBody'], BasicHeaders, Methods_bqem5l['post']['status']>(prefix, PATH0, POST, option).json().then(r => r.body),
          $path: () => `${prefix}${PATH0}`,
        },
      },
      jukugo: {
        _character: (val2: string) => {
          const prefix2 = `${PATH1}/${val2}`;

          return {
            left_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_2waeiu['get']['resBody'], BasicHeaders, Methods_2waeiu['get']['status']>(prefix, `${prefix2}${PATH2}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_2waeiu['get']['resBody'], BasicHeaders, Methods_2waeiu['get']['status']>(prefix, `${prefix2}${PATH2}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH2}`,
            },
            right_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1w1sy1j['get']['resBody'], BasicHeaders, Methods_1w1sy1j['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1w1sy1j['get']['resBody'], BasicHeaders, Methods_1w1sy1j['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH3}`,
            },
          };
        },
      },
    },
  };
};

export type ApiInstance = ReturnType<typeof api>;
export default api;
