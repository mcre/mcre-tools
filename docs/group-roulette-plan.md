# グループルーレット実装計画

## 目的

複数人が同じ部屋 URL を開き、ホストの開始・停止操作に合わせて全員の画面で同じルーレットが同じタイミングで動くツールを追加する。

画面上の絵文字リアクションやチャットではなく、現実側で同時に盛り上がれるようにすることを主目的にする。

## MVP 仕様

- ツール ID は `group-roulette`、URL は `/ja/group-roulette` と `/en/group-roulette` にする。
- ホストは部屋を作成し、ゲスト用 URL を共有できる。
- ゲスト用 URL には `roomId` だけを含める。
- ホスト権限は `hostToken` で管理するが、query string には入れない。初期実装では URL fragment と `sessionStorage` を使い、共有・言語切替・OGP・canonical には `hostToken` を含めない。
- ゲスト名は任意にする。未入力の場合はサーバー側で `ゲスト1` のような表示名を割り当てる。
- ホストが候補追加を許可している間、ゲストは候補を即時追加できる。
- 候補追加は即時に同じ部屋の全クライアントへ反映する。
- ルーレット開始と停止はホストだけが実行できる。
- `startSpin` 時点でサーバーが候補 ID と表示順のスナップショットを固定する。
- スピン中の候補追加・削除は受け付けない。キューにも入れず、次回以降にも反映しない。
- 停止時はサーバーが固定済みスナップショットから当選候補を決め、全クライアントへ同じ結果と停止予定時刻を配信する。
- 当たった候補は次回以降も残す。
- ユーザー目線の部屋有効期限は作成から 24 時間にする。
- 候補名、表示名、抽選履歴などの生履歴は管理者確認用として 90 日保存し、その後 TTL で削除する。
- 長期保存は自由入力を含まない集計値だけにする。
- 自由入力が保存されることを、ツール画面または利用規約文言で明示する。
- MVP では絵文字リアクション、チャット、参加者同士の個別DM、ログイン、公開ランキングを作らない。

## 画面状態

グループルーレットの画面は次の状態で管理する。

- `idle`: 部屋未作成、または部屋 URL 未指定。
- `waiting`: 入室済みで、候補編集と開始待ちができる。
- `spinning`: ホストが開始済み。候補追加・削除は全員不可。
- `stopping`: 停止予定時刻を受け取り、全端末が結果へ向けて着地中。
- `result`: 当選結果を表示中。ホストは次の抽選を開始できる。
- `expired`: ユーザー向け有効期限切れ。再接続や操作は不可。

`spinStarted` には `spinId`、`revision`、`startedAt`、`durationMs`、候補スナップショットを含める。`spinStopped` には `spinId`、`revision`、`stopAt`、当選候補 ID、サーバー時刻を含める。

## 再利用可能な WebSocket 基盤

WebSocket はグループルーレット専用にせず、今後のグループくじ、グループサイコロ、グループタイマー、グループストップウォッチでも使える「リアルタイム同期基盤」として設計する。

### 基本方針

- CDK に API Gateway WebSocket API を追加する。
- フロントエンドには `VITE_REALTIME_WS_URL` を CDK output から渡す。
- WebSocket Lambda は共通の接続管理、部屋参加、broadcast を担当する。
- ツール固有の状態遷移は `tool` と `type` で振り分ける。
- 既存 REST API は部屋作成や初期データ取得に使い、リアルタイム操作は WebSocket に寄せる。
- 接続が切れて再接続したクライアントは、部屋 ID で現在の `roomState` を再取得できるようにする。
- メッセージはサーバー権威にする。クライアントは意図を送り、状態変更、当選結果、revision はサーバーが決める。
- `requestId` は冪等処理と ack/error の対応付けに使う。
- broadcast に失敗した connection は削除する。
- `$connect` では部屋参加を完了させず、接続後の `joinRoom` で room/member を紐付ける。

### メッセージ形式

クライアントから送る WebSocket メッセージは、ツール共通の envelope にする。

```json
{
  "protocolVersion": 1,
  "tool": "group-roulette",
  "type": "joinRoom",
  "roomId": "room_abc123",
  "requestId": "client_generated_id",
  "payload": {}
}
```

サーバーから返すメッセージも同じく共通 envelope にする。

```json
{
  "protocolVersion": 1,
  "tool": "group-roulette",
  "type": "roomState",
  "roomId": "room_abc123",
  "revision": 1,
  "serverTime": "2026-05-07T00:00:00.000Z",
  "payload": {}
}
```

### 共通イベント

- `joinRoom`: 部屋に参加する。
- `leaveRoom`: 明示的に部屋から抜ける。
- `roomState`: 現在の部屋状態を返す。
- `roomExpired`: 部屋がユーザー向け有効期限を過ぎていることを通知する。
- `error`: 入力不正、権限不足、期限切れなどを通知する。

