/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../../../../@types';

export type Methods = DefineMethods<{
  post: {
    status: 200;
    /** 開始成功 */
    resBody: Types.GroupRouletteRoomStateResponse;

    reqBody: Types.GroupRouletteHostMutationRequest & {
      durationMs?: number | undefined;
    };
  };
}>;
