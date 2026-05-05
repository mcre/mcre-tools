# mcre-tools

https://tools.mcre.info の SSG フロントエンド、Lambda API、CDK インフラ設定一式。

## Requirements

- Node.js `>=24 <25`
- npm
- Python `3.13`
- AWS CLI
- AWS CDK CLI は npm devDependency の `cdk` を使う

## Setup

```sh
npm install
cd backend/cdk
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

## Development

```sh
npm run dev
npm run test:unit
npm run build
npm run preview
```

SSG は `vite-ssg build` で生成する。通常の `vite build` へは変更しない。検索エンジン/crawler が評価する主要成果物は build 後の `dist/index.html` と静的 HTML なので、dev server の表示だけではなく `npm run build` 後の `npm run preview` で CSS 込みの表示を確認する。

Vuetify 4 と `vite-ssg` の組み合わせでは、Critical CSS 抽出が CSS cascade layer を崩し、`dist/index.html` や preview 表示の CSS が壊れるリスクがある。このため `vite.config.mts` では `ssgOptions.beastiesOptions: false` を設定し、Critical CSS 抽出を無効化している。

## Quality Checks

```sh
npm run lint
npm run format:check
npm run type-check
npm run test:unit
npm run build
npm run e2e
npm run lambda:test
npm run cdk:synth:dev
npm run cdk:synth:prod
npm audit --omit=dev
```

## Scripts

- `npm run dev`: Vite dev server を起動する。
- `npm run dev:vite`: Vite dev server を直接起動する。
- `npm run type-check`: TypeScript と Vue SFC の型検査を行う。
- `npm run build-only`: SSG build のみを実行する。
- `npm run build`: 型検査後に SSG build を実行する。
- `npm run preview`: build 済みの `dist/` を `vite preview` で確認する。
- `npm run test:unit`: Vitest を 1 回実行する。
- `npm run test:once`: Vitest を 1 回実行する。
- `npm run e2e`: `npm run build` 後の `vite preview` に対して Playwright E2E を実行する。
- `npm run lambda:test`: Lambda の unittest を実行する。
- `npm run cdk:synth:dev`: `CDK_ENV=dev` で CDK synth を実行する。
- `npm run cdk:synth:prod`: `CDK_ENV=prod` で CDK synth を実行する。

## Frontend Rules

- 生成物は直接編集しない。`src/auto-imports.d.ts`、`src/components.d.ts`、`dist/`、aspida 生成物は設定や生成コマンドから更新する。
- `AutoImport` と `Components` plugin の対象は明示 import しない。Vue API、Vue Router API、`src/composables`、`src/utils`、`src/router`、`src/components` は自動解決を優先する。
- `vue-tsc` に必要な公開型は `import type` として残す。
- 近代化やコンポーネント分割で、既存のコンテンツ量、リンク、カード、制作物、デザイン密度を減らさない。

## Environment

フロントエンドは次の Vite 環境変数を使う。

- `VITE_DISTRIBUTION_DOMAIN_NAME`
- `VITE_API_DOMAIN_NAME`
- `VITE_OGP_DOMAIN_NAME`

CDK は `CDK_ENV` で環境を切り替える。

```sh
CDK_ENV=dev npm run cdk -- synth --all
CDK_ENV=prod npm run cdk -- synth --all
```

## Deploy

GitHub Actions は次の branch mapping で deploy する。

- `dev`: dev 環境
- `main`: prod 環境

初回だけ GitHub Actions 用 IAM Role が存在しないため、ローカルから十分な権限で CDK deploy する。

```sh
npm run cdk:deploy:dev
npm run cdk:deploy:prod
```

## License

see [LICENSE](./LICENSE)
