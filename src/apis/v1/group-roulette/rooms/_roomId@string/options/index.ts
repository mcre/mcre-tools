/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../../../@types';

export type Methods = DefineMethods<{
  post: {
    status: 200;
    /** 候補追加成功 */
    resBody: Types.GroupRouletteRoomStateResponse;
    reqBody: Types.GroupRouletteAddOptionRequest;
  };
}>;