### グループルーレット固有イベント

- `setGuestAddEnabled`: ホストがゲストの候補追加可否を切り替える。
- `addOption`: 候補を追加する。
- `removeOption`: ホストが候補を削除する。
- `startSpin`: ホストがルーレット開始を通知する。
- `stopSpin`: ホストがルーレット停止を要求する。
- `optionAdded`: 候補追加結果を全員へ通知する。
- `optionRemoved`: 候補削除結果を全員へ通知する。
- `spinStarted`: 開始時刻と回転 ID を全員へ通知する。
- `spinStopped`: 当選候補、停止予定時刻、回転 ID を全員へ通知する。

## データ保存方針

DynamoDB 設計はルートの `DB.md` を正とする。グループルーレットも既存 primary table 1 つを使い、PK は `id` 文字列のみ、SK は持たない。

### Table

- table: `{prefix}-primary`
- partition key: `id`
- sort key: なし
- GSI: `search_key_1-order-index`
- TTL attribute: `ttl`

`search_key_1-order-index` は部屋内の connection、member、option、event を一覧取得するために使う。GSI を追加する場合は `DB.md` にもインデックスと取得パターンを追記する。

GSI は結果整合なので、room state の正、権限判定、抽選スナップショット作成には使わない。正とする状態は `GroupRouletteRoom|{roomId}` に持たせる。GSI Query は監査、補助一覧、broadcast 対象 connection の取得に限定し、broadcast は best-effort とする。

### 主な item

- `GroupRouletteRoom|{roomId}`
  - 部屋メタデータ、状態、有効期限、hostToken hash、revision、候補の canonical snapshot、現在の spin snapshot。
  - `order`: 作成時刻。
  - `ttl`: 生データ削除時刻。
  - `active_options`: 現在有効な候補の canonical list。抽選開始時はこの値から snapshot を作る。
  - `option_sequence`: 候補 ID と表示順の採番。
  - `guest_sequence`: 未入力ゲスト名の採番。
- `GroupRouletteMember|{roomId}|{memberId}`
  - 表示名、権限、接続状態。
  - `search_key_1`: `GroupRouletteMember|room_id={roomId}`
  - `order`: 作成時刻または入室順。
  - `ttl`: 生データ削除時刻。
- `RealtimeConnection|{connectionId}`
  - tool、roomId、memberId、接続情報、最終接続時刻。
  - `search_key_1`: `RealtimeConnection|tool=group-roulette|room_id={roomId}`
  - `order`: 接続時刻または最終更新時刻。
  - `ttl`: connection cleanup 用の削除時刻。部屋の生データ保存期限より短くしてよい。
- `GroupRouletteOption|{roomId}|{optionId}`
  - 候補名、追加者、削除状態。
  - `search_key_1`: `GroupRouletteOption|room_id={roomId}`
  - `order`: 表示順。
  - `ttl`: 生データ削除時刻。
- `GroupRouletteEvent|{roomId}|{eventId}`
  - 候補追加、開始、停止などの生履歴。
  - `search_key_1`: `GroupRouletteEvent|room_id={roomId}`
  - `order`: 発生時刻。
  - `ttl`: 生データ削除時刻。
- `GroupRouletteDailyStat|{yyyy-mm-dd}`
  - 自由入力を含まない長期集計。
  - 長期保存対象なので、初期実装では `ttl` を設定しない。
- `RealtimeRequest|{roomId}|{requestId}`
  - WebSocket 操作の冪等性確認。
  - `ttl`: 短期削除時刻。

ユーザー目線の 24 時間期限は DB の `expires_at` で判定する。API や WebSocket payload では必要に応じて `expiresAt` として返す。部屋、connection、生 event は 90 日後の `ttl` を設定して削除する。

ホストトークンは平文保存しない。サーバー側では HMAC などで hash 化して保存し、操作時に照合する。`hostToken`、候補名、表示名、URL 全体はログに出さない。

### 更新と整合性

- `addOption`, `removeOption`, `startSpin`, `stopSpin` は条件付き更新または `TransactWriteItems` で処理する。
- すべての操作で `expires_at`、room `status`、host 権限、`revision` を条件に入れる。
- `addOption` は `GroupRouletteRoom.active_options` と `option_sequence` を更新し、同じ transaction で `GroupRouletteOption`、`GroupRouletteEvent`、`RealtimeRequest` を書き込む。
- `removeOption` は `GroupRouletteRoom.active_options` から対象候補を外し、同じ transaction で option の削除状態、event、request を更新する。
- `startSpin` は `GroupRouletteRoom.active_options` から候補 ID と表示順の snapshot を作り、GSI Query の結果から snapshot を作らない。
- `stopSpin` は `GroupRouletteRoom.current_spin` を正として当選候補を確定する。
- broadcast 対象 connection の GSI 反映遅延は許容する。クライアントは `revision` の欠落を検知した場合に `roomState` を再取得する。

