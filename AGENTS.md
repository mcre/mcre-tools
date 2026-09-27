# AGENTS.md

## 会話

- 常に日本語で会話する。

## 最初に読むもの

依頼内容に応じて必要なものだけ読む。

- 開発・検証コマンド: `package.json`
- サイト概要とセットアップ: `README.md`
- API 契約と生成型: `openapi.yaml`、`src/composables/useApi.ts`
- フロントエンド: `src/main.ts`、`src/router/index.ts`、対象の `src/pages/` または `src/components/`
- SSG / build 設定と E2E: `vite.config.mts`、`playwright.config.ts`、`src/tests/playwright/`
- Lambda API: `backend/lambda/src/AGENTS.md`、対象の `backend/lambda/src/` と `backend/lambda/tests/`
- CDK: `backend/cdk/README.md`、`backend/cdk/app.py`、`backend/cdk/resources.py`、`backend/cdk/config/{dev,prod}.json`
- GitHub Actions: `.github/workflows/deploy.yaml`

## 基本方針

- このリポジトリは小規模な個人プロジェクトだが、公開済みの SSG サイトと API を持つため、外部インターフェースの互換性はテストで守る。
- プロジェクト操作は `package.json` の npm scripts を優先する。手作業で同等の長いコマンドを組む前に、既存 script を確認する。
- SSG は `vite-ssg build` を維持する。通常の SPA `vite build` へ置き換えない。
- SSG 成果物、特に `dist/index.html` と build 後 preview の表示を検索エンジン/crawler 向けの主要成果物として扱う。dev server の見た目だけで完了判断しない。
- 生成物は直接編集しない。`src/auto-imports.d.ts`、`src/components.d.ts`、`dist/`、`src/apis/` 配下の aspida 生成物は元設定や生成コマンドから更新する。
- 破壊的な構成変更は許容するが、変更前に期待動作をテストで表現し、変更後に受け入れコマンドで確認する。

## TDD

- 原則としてテスト駆動開発で進める。
- まず期待する入出力や退行防止条件をテストに追加する。
- 実装前にテストを実行し、失敗を確認する。
- コミットはユーザーから明示された場合だけ行う。
- 実装中は、テストの期待値を都合よく緩めず、実装側を修正して通す。

## フロントエンド

- Node は `>=24 <25` を前提にする。
- node/SSG 関係の表示確認は、ローカルの `npm run build` と build 後 preview で足りる。特別な理由がない限り、確認のためだけに dev 環境へ S3/CloudFront 配布しない。
- dev API とつないだ手元確認は `npm run preview:dev` を使う。通常の `npm run preview` は production build を表示するため、prod 未反映の API は使えない。
- 最終確認は `npm run build` と `npm run preview` で行い、build 後 preview で CSS、画像、主要レイアウトが崩れていないことを確認する。
- preview やブラウザ確認で既定ポートが使用中の場合は、既存プロセスを止めずに別ポートで起動する。作業中に kill の確認で流れを止めない。自分が起動した確認用プロセスを止める必要がある場合は、すべての作業と検証が終わった最後にまとめて確認する。
- E2E は dev server ではなく、build 済みの `vite preview` に対して実行する。
- Vuetify 4 と `vite-ssg` を併用しているため、Critical CSS 抽出が CSS cascade layer を崩すリスクを避ける目的で `ssgOptions.beastiesOptions: false` を維持する。
- API 呼び出しは `src/composables/useApi.ts` に集約する。
- ページ固有の複雑な状態計算は composable に分離し、Vitest で単体検証する。
- E2E は外部 API に依存せず、Playwright の `page.route` で mock する。
- URL query の同期は、ユーザー操作ごとの履歴汚染を避けるため原則 `router.replace` を使う。
- `AutoImport` と `Components` plugin の対象は明示 import しない。Vue API、Vue Router API、`src/composables`、`src/utils`、`src/router`、`src/components` は自動解決を優先する。
- `defineProps` の公開型や composable の型など、`vue-tsc` に必要なものは `import type` として残す。
- コンポーネント分割や構成整理で、既存のコンテンツ量、リンク、カード、制作物、デザイン密度を勝手に減らさない。

## API 契約

- API のパスやリクエスト・レスポンス型を変える場合は `openapi.yaml` を更新し、`npm run api:build` で `src/apis/` を再生成する。
- 公開 API の挙動を変える場合は、対応する Lambda の unittest とフロントエンドのテストで互換性を確認する。

## Lambda

- API パス `/v1/jukugo/{character}/left-search` と `/v1/jukugo/{character}/right-search` は維持する。
- Lambda 共通処理は `backend/lambda/src/util.py` に寄せる。
- ルーティング、DynamoDB item なし時、OGP redirect/key 生成は unittest で守る。
- Python runtime は 3.13 を前提にする。
- dev 環境の Lambda 関数コード更新は `npm run lambda:deploy:dev` を使う。この script は `api`、`ogp` の zip package を GitHub Actions と同じ構成で作り、`mcre-tools-dev-*` を更新する。
- `lambda:deploy:dev` は既定で `AWS_PROFILE=mcre-main`、`AWS_REGION=ap-northeast-1`、`LAMBDA_PREFIX=mcre-tools-dev` を使う。必要な場合だけ環境変数で上書きする。

## CDK / GitHub Actions

- CDK の環境切り替えは `CDK_ENV=dev|prod` に統一する。`backend/cdk/config/_env.json` は使わない。
- API、Lambda、CDK、AWS managed service 連携はローカルだけでは確認できないため、必要に応じて dev 環境へデプロイして疎通確認する。
- ローカルの CDK 操作は npm scripts を使う。`cdk:synth:*`、`cdk:diff:*`、`cdk:deploy:*` は `--profile mcre-main` 付きで定義している。
- prod deploy は明示依頼がある場合だけ扱う。通常作業では `cdk:synth:prod` と `cdk:diff:prod` までに留める。
- prod の既存リソース名とドメインは維持する。
- CDK CLI は npm devDependency の `cdk` を使う。global install 前提にしない。
- S3 は暗号化と SSL 強制を明示し、CloudWatch Logs は無期限保持を避ける。
- GitHub Actions は `dev` branch を dev、`main` branch を prod として扱う。
- CDK outputs から SSG 用 `.env.production` を生成する。

## 品質検証・差分確認

- `npm run lint`
- `npm run format:check`
- `npm run type-check`
- `npm run test:unit`
- `npm run build`
- `npm run preview`（build 後の表示確認）
- `npm run preview:dev`（dev API を使う手元確認）
- `npm run e2e`
- `npm run lambda:test`
- `npm run cdk:test`
- `python3 scripts/verify_ogp_layer_image_generation.py`
- `npm run cdk:synth:dev`
- `npm run cdk:diff:dev`
- `npm run cdk:synth:prod`
- `npm run cdk:diff:prod`
- `npm audit --omit=dev`

## dev 環境への反映

- Lambda 関数コード: `npm run lambda:deploy:dev`
- CDK: `npm run cdk:deploy:dev`
