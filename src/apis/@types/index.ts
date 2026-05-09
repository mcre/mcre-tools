/* eslint-disable */
export type GroupRouletteRoomId = {
  roomId: string;
}

export type JukugoSearchResponse = {
  /** 熟語の反対側の文字 */
  character: string;
  /** 熟語生成コスト */
  cost: number;
}[]

export type GroupRouletteCreateRoomResponse = GroupRouletteRoomStateResponse & {
  /** ホスト操作用 token。作成レスポンスでのみ返す。 */
  hostToken: string;
}

export type GroupRouletteRoomStatus = 'waiting' | 'spinning' | 'stopping' | 'result' | 'expired'

export type GroupRouletteMember = {
  id: string;
  displayName: string;
  role: 'host' | 'guest';
}

export type GroupRouletteOption = {
  id: string;
  label: string;
  order: number;
  addedByMemberId?: string | undefined;
}

export type GroupRouletteSpin = {
  id: string;
  startedAt?: string | undefined;
  durationMs?: number | undefined;
  options: GroupRouletteOption[];
  winnerOptionId?: string | undefined;
  stopAt?: string | undefined;
}

export type GroupRouletteRoomStatePayload = {
  status: GroupRouletteRoomStatus;
  expiresAt: string;
  guestAddEnabled: boolean;
  activeOptions: GroupRouletteOption[];

  currentSpin: GroupRouletteSpin | null;

  member?: GroupRouletteMember | undefined;
}

export type GroupRouletteRoomStateResponse = {
  protocolVersion: number;
  tool: string;
  type: 'roomState' | 'roomExpired';
  roomId: string;

  requestId?: string | null | undefined;

  revision: number;
  serverTime: string;
  payload: GroupRouletteRoomStatePayload;
}

export type GroupRouletteMutationRequest = {
  requestId: string;
  memberId: string;
}

export type GroupRouletteHostMutationRequest = GroupRouletteMutationRequest & {
  hostToken: string;
}

export type GroupRouletteJoinRoomRequest = {
  requestId: string;
  memberId?: string | undefined;
  displayName?: string | undefined;
  hostToken?: string | undefined;
}

export type GroupRouletteAddOptionRequest = GroupRouletteMutationRequest & {
  label: string;
  hostToken?: string | undefined;
}

export type GroupRouletteSetGuestAddEnabledRequest = GroupRouletteHostMutationRequest & {
  enabled: boolean;
}