### 長期集計

長期保存する集計には自由入力を含めない。日次で次のような値を保存する。

- 作成された部屋数。
- 有効期限切れになった部屋数。
- 参加 member 数と最大同時接続数。
- 候補追加数、削除数、最大候補数、平均候補数。
- 抽選開始数、抽選停止数、結果表示まで完了した抽選数。
- ゲスト候補追加許可の切り替え回数。
- バリデーションエラー数、権限不足エラー数、レート制限エラー数、期限切れアクセス数。
- 部屋作成から初回抽選までの平均時間。
- 部屋ごとの抽選回数の分布。

## SEO / OGP 方針

- `/ja/group-roulette` と `/en/group-roulette` は通常のツールページとして index 可能にする。
- `roomId` 付き URL は private-ish な共有 URL として扱い、`noindex` にする。
- canonical は query や fragment を除いた `/ja/group-roulette` または `/en/group-roulette` に寄せる。
- query-specific OGP は `jukugo` のみに限定する。グループルーレットでは room URL から専用 OGP 画像を生成しない。
- 共有ボタンはゲスト用 URL だけを共有する。`hostToken`、fragment、内部状態は共有 URL に含めない。
- 静的 HTML は WebSocket 接続なしでもツール説明と部屋作成導線が表示されるようにし、WebSocket 接続は `onMounted` 以降に行う。

query-specific OGP を制限する理由: 既存の `jukugo` は query に入力状態を持ち、その URL に合わせた OGP 画像を bot 向けに返す。これを room URL にも適用すると、`roomId` や誤って含まれた `hostToken` が OGP URL、画像生成リクエスト、bot 用 HTML、ログ、SNS のプレビュー取得経路に露出する可能性がある。グループルーレットの room URL は共有相手以外に広げたい情報ではないため、query-specific OGP の対象にしない。

## 入力・上限・濫用対策

- `roomId` は推測困難なランダム値にする。
- 1 部屋の同時接続は 50 まで。
- 候補数は 100 件まで。
- 候補名は 80 文字まで。
- 表示名は 40 文字まで。
- 1 部屋の event は 1000 件まで。
- WebSocket payload は 2KB まで。
- 部屋作成、候補追加、開始、停止には短いクールダウンまたは rate limit を入れる。
- 入力値は trim、Unicode 正規化、制御文字除去を行う。
- 表示は Vue の通常バインディングを使い、候補名や表示名に `v-html` を使わない。

## 実装ステップ

1. ドキュメントと仕様を確定する。
2. 失敗するテストを先に追加する。
3. CDK に再利用可能な WebSocket API、Lambda、IAM、primary table の TTL/GSI、Vite env output を追加する。
4. Lambda 共通リアルタイム基盤を追加する。
5. グループルーレット用の REST ルーム作成 API と WebSocket handler を追加する。
6. 既存 navigation drawer を、複数ツールでも drawer が 1 つだけになる構造へ修正する。
7. フロントエンドに `group-roulette` ページ、composable、ルーティング、i18n、ツール一覧表示を追加する。
8. query-specific OGP を `jukugo` のみに opt-in する。
9. build 後 preview と E2E で SSG 成果物の表示を確認する。

## テスト方針

- Vitest でルーレット状態、候補追加、ホスト権限、期限切れ表示、停止結果の反映を検証する。
- Vitest で `startSpin` 時点の候補スナップショット固定、スピン中の候補変更拒否、`hostToken` 非共有を検証する。
- Python unittest で WebSocket handler の `joinRoom`、`addOption`、`startSpin`、`stopSpin`、権限不足、期限切れ、同時停止、再接続 snapshot、GoneException cleanup を検証する。
- CDK unittest で WebSocket API、route、stage、Lambda、IAM 権限、primary table の TTL/GSI、`VITE_REALTIME_WS_URL` output、deploy target を検証する。
- Python unittest で primary table の record prefix、`search_key_1`、`order`、`ttl` の設定を検証する。
- Playwright SSG preview でトップページのツール一覧、`group-roulette` ページ、メタデータ、主要レイアウトを確認する。
- Playwright で 2 つの browser context を使い、ホスト/ゲスト同期、候補追加の即時反映、同じ `spinId` の結果表示、再接続、期限切れ、モバイル幅、hostToken 非漏洩、room URL の noindex を確認する。
- 既存の `npm run build` と `npm run preview` を最終確認に使う。

## 未決事項

- WebSocket API の独自ドメイン名。
- 管理者が生履歴を見るための手段を、当面 AWS コンソール前提にするか、管理画面を別途作るか。
- ゲスト表示名の重複時に番号を付けるか、そのまま許可するか。
