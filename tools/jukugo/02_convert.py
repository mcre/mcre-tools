# cd tools/jukugo
# python 02_convert.py

import os
import re

LOCAL_DICT_DIR = "./work/dictionary"
OUTPUT_FILE = "./work/dict.csv"

if os.path.exists(OUTPUT_FILE):
    os.remove(OUTPUT_FILE)


def parse_jukugo_line(line):
    try:
        parts = line.split("\t")
        midashi = parts[4].strip()
        cost = int(parts[3].strip())
        return midashi, cost
    except (IndexError, ValueError):
        print(f"error: {line}")
        return None, None


def is_jukugo(midashi):
    return bool(re.match(r"^[\u4E00-\u9FFF]{2}$", midashi))


def process_files():
    jukugo_dict = {}
    for filename in sorted(os.listdir(LOCAL_DICT_DIR)):
        if filename.endswith(".txt"):
            file_path = os.path.join(LOCAL_DICT_DIR, filename)
            with open(file_path, encoding="utf-8") as f:
                for line in f:
                    midashi, cost = parse_jukugo_line(line)
                    if midashi and is_jukugo(midashi):
                        # 辞書に既に存在する場合、コストを比較して小さい方を優先
                        if midashi in jukugo_dict:
                            if jukugo_dict[midashi] > cost:
                                jukugo_dict[midashi] = cost
                        else:
                            jukugo_dict[midashi] = cost
            print(f"Processed {filename}")

    jukugo_list = sorted(jukugo_dict.items(), key=lambda x: x[1])
    return jukugo_list


def save_jukugo_list(jukugo_list):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for midashi, cost in jukugo_list:
            f.write(f"{midashi},{cost}\n")


jukugo_list = process_files()
save_jukugo_list(jukugo_list)
print(f"Total jukugo: {len(jukugo_list)}")
