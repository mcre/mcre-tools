import type { AspidaClient, BasicHeaders } from 'aspida';
import { dataToURLString } from 'aspida';
import type { Methods as Methods_bqem5l } from './v1/group-roulette/rooms';
import type { Methods as Methods_1bmeu1n } from './v1/group-roulette/rooms/_roomId@string/guest-add-enabled';
import type { Methods as Methods_1q6v4cn } from './v1/group-roulette/rooms/_roomId@string/join';
import type { Methods as Methods_19r1k9f } from './v1/group-roulette/rooms/_roomId@string/options';
import type { Methods as Methods_1j0a2ia } from './v1/group-roulette/rooms/_roomId@string/options/_optionId@string';
import type { Methods as Methods_iqhcjz } from './v1/group-roulette/rooms/_roomId@string/spins/start';
import type { Methods as Methods_1m3l9cl } from './v1/group-roulette/rooms/_roomId@string/spins/stop';
import type { Methods as Methods_ghf1qg } from './v1/group-roulette/rooms/_roomId@string/state';
import type { Methods as Methods_2waeiu } from './v1/jukugo/_character@string/left-search';
import type { Methods as Methods_1w1sy1j } from './v1/jukugo/_character@string/right-search';

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? '' : baseURL).replace(/\/$/, '');
  const PATH0 = '/v1/group-roulette/rooms';
  const PATH1 = '/guest-add-enabled';
  const PATH2 = '/join';
  const PATH3 = '/options';
  const PATH4 = '/spins/start';
  const PATH5 = '/spins/stop';
  const PATH6 = '/state';
  const PATH7 = '/v1/jukugo';
  const PATH8 = '/left-search';
  const PATH9 = '/right-search';
  const GET = 'GET';
  const POST = 'POST';
  const DELETE = 'DELETE';
  const PATCH = 'PATCH';

  return {
    v1: {
      group_roulette: {
        rooms: {
          _roomId: (val3: string) => {
            const prefix3 = `${PATH0}/${val3}`;

            return {
              guest_add_enabled: {
                /**
                 * @returns 変更成功
                 */
                patch: (option: { body: Methods_1bmeu1n['patch']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_1bmeu1n['patch']['resBody'], BasicHeaders, Methods_1bmeu1n['patch']['status']>(prefix, `${prefix3}${PATH1}`, PATCH, option).json(),
                /**
                 * @returns 変更成功
                 */
                $patch: (option: { body: Methods_1bmeu1n['patch']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_1bmeu1n['patch']['resBody'], BasicHeaders, Methods_1bmeu1n['patch']['status']>(prefix, `${prefix3}${PATH1}`, PATCH, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix3}${PATH1}`,
              },
              join: {
                /**
                 * @returns 入室成功
                 */
                post: (option: { body: Methods_1q6v4cn['post']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_1q6v4cn['post']['resBody'], BasicHeaders, Methods_1q6v4cn['post']['status']>(prefix, `${prefix3}${PATH2}`, POST, option).json(),
                /**
                 * @returns 入室成功
                 */
                $post: (option: { body: Methods_1q6v4cn['post']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_1q6v4cn['post']['resBody'], BasicHeaders, Methods_1q6v4cn['post']['status']>(prefix, `${prefix3}${PATH2}`, POST, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix3}${PATH2}`,
              },
              options: {
                _optionId: (val5: string) => {
                  const prefix5 = `${prefix3}${PATH3}/${val5}`;

                  return {
                    /**
                     * @returns 候補削除成功
                     */
                    delete: (option: { body: Methods_1j0a2ia['delete']['reqBody'], config?: T | undefined }) =>
                      fetch<Methods_1j0a2ia['delete']['resBody'], BasicHeaders, Methods_1j0a2ia['delete']['status']>(prefix, prefix5, DELETE, option).json(),
                    /**
                     * @returns 候補削除成功
                     */
                    $delete: (option: { body: Methods_1j0a2ia['delete']['reqBody'], config?: T | undefined }) =>
                      fetch<Methods_1j0a2ia['delete']['resBody'], BasicHeaders, Methods_1j0a2ia['delete']['status']>(prefix, prefix5, DELETE, option).json().then(r => r.body),
                    $path: () => `${prefix}${prefix5}`,
                  };
                },
                /**
                 * @returns 候補追加成功
                 */
                post: (option: { body: Methods_19r1k9f['post']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_19r1k9f['post']['resBody'], BasicHeaders, Methods_19r1k9f['post']['status']>(prefix, `${prefix3}${PATH3}`, POST, option).json(),
                /**
                 * @returns 候補追加成功
                 */
                $post: (option: { body: Methods_19r1k9f['post']['reqBody'], config?: T | undefined }) =>
                  fetch<Methods_19r1k9f['post']['resBody'], BasicHeaders, Methods_19r1k9f['post']['status']>(prefix, `${prefix3}${PATH3}`, POST, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix3}${PATH3}`,
              },
              spins: {
                start: {
                  /**
                   * @returns 開始成功
                   */
                  post: (option: { body: Methods_iqhcjz['post']['reqBody'], config?: T | undefined }) =>
                    fetch<Methods_iqhcjz['post']['resBody'], BasicHeaders, Methods_iqhcjz['post']['status']>(prefix, `${prefix3}${PATH4}`, POST, option).json(),
                  /**
                   * @returns 開始成功
                   */
                  $post: (option: { body: Methods_iqhcjz['post']['reqBody'], config?: T | undefined }) =>
                    fetch<Methods_iqhcjz['post']['resBody'], BasicHeaders, Methods_iqhcjz['post']['status']>(prefix, `${prefix3}${PATH4}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix3}${PATH4}`,
                },
                stop: {
                  /**
                   * @returns 停止成功
                   */
                  post: (option: { body: Methods_1m3l9cl['post']['reqBody'], config?: T | undefined }) =>
                    fetch<Methods_1m3l9cl['post']['resBody'], BasicHeaders, Methods_1m3l9cl['post']['status']>(prefix, `${prefix3}${PATH5}`, POST, option).json(),
                  /**
                   * @returns 停止成功
                   */
                  $post: (option: { body: Methods_1m3l9cl['post']['reqBody'], config?: T | undefined }) =>
                    fetch<Methods_1m3l9cl['post']['resBody'], BasicHeaders, Methods_1m3l9cl['post']['status']>(prefix, `${prefix3}${PATH5}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix3}${PATH5}`,
                },
              },
              state: {
                /**
                 * @returns roomState 取得成功
                 */
                get: (option?: { query?: Methods_ghf1qg['get']['query'] | undefined, config?: T | undefined } | undefined) =>
                  fetch<Methods_ghf1qg['get']['resBody'], BasicHeaders, Methods_ghf1qg['get']['status']>(prefix, `${prefix3}${PATH6}`, GET, option).json(),
                /**
                 * @returns roomState 取得成功
                 */
                $get: (option?: { query?: Methods_ghf1qg['get']['query'] | undefined, config?: T | undefined } | undefined) =>
                  fetch<Methods_ghf1qg['get']['resBody'], BasicHeaders, Methods_ghf1qg['get']['status']>(prefix, `${prefix3}${PATH6}`, GET, option).json().then(r => r.body),
                $path: (option?: { method?: 'get' | undefined; query: Methods_ghf1qg['get']['query'] } | undefined) =>
                  `${prefix}${prefix3}${PATH6}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`,
              },
            };
          },
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
          const prefix2 = `${PATH7}/${val2}`;

          return {
            left_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_2waeiu['get']['resBody'], BasicHeaders, Methods_2waeiu['get']['status']>(prefix, `${prefix2}${PATH8}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_2waeiu['get']['resBody'], BasicHeaders, Methods_2waeiu['get']['status']>(prefix, `${prefix2}${PATH8}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH8}`,
            },
            right_search: {
              /**
               * @returns 成功
               */
              get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1w1sy1j['get']['resBody'], BasicHeaders, Methods_1w1sy1j['get']['status']>(prefix, `${prefix2}${PATH9}`, GET, option).json(),
              /**
               * @returns 成功
               */
              $get: (option?: { config?: T | undefined } | undefined) =>
                fetch<Methods_1w1sy1j['get']['resBody'], BasicHeaders, Methods_1w1sy1j['get']['status']>(prefix, `${prefix2}${PATH9}`, GET, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix2}${PATH9}`,
            },
          };
        },
      },
    },
  };
};

export type ApiInstance = ReturnType<typeof api>;
export default api;
