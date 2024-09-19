## Pillow-10.4.0.zip

```
docker run -it --rm --platform linux/amd64 -v $PWD/layers:/layers --entrypoint="" amazon/aws-lambda-python:3.12 /bin/bash
cd /layers
mkdir python
pip install -t ./python Pillow
exit
cd layers
zip -r Pillow-10.4.0.zip python
```