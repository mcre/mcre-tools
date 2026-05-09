# グループルーレット実装状況

## 使い方

- 実装を始める前に「現在の状態」と「次にやること」を確認する。
- 実装が一区切りついたら、このファイルを更新する。
- 詳細な仕様は [group-roulette-plan.md](./group-roulette-plan.md) を正とし、このファイルは進捗、作業メモ、残タスクの記録に使う。

## 現在の状態

- 2026-05-08 時点で、MVP 方針を WebSocket first から polling first に転換済み。
- グループルーレットの MVP は REST 操作 API + `GET roomState` polling + Lambda + DynamoDB で実装済み。
- `POST /v1/group-roulette/rooms` は部屋作成と host member 作成を同一操作で行い、作成時点で表示名 `ホスト` の host として入室済みにする。
- `GroupRouletteRoom|{roomId}` を canonical state とし、候補追加、削除、ゲスト追加許可、開始、停止、期限切れ、hostToken 権限、revision、冪等性をサーバー側で扱う。
- `/ja/group-roulette` と `/en/group-roulette` の SSG ページ、状態管理 composable、ルーティング、i18n、アイコンを追加済み。
- フロントエンドは操作成功後に即時 `roomState` refetch し、通常時は状態別 interval で polling する。将来通知層は revision hint から refetch する構造で後付けできる。
- 旧 WebSocket Lambda source、CDK WebSocket API、`VITE_REALTIME_WS_URL` output は MVP から削除済み。
- dev 環境も CDK と API/OGP Lambda を更新済み。dev API smoke test で room 作成、host 入室、候補追加、開始、停止、`stopAt` 後の `result` 遷移まで確認済み。
- query-specific OGP は `jukugo` のみに限定し、グループルーレットの room URL は `noindex` にする。
- 計画書は `docs/group-roulette-plan.md`、DynamoDB 設計は `DB.md` を正とする。

## 決定済み事項

- ツール ID は `group-roulette`。
- URL は `/ja/group-roulette` と `/en/group-roulette`。
- 現方針の同期方式は REST 操作 API + `GET roomState` polling + Lambda + DynamoDB。
- 旧方針の同期方式は API Gateway WebSocket + Lambda + DynamoDB。WebSocket 独自ドメインは dev `tools-ws-dev.mcre.info`、prod `tools-ws.mcre.info` とする案だったが、現在の MVP からは削除済み。
- room/state データは `DB.md` に従い、既存 primary table に `id` prefix、`search_key_1`、`order`、`ttl` を追加して保存する。
- `GroupRouletteRoom|{roomId}` を正の room state とし、GSI は監査と補助一覧に限定する。
- polling 間隔は waiting で 2-5 秒、spinning/stopping で 1 秒、操作直後は即時 refetch、background tab は低頻度または停止を基本にする。
- 将来 AppSync Events または API Gateway WebSocket を追加する場合も、状態の正本にはせず、`revision` 変更を知らせる refetch trigger として扱う。
- ホストだけがルーレットの開始・停止を操作できる。
- ゲスト名は任意。未入力時は自動表示名を割り当てる。
- ホストが許可している間、ゲストは候補を即時追加できる。
- `startSpin` 時点で候補 ID と表示順を固定する。
- スピン中の候補追加・削除は拒否し、次回にも持ち越さない。
- 次の縦串まで、ゲスト表示名の重複は許可する。
- 生履歴は 90 日保存し、TTL で削除する。
- 長期保存は自由入力を含まない日次集計だけにする。
- query-specific OGP は `jukugo` のみに限定し、グループルーレットの room URL は `noindex` にする。

## 作業チェックリスト

- [x] 計画書を最終確認する。
- [x] polling first の失敗するテストを追加する。
- [x] REST room/state API と polling client への再設計を実装する。
- [x] 既存 WebSocket 実装を MVP から削除または未使用化する。
- [x] polling のみの build 後 preview と E2E で確認する。
- [x] 旧 WebSocket 方針で失敗するテストを追加する。
- [x] 旧 WebSocket 方針で CDK に WebSocket API と primary table の TTL/GSI 拡張テストを追加する。
- [x] Lambda に primary table の record prefix、`search_key_1`、`order`、`ttl` のテストを追加する。
- [x] Lambda に `GroupRouletteRoom` canonical state と条件付き更新/transaction のテストを追加する。
- [x] 旧 WebSocket 方針で Lambda の realtime handler テストを追加する。
- [x] フロントエンドの状態管理テストを追加する。
- [x] 旧 WebSocket 方針で CDK 実装を追加する。
- [x] 旧 WebSocket 方針で Lambda realtime 基盤を追加する。
- [x] 旧 WebSocket 方針でグループルーレット REST API と WebSocket handler を追加する。
- [x] 既存 navigation drawer を複数ツール対応へ修正する。
- [x] `group-roulette` ページ、composable、ルーティング、i18n、画像を追加する。
- [x] query-specific OGP を `jukugo` のみに opt-in する。
- [x] build 後 preview と E2E で確認する。

