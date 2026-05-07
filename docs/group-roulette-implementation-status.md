# グループルーレット実装状況

## 使い方

- 実装を始める前に「現在の状態」と「次にやること」を確認する。
- 実装が一区切りついたら、このファイルを更新する。
- 詳細な仕様は [group-roulette-plan.md](./group-roulette-plan.md) を正とし、このファイルは進捗、作業メモ、残タスクの記録に使う。

## 現在の状態

- CDK リアルタイム基盤の実装を開始済み。
- Lambda Realtime 永続化基盤の最小構成を実装済み。
- 計画書は `docs/group-roulette-plan.md` に作成済み。
- WebSocket はグループルーレット専用ではなく、今後のグループ系ツールでも使えるリアルタイム同期基盤として設計する方針。
- DynamoDB 設計は `DB.md` を正とし、既存 primary table を拡張する方針。

## 決定済み事項

- ツール ID は `group-roulette`。
- URL は `/ja/group-roulette` と `/en/group-roulette`。
- 同期方式は API Gateway WebSocket + Lambda + DynamoDB。
- WebSocket 独自ドメインは dev `tools-ws-dev.mcre.info`、prod `tools-ws.mcre.info`。
- リアルタイム同期用データは `DB.md` に従い、既存 primary table に `id` prefix、`search_key_1`、`order`、`ttl` を追加して保存する。
- `GroupRouletteRoom|{roomId}` を正の room state とし、GSI は監査、補助一覧、broadcast 対象取得に限定する。
- ホストだけがルーレットの開始・停止を操作できる。
- ゲスト名は任意。未入力時は自動表示名を割り当てる。
- ホストが許可している間、ゲストは候補を即時追加できる。
- `startSpin` 時点で候補 ID と表示順を固定する。
- スピン中の候補追加・削除は拒否し、次回にも持ち越さない。
- 生履歴は 90 日保存し、TTL で削除する。
- 長期保存は自由入力を含まない日次集計だけにする。
- query-specific OGP は `jukugo` のみに限定し、グループルーレットの room URL は `noindex` にする。

## 作業チェックリスト

- [ ] 計画書を最終確認する。
- [x] 失敗するテストを追加する。
- [x] CDK に WebSocket API と primary table の TTL/GSI 拡張テストを追加する。
- [x] Lambda に primary table の record prefix、`search_key_1`、`order`、`ttl` のテストを追加する。
- [x] Lambda に `GroupRouletteRoom` canonical state と条件付き更新/transaction のテストを追加する。
- [x] Lambda の realtime handler テストを追加する。
- [ ] フロントエンドの状態管理テストを追加する。
- [x] CDK 実装を追加する。
- [x] Lambda realtime 基盤を追加する。
- [ ] グループルーレット REST API と WebSocket handler を追加する。
- [ ] 既存 navigation drawer を複数ツール対応へ修正する。
- [ ] `group-roulette` ページ、composable、ルーティング、i18n、画像を追加する。
- [ ] query-specific OGP を `jukugo` のみに opt-in する。
- [ ] build 後 preview と E2E で確認する。

## 次にやること

1. グループルーレットの REST room 作成 API の失敗テストを追加する。
2. Realtime Lambda の `joinRoom` handler/repository の失敗テストを追加する。
3. `addOption` WebSocket handler と broadcast 対象取得の失敗テストを追加する。

## 未決事項

- 管理者が 90 日以内の生履歴を見る手段を、当面 AWS コンソール前提にするか、管理画面を別途作るか。
- ゲスト表示名の重複時に番号を付けるか、そのまま許可するか。

## 作業ログ

- 2026-05-07: 実装状況ファイルを作成。
- 2026-05-08: CDK に WebSocket API、Realtime Lambda の器、WebSocket 独自ドメイン、primary table TTL/GSI、`VITE_REALTIME_WS_URL` output を追加。`npm run cdk:test`、`npm run cdk:synth:dev`、`npm run cdk:synth:prod` で確認。
- 2026-05-08: Lambda に Realtime 永続化基盤の `repository.py` と deploy 可能な `main.py` を追加。`GroupRouletteRoom`、member、connection、option、event、request の key/item と `add_option` transaction を unittest で固定。`npm run lambda:test`、`npm run cdk:test` で確認。
