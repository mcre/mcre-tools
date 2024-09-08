熟語辞書について
=======================

熟語パズルで利用する辞書データベースを構築します。
[Open source mozc dictionary](https://github.com/google/mozc/tree/1157a24ac2d0c0953d145a0b08250585854a62fc/src/data/dictionary_oss)を変換して作成します。
（リポジトリには辞書データおよびそれを変換した結果は含まれません。ライセンスについてはプロジェクトルートの[README.md](../../README.md)を参照）

## セットアップ

- AWS CLIの設定済みプロファイル
- Python 3.x

``` bash
pip install -r requirements.txt
```

## 使用方法


``` bash
cd tools/jukugo
python 01_download.py
python 02_convert.py
python 03_seed.py <aws_profile> <table_name>
```

例

``` bash
cd tools/jukugo
python 01_download.py
python 02_convert.py
python 03_seed.py m_cre-super-user mcre-tools-primary
```

これらのスクリプトにより、`./work`ディレクトリに`dict.csv`が生成され、DynamoDBテーブルにレコードが挿入されます。

