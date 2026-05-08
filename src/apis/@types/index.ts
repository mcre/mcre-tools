/* eslint-disable */
export type JukugoSearchResponse = {
  /** 熟語の反対側の文字 */
  character: string;
  /** 熟語生成コスト */
  cost: number;
}[]

export type GroupRouletteCreateRoomResponse = {
  /** 部屋 ID */
  roomId: string;
  /** ホスト操作用 token。作成レスポンスでのみ返す。 */
  hostToken: string;
  /** 部屋のユーザー向け有効期限 */
  expiresAt: string;
}