## 次にやること

1. レート制限、event 上限、日次集計の最小設計を切り出す。
2. 管理者向けの生履歴確認手段を AWS コンソール前提にするか、管理画面を作るか決める。
3. 将来通知層を追加する場合に AppSync Events と API Gateway WebSocket のどちらを採用するか、利用状況を見て判断する。

## 未決事項

- 管理者が 90 日以内の生履歴を見る手段を、当面 AWS コンソール前提にするか、管理画面を別途作るか。
- ゲスト表示名の重複は MVP では許可済み。将来番号付けに変えるかは未決。

## 作業ログ

- 2026-05-07: 実装状況ファイルを作成。
- 2026-05-08: CDK に WebSocket API、Realtime Lambda の器、WebSocket 独自ドメイン、primary table TTL/GSI、`VITE_REALTIME_WS_URL` output を追加。`npm run cdk:test`、`npm run cdk:synth:dev`、`npm run cdk:synth:prod` で確認。
- 2026-05-08: Lambda に Realtime 永続化基盤の `repository.py` と deploy 可能な `main.py` を追加。`GroupRouletteRoom`、member、connection、option、event、request の key/item と `add_option` transaction を unittest で固定。`npm run lambda:test`、`npm run cdk:test` で確認。
- 2026-05-08: `POST /v1/group-roulette/rooms` を追加。`roomId` と `hostToken` を生成し、`hostToken` は SHA-256 hash のみ DynamoDB に保存する。OpenAPI/aspida と API Lambda package の `realtime/repository.py` 同梱を更新。
- 2026-05-08: 最小リアルタイム縦串を追加。`joinRoom`、`addOption`、`startSpin`、`stopSpin`、broadcast、GoneException cleanup、hostToken fragment/sessionStorage、room URL noindex、`group-roulette` SSG ページ、i18n、アイコン、mocked preview E2E を実装。`npm run lambda:test`、`npm run test:unit`、`npm run type-check`、`npm run build`、`npm run e2e`、`npm run lint`、`npm run format:check` で確認。
- 2026-05-08: dev 環境へ CDK と API/realtime/OGP Lambda をデプロイ。node/SSG の S3 配布は行わず、API/CDK/Lambda の実疎通だけ確認。dev WebSocket smoke test で room 作成、host join、候補追加 broadcast、`startSpin`、`stopSpin`、winner 確定まで確認。実疎通で見つかった Realtime Lambda の DynamoDB `ConditionCheckItem` 権限、DynamoDB `Decimal` JSON serialization、custom domain の `@connections` endpoint を修正済み。
- 2026-05-08: API Gateway WebSocket、AppSync Events、polling を比較し、MVP では polling first に方針転換。WebSocket/AppSync は将来の通知層として、状態の正本ではなく `roomState` refetch trigger に限定する方針に変更。
- 2026-05-08: polling first に再設計。REST の `getRoomState`、`joinRoom`、`addOption`、`removeOption`、`setGuestAddEnabled`、`startSpin`、`stopSpin` を追加し、frontend は WebSocket 接続ではなく `roomState` polling と操作直後 refetch に差し替えた。旧 WebSocket Lambda source、CDK WebSocket API、`VITE_REALTIME_WS_URL` output は MVP から削除。`npm run lambda:test`、`npm run cdk:test`、`npm run test:unit`、`npm run type-check`、`npm run build`、`npm run e2e`、`npm run lint` で確認。
- 2026-05-08: dev 環境へ polling first 版をデプロイ。cross-region export 削除順の都合で `us-east-1` stack から旧 realtime import を先に外し、`ap-northeast-1` stack の rollback を復旧してから `npm run cdk:deploy:dev -- --require-approval never` と `npm run lambda:deploy:dev` を実行。dev API smoke test で room 作成、host 入室、候補追加、開始、停止、`stopAt` 後の `result` 遷移まで確認。
- 2026-05-10: `createRoom` を room 作成のみから「room 作成 + host member 作成」へ変更。作成レスポンスは `roomState` envelope に統一し、作成時だけ top-level `hostToken` を返す。フロントは `createRoom()` 後の別 `joinRoom("")` をやめ、作成直後から `ホスト` として入室済みにする。
