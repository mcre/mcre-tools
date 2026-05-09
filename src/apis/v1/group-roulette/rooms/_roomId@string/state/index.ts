/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../../../@types';

export type Methods = DefineMethods<{
  get: {
    query?: {
      memberId?: string | undefined;
    } | undefined;

    status: 200;
    /** roomState 取得成功 */
    resBody: Types.GroupRouletteRoomStateResponse;
  };
}>;
