/* eslint-disable */
import type { DefineMethods } from 'aspida';
import type * as Types from '../../../../../@types';

export type Methods = DefineMethods<{
  patch: {
    status: 200;
    /** 変更成功 */
    resBody: Types.GroupRouletteRoomStateResponse;
    reqBody: Types.GroupRouletteSetGuestAddEnabledRequest;
  };
}>;
