# AGENTS ガイドライン

この指示は `backend/lambda/src/` 配下に適用する。

- `util.py` は API Gateway イベント解析、JSON レスポンス、共通エラー、DynamoDB/S3 の薄い共通処理を置く。
- `api/main.py` はルート定義と Lambda エントリポイントに寄せる。HTTP method と path の分岐を個別処理へ散らさない。
- `ogp/main.py` は OGP 画像生成と S3 redirect に集中させる。
- ルートやレスポンス形式を変える場合は、先に `backend/lambda/tests/` の unittest を追加して失敗を確認する。
- Lambda ランタイムは Python 3.13 とする。
