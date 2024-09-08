# cd tools/jukugo
# python 01_download.py

import os
import shutil

import requests


DICT_URL = (
    "https://raw.githubusercontent.com/google/mozc/master/src/data/dictionary_oss/"
)
LOCAL_DICT_DIR = "./work/dictionary"

if os.path.exists(LOCAL_DICT_DIR):
    shutil.rmtree(LOCAL_DICT_DIR)

os.makedirs(LOCAL_DICT_DIR)

file_index = 0

while True:
    file_name = f"dictionary{file_index:02}.txt"
    file_url = DICT_URL + file_name
    file_path = os.path.join(LOCAL_DICT_DIR, file_name)

    print(f"Trying to download {file_name} from {file_url} ...")
    response = requests.get(file_url)

    if response.status_code == 200:
        with open(file_path, "wb") as file:
            file.write(response.content)
        print(f"{file_name} has been downloaded successfully.")
    else:
        print(f"{file_name} not found. Stopping download.")
        break

    file_index += 1

print("Download process completed.")
