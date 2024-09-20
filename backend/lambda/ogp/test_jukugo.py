# cd backend/lambda/ogp
# python test_jukugo.py

import os
import main


if __name__ == "__main__":
    os.environ["DOMAIN_NAME_DISTRIBUTION"] = "tools.mcre.info"
    image_bytes = main.generate_jukugo_image(
        {
            "top": "上",
            "right": "右",
            "bottom": "下",
            "left": "左",
            "array_top": True,
            "array_right": False,
            "array_bottom": False,
            "array_left": False,
            "hide": False,
            "answer": "答",
        }
    )

    work = "work"
    os.makedirs(work, exist_ok=True)
    with open(f"{work}/test.png", "wb") as f:
        f.write(image_bytes.getbuffer())
