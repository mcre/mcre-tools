/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../@types';

export type Methods = DefineMethods<{
  post: {
    status: 201;
    /** 作成成功 */
    resBody: Types.GroupRouletteCreateRoomResponse;
  };
}>;
