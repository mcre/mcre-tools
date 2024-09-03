# CDK コマンドメモ

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
cdk --profile m_cre-super-user deploy
```

(差分を見るとき)

```
cdk --profile m_cre-super-user diff
```

(破棄するとき)

```
cdk --profile m_cre-super-user destroy
```
