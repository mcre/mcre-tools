# DynamoDB 設計

このドキュメントは `mcre-tools` の DynamoDB 設計をまとめる。現行の主な用途は熟語パズル用の熟語辞書検索である。

## 方針

- DynamoDB のテーブルは CDK の primary テーブル 1 つだけにする。
- テーブル名は `{prefix}-primary` とする。
  - dev: `mcre-tools-dev-primary`
  - prod: `mcre-tools-primary`
- PK は `id` 文字列のみとし、SK は持たない。
- このブランチの CDK 定義では GSI と TTL を設定しない。
- テーブルは pay-per-request で運用する。
- レコードの `id` には用途を表す prefix を付ける。
- 現行 API 実装は `backend/lambda/src` 配下だけを正とする。

## 単一テーブル拡張の設計パターン

レコード種別、`search_key_n`、`order`、GSI、TTL などを追加する場合は、次のパターンを使う。

- `id` は `{RecordType}|{publicId}` 形式を基本にし、DynamoDB 内部でレコード種別が分かる prefix を付ける。
- API レスポンスでは、必要に応じて prefix を除いた public ID を返す。
- `search_key_n` にも検索対象を表す prefix を付ける。
- 一覧取得やフィルタには `search_key_n-order-index` を使う。
- `order` は一覧・集計順に使う数値にし、基本的には Unix 秒の時刻または表示順を入れる。
- `created_at`, `updated_at` は Unix 秒の整数で扱う。
- 一時レコードや期限付き生データには `ttl` を持たせる。ただし TTL は物理削除の補助であり、ユーザー向け期限判定は `expires_at` などの明示フィールドで行う。
- 長期保存する集計レコードには自由入力を含めない。
- 共有状態やスナップショットは、後続更新の可否を決め、必要なら条件付き put/update で不変性や冪等性を守る。
- 共有状態の更新では単調増加する `revision` と `requestId` を使い、必要な関連レコードと冪等性記録を transaction で揃える。操作レスポンスと状態取得は同じ envelope を返し、`serverTime` を含める。
- polling や将来の通知は正本を再取得するきっかけにする。高頻度 tick は保存せず、基準時刻と状態から各クライアントで表示を補間する。

Lambda 実装では次の配置・責務分担を基本にする。

- `backend/lambda/src` 配下を現行 Lambda 実装の正とする。
- `backend/lambda/src/util.py` に API Gateway イベント解析、JSON レスポンス、DynamoDB/S3 の薄い共通処理を置く。
- `backend/lambda/src/api/main.py` は REST API の entrypoint とルート定義に寄せる。
- 機能が大きくなる場合は、handler、repository、presenter などの責務を分け、ルート定義に個別処理を散らさない。
- DynamoDB の key 生成、prefix 除去、条件付き更新、transaction は repository 層に閉じ込める。

## インデックス

| 名前          | PK   | SK   | 用途                       |
| ------------- | ---- | ---- | -------------------------- |
| primary table | `id` | なし | 熟語辞書レコードの直接取得 |

現状は一覧取得や複合条件検索がないため、GSI は持たない。将来、一覧・集計・フィルタが必要になった場合は、取得パターンを確認してから `search_key_n-order-index` 形式の GSI を検討する。

GSI は結果整合であるため、ユーザー操作の正当性判定や確定結果の決定には使わない。正とする状態は `GetItem` または条件付き更新で扱える単一 item に持たせ、GSI は一覧表示や監査などに限定する。

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
