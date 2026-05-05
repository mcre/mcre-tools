# Lambda Layers

## Pillow layer

Python 3.13 runtime と同じ Amazon Linux 環境で layer を再作成する。

```sh
cd backend/cdk
docker run -it --rm --platform linux/amd64 \
  -v "$PWD/layers:/layers" \
  --entrypoint="" \
  public.ecr.aws/lambda/python:3.13 \
  /bin/bash
```

container 内:

```sh
cd /layers
rm -rf python
mkdir -p python
python -m pip install --upgrade pip
python -m pip install -t ./python Pillow==11.3.0
exit
```

host 側:

```sh
cd backend/cdk/layers
zip -r Pillow-11.3.0-py313.zip python
rm -rf python
```

CDK config の `lambda.ogp.layers` に zip 名を追加する。
