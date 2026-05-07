# DynamoDB 設計

このドキュメントは `mcre-tools` の DynamoDB 設計をまとめる。現行の主な用途は熟語パズル用の熟語辞書検索である。

## 方針

- DynamoDB のテーブルは CDK の primary テーブル 1 つだけにする。
- テーブル名は `{prefix}-primary` とする。
  - dev: `mcre-tools-dev-primary`
  - prod: `mcre-tools-primary`
- PK は `id` 文字列のみとし、SK は持たない。
- GSI は現状作成しない。
- テーブルは pay-per-request で運用する。
- レコードの `id` には用途を表す prefix を付ける。
- 現行 API 実装は `backend/lambda/src` 配下だけを正とする。

## 将来拡張時に取り込む設計パターン

レコード種別、`search_key_n`、`order`、GSI、TTL などを追加して単一テーブル設計を拡張する場合は、次のパターンを使う。

- `id` は `{RecordType}|{publicId}` 形式を基本にし、DynamoDB 内部でレコード種別が分かる prefix を付ける。
- API レスポンスでは、必要に応じて prefix を除いた public ID を返す。
- `search_key_n` にも検索対象を表す prefix を付ける。
- 一覧取得やフィルタには `search_key_n-order-index` を使う。
- `order` は一覧・集計順に使う数値にし、基本的には Unix 秒の時刻または表示順を入れる。
- `created_at`, `updated_at` は Unix 秒の整数で扱う。
- 一時レコードや期限付き生データには `ttl` を持たせる。ただし TTL は物理削除の補助であり、ユーザー向け期限判定は `expires_at` などの明示フィールドで行う。
- 長期保存する集計レコードには自由入力を含めない。
- 共有状態やスナップショットは、後続更新の可否を決め、必要なら条件付き put/update で不変性や冪等性を守る。

Lambda 実装では次の配置・責務分担を基本にする。

- `backend/lambda/src` 配下を現行 Lambda 実装の正とする。
- `backend/lambda/src/util.py` に API Gateway イベント解析、JSON レスポンス、DynamoDB/S3 の薄い共通処理を置く。
- `backend/lambda/src/api/main.py` は REST API の entrypoint とルート定義に寄せる。
- 機能が大きくなる場合は、handler、repository、presenter などの責務を分け、ルート定義に個別処理を散らさない。
- DynamoDB の key 生成、prefix 除去、条件付き更新、transaction は repository 層に閉じ込める。

## インデックス

| 名前          | PK   | SK  | 用途                     |
| ------------- | ---- | --- | ------------------------ |
| primary table | `id` | なし | 熟語辞書レコードの直接取得 |

現状は一覧取得や複合条件検索がないため、GSI は持たない。将来、一覧・集計・フィルタが必要になった場合は、参照先プロジェクトと同様に `search_key_n` と `order` を追加し、`search_key_n-order-index` 形式の GSI を検討する。

GSI は結果整合であるため、ユーザー操作の正当性判定や抽選結果の決定には使わない。正とする状態は `GetItem` または条件付き更新で扱える単一 item に持たせ、GSI は一覧表示、監査、broadcast 対象取得などの補助用途に限定する。

## レコード種別

- `JukugoSearch`
  - 熟語パズルで、片側の漢字から反対側の漢字候補を検索するための辞書レコード。

## JukugoSearch

- `id`
  - `jukugo|left|{left_kanji}`
  - `jukugo|right|{right_kanji}`
- `pairs`
  - 反対側の漢字候補リスト。
  - 各要素は `character` と `cost` を持つ。

`pairs` の例:

```json
[
  {
    "character": "学",
    "cost": 1234
  },
  {
    "character": "作",
    "cost": 2345
  }
]
```

`character` は検索した漢字の反対側に置ける漢字を表す。`cost` は mozc 辞書由来の熟語生成コストで、値が小さいほど優先度が高い候補として扱う。

## 取得パターン

- 熟語の左側の文字を検索
  - API: `GET /v1/jukugo/{character}/left-search`
  - 固定されている文字: 右側の文字
  - DynamoDB key: `id = jukugo|right|{character}`
  - DynamoDB operation: `GetItem`
  - レスポンス: item が存在する場合は `pairs`、存在しない場合は `[]`
- 熟語の右側の文字を検索
  - API: `GET /v1/jukugo/{character}/right-search`
  - 固定されている文字: 左側の文字
  - DynamoDB key: `id = jukugo|left|{character}`
  - DynamoDB operation: `GetItem`
  - レスポンス: item が存在する場合は `pairs`、存在しない場合は `[]`

Lambda 側では `backend/lambda/src/api/main.py` が API ルーティングを持ち、`backend/lambda/src/util.py` の `get_db_item` で `id` を指定して取得する。

## データ投入・削除

熟語辞書データは `tools/jukugo` 配下のスクリプトで作成・投入する。

```bash
cd tools/jukugo
python 01_download.py
python 02_convert.py
python 03_seed.py <aws_profile> <table_name>
```

- `01_download.py`
  - mozc の open source dictionary を取得する。
- `02_convert.py`
  - 2 文字の熟語と cost を抽出し、`work/dict.csv` を生成する。
- `03_seed.py`
  - `work/dict.csv` から `jukugo|left|...` と `jukugo|right|...` のレコードを作成し、DynamoDB に投入する。

