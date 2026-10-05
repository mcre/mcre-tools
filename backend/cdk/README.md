# CDK

`tools.mcre.info` の CloudFront/S3/API Gateway/Lambda/DynamoDB/GitHub OIDC を作成する CDK app。

## 環境切り替え

`CDK_ENV` で環境を切り替える。

- `CDK_ENV=dev`: `tools-dev.mcre.info` 系
- `CDK_ENV=prod`: `tools.mcre.info` 系

prod は既存 stack 名と domain を維持する。

## 前提リソース

下記は手動で作成する。

- Route53 domain と hosted zone
- Open ID Connect Provider
  - AWS アカウント上に複数の同じ provider を作成できないため。

## GitHub Actions の権限

GitHub Actions 用 IAM Role は CDK が作成する。そのため初回だけはローカルから別権限で CDK deploy する。

## 仮想環境

```sh
cd backend/cdk
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

## Commands

```sh
npm run cdk:synth:dev
npm run cdk:diff:dev
npm run cdk:deploy:dev
npm run cdk:synth:prod
npm run cdk:diff:prod
npm run cdk:deploy:prod
```

CDK CLI は repository の npm devDependency を使う。

## Lambda@Edge の翻訳データ

OGP用のLambda@Edgeには、`src/locales/*.json` からサイト名、言語情報、
各ツールの識別子・タイトル・説明だけを抽出して埋め込む。
操作ラベルなどの変更ではLambda@Edgeのコードは変わらない。
OGPに使う項目の変更やツール追加では、新しい関数バージョンと
CloudFrontの関連付けを更新する。

## Outputs

GitHub Actions は CDK outputs から `.env.production` を生成し、SSG build に渡す。

- `ViteEnvJp`: `VITE_API_DOMAIN_NAME` と `VITE_OGP_DOMAIN_NAME`
- `ViteEnvUs`: `VITE_DISTRIBUTION_DOMAIN_NAME`
- `BucketDistribution`: SSG deploy 先 bucket
- `CloudfrontDistribution`: invalidation 対象 distribution
