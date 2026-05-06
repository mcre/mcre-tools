#!/usr/bin/env python3
import importlib
import os
import pathlib
import sys
import tempfile
import zipfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
LAYER_ZIP = ROOT / "backend" / "cdk" / "layers" / "Pillow-11.3.0-py313.zip"
LAMBDA_SRC = ROOT / "backend" / "lambda" / "src"


def main() -> None:
    if sys.version_info[:2] != (3, 13):
        raise RuntimeError(
            "OGP layer smoke must run with Python 3.13 to match Lambda runtime"
        )

    if not LAYER_ZIP.exists():
        raise FileNotFoundError(LAYER_ZIP)

    os.environ.setdefault("DOMAIN_NAME_DISTRIBUTION", "tools.mcre.info")

    with tempfile.TemporaryDirectory() as temp_dir:
        with zipfile.ZipFile(LAYER_ZIP) as archive:
            archive.extractall(temp_dir)

        sys.path.insert(0, str(pathlib.Path(temp_dir) / "python"))
        sys.path.insert(0, str(LAMBDA_SRC))

        ogp_main = importlib.import_module("ogp.main")
        image_bytes = ogp_main.generate_jukugo_image(
            {
                "top": "長",
                "right": "寿",
                "bottom": "老",
                "left": "若",
                "array_top": True,
                "array_right": True,
                "array_bottom": True,
                "array_left": True,
                "hide": False,
                "answer": "生",
            }
        )
        payload = image_bytes.getvalue()
        if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
            raise RuntimeError("generated OGP image is not a PNG")

        from PIL import Image

        image_bytes.seek(0)
        image = Image.open(image_bytes)
        if image.size != (1200, 630):
            raise RuntimeError(f"unexpected OGP image size: {image.size}")

    print("OGP layer image generation smoke passed")


if __name__ == "__main__":
    main()