削除は `tools/jukugo/delete_records.py` を使う。

```bash
cd tools/jukugo
python delete_records.py <aws_profile> <table_name>
```

このスクリプトは `id` が `jukugo|` で始まるレコードを Scan で探して削除する。GSI を持たない現行設計では運用用の一括削除として扱い、API の通常処理では Scan に依存しない。

## GroupRoulette（計画中）

グループルーレットを追加する場合も primary table 1 つを使う。`search_key_1-order-index` と TTL を追加する場合は、この節の取得パターンと CDK のテーブル定義を同時に更新する。

### 方針

- `GroupRouletteRoom|{roomId}` を room の canonical state とする。
- 抽選スナップショット、候補の表示順、候補の有効/削除状態、`revision`、各種 sequence は `GroupRouletteRoom` に持たせる。
- `GroupRouletteOption`、`GroupRouletteEvent`、`RealtimeConnection` は履歴、監査、broadcast、補助一覧に使う。
- `startSpin` の候補スナップショットは `GroupRouletteRoom` から作る。`GroupRouletteOption` の GSI Query 結果から作らない。
- `joinRoom` 直後の connection が GSI に反映される前に broadcast から漏れる可能性は許容し、クライアントは `revision` の欠落を検知したら `roomState` を再取得する。
- `expires_at` はすべての操作で明示的に判定する。TTL は 90 日後の物理削除補助であり、ユーザー向け期限判定には使わない。
- タイマーやストップウォッチのような高頻度 tick は永続化しない。必要な場合は開始時刻、基準時刻、状態だけを保存し、各クライアントで表示を補間する。

### レコード種別

- `GroupRouletteRoom`
  - `id`: `GroupRouletteRoom|{roomId}`
  - `order`: 作成時刻
  - `created_at`, `updated_at`: Unix 秒
  - `expires_at`: ユーザー向け 24 時間期限
  - `ttl`: 生データ削除時刻
  - `host_token_hash`: hostToken の HMAC などの hash
  - `status`: `waiting` / `spinning` / `stopping` / `result` / `expired`
  - `revision`: room state の単調増加 revision
  - `guest_add_enabled`: ゲスト候補追加可否
  - `guest_sequence`: 未入力ゲスト名の採番
  - `option_sequence`: 候補 ID と表示順の採番
  - `active_options`: 現在有効な候補のスナップショット。`{ id, label, order, added_by_member_id }[]`
  - `current_spin`: 現在の spin snapshot。未開始時は `null`
- `GroupRouletteMember`
  - `id`: `GroupRouletteMember|{roomId}|{memberId}`
  - `search_key_1`: `GroupRouletteMember|room_id={roomId}`
  - `order`: 作成時刻または入室順
  - `ttl`: 生データ削除時刻
  - `display_name`, `role`, `connected`
- `RealtimeConnection`
  - `id`: `RealtimeConnection|{connectionId}`
  - `search_key_1`: `RealtimeConnection|tool=group-roulette|room_id={roomId}`
  - `order`: 接続時刻または最終更新時刻
  - `ttl`: connection cleanup 用の削除時刻
  - `tool`, `room_id`, `member_id`, `connected_at`, `last_seen_at`
- `GroupRouletteOption`
  - `id`: `GroupRouletteOption|{roomId}|{optionId}`
  - `search_key_1`: `GroupRouletteOption|room_id={roomId}`
  - `order`: 表示順
  - `ttl`: 生データ削除時刻
  - `label`, `added_by_member_id`, `archived`
- `GroupRouletteEvent`
  - `id`: `GroupRouletteEvent|{roomId}|{eventId}`
  - `search_key_1`: `GroupRouletteEvent|room_id={roomId}`
  - `order`: 発生時刻
  - `ttl`: 生データ削除時刻
  - 候補追加、削除、開始、停止などの生履歴
- `RealtimeRequest`
  - `id`: `RealtimeRequest|{roomId}|{requestId}`
  - `ttl`: 冪等性確認用の短期削除時刻
  - `tool`, `room_id`, `member_id`, `type`, `created_at`

### 更新パターン

- `addOption`, `removeOption`, `startSpin`, `stopSpin` は `TransactWriteItems` または `UpdateItem` の条件付き更新で処理する。
- これらの操作では、`GroupRouletteRoom` の `revision`、期限、状態、権限、候補数を条件に含める。
- `addOption` は `GroupRouletteRoom.active_options` と `option_sequence` を更新し、同じ transaction で `GroupRouletteOption`、`GroupRouletteEvent`、`RealtimeRequest` を書き込む。
- `removeOption` は `GroupRouletteRoom.active_options` から対象候補を外し、同じ transaction で `GroupRouletteOption.archived`、`GroupRouletteEvent`、`RealtimeRequest` を更新する。
- `startSpin` は `GroupRouletteRoom.active_options` から `current_spin` を作成し、同じ transaction で状態、`revision`、`GroupRouletteEvent`、`RealtimeRequest` を更新する。
- `stopSpin` は `GroupRouletteRoom.current_spin` を正として当選候補を確定し、同じ transaction で状態、`revision`、`GroupRouletteEvent`、`RealtimeRequest` を更新する。
- GSI Query は room state の正を作るためには使わない。
