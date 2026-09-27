# AGENTS ガイドライン

この指示は `backend/lambda/src/` 配下に適用する。

- `util.py` は API Gateway イベント解析、JSON レスポンス、共通エラー、DynamoDB/S3 の薄い共通処理を置く。
- `api/main.py` はルート定義と Lambda エントリポイントに寄せる。HTTP method と path の分岐を個別処理へ散らさない。
- `api/group_roulette.py` はグループルーレットの HTTP 入出力とエラー変換を扱い、永続化や状態遷移は `group_roulette_core/repository.py` に寄せる。
- `ogp/main.py` は OGP 画像生成と S3 redirect に集中させる。
- ルートやレスポンス形式を変える場合は、先に `backend/lambda/tests/` の unittest を追加して失敗を確認する。
- グループルーレットの API は `backend/lambda/tests/test_api_routes.py`、永続化や状態遷移は `backend/lambda/tests/test_group_roulette_repository.py` で守る。
- Lambda ランタイムは Python 3.13 とする。
