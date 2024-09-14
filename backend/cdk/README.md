# CDK コマンドメモ

## 設計方針について

configのenvを変更することにより、AWSアカウントや同じアカウント内に独立環境を作成できるようにしたい。
そうでない場合はできるだけPythonコード内にハードコードする。

## 前提とするリソースについて

下記は手動で作成する。

- Open ID Connect Provider
  - AWSアカウント上に複数の同じProviderを使用することができないため。

## Github Actionsの権限について

Github Actions自体でもCDKのDeployを行っているが、そのためのIAM RoleはCDKで作成したものため、初回のCDK Deployはローカル環境から別の権限で実施する必要がある。

なおIAM RoleのarnはGithubリポジトリのActions用の環境変数に`AWS_IAM_ROLE_ARN`として登録する必要がある。

## 仮想環境

各コマンドは仮想環境上で実行する必要がある。

仮想環境の作成

```
cd backend/cdk
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

仮想環境の入り方

```
cd backend/cdk
source .venv/bin/activate
```

## コマンド

まず、env.json の env 値が `prod` になっていることを確認する。

CDK から CloudFormation Template をつくる。

```
cdk --profile m_cre-super-user synth
```

synth が通ったあとはデプロイする

```
cdk --profile m_cre-super-user deploy --all
```

(差分を見るとき)

```
cdk --profile m_cre-super-user diff
```

(破棄するとき)

```
cdk --profile m_cre-super-user destroy
```
