# グループルーレット実装状況

## 使い方

- 実装を始める前に「現在の状態」と「次にやること」を確認する。
- 実装が一区切りついたら、このファイルを更新する。
- 詳細な仕様は [group-roulette-plan.md](./group-roulette-plan.md) を正とし、このファイルは進捗、作業メモ、残タスクの記録に使う。

## 現在の状態

- 仕様検討中。
- 実装コードはまだ追加していない。
- 計画書は `docs/group-roulette-plan.md` に作成済み。
- WebSocket はグループルーレット専用ではなく、今後のグループ系ツールでも使えるリアルタイム同期基盤として設計する方針。

## 決定済み事項

- ツール ID は `group-roulette`。
- URL は `/ja/group-roulette` と `/en/group-roulette`。
- 同期方式は API Gateway WebSocket + Lambda + DynamoDB。
- リアルタイム同期用に専用 DynamoDB table を作る。
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
- [ ] 失敗するテストを追加する。
- [ ] CDK に WebSocket API と専用 DynamoDB table のテストを追加する。
- [ ] Lambda の realtime handler テストを追加する。
- [ ] フロントエンドの状態管理テストを追加する。
- [ ] CDK 実装を追加する。
- [ ] Lambda realtime 基盤を追加する。
- [ ] グループルーレット REST API と WebSocket handler を追加する。
- [ ] 既存 navigation drawer を複数ツール対応へ修正する。
- [ ] `group-roulette` ページ、composable、ルーティング、i18n、画像を追加する。
- [ ] query-specific OGP を `jukugo` のみに opt-in する。
- [ ] build 後 preview と E2E で確認する。

## 次にやること

1. `docs/group-roulette-plan.md` の未決事項を確認する。
2. TDD 方針に従い、まず CDK / Lambda / frontend の失敗テストを追加する。
3. WebSocket 基盤の最小リソースから実装を始める。

## 未決事項

- WebSocket API の独自ドメイン名。
- 管理者が 90 日以内の生履歴を見る手段を、当面 AWS コンソール前提にするか、管理画面を別途作るか。
- ゲスト表示名の重複時に番号を付けるか、そのまま許可するか。

## 作業ログ

- 2026-05-07: 実装状況ファイルを作成。
