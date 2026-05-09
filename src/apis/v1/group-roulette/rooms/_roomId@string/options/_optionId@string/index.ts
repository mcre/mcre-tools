/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../../../../@types';

export type Methods = DefineMethods<{
  delete: {
    status: 200;
    /** 候補削除成功 */
    resBody: Types.GroupRouletteRoomStateResponse;
    reqBody: Types.GroupRouletteHostMutationRequest;
  };
}>;
