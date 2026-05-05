import hashlib
import io
import json
import os
from pathlib import Path

import util as u


ASSET_ROOTS = [
    Path(__file__).parent / "assets",
    Path(__file__).parents[2] / "ogp" / "assets",
]


def asset_path(relative_path: str) -> str:
    for root in ASSET_ROOTS:
        candidate = root / relative_path
        if candidate.exists():
            return str(candidate)
    return str(ASSET_ROOTS[0] / relative_path)


def generate_jukugo_image(params):
    from PIL import Image, ImageDraw, ImageFont

    base_img = Image.open(asset_path("jukugo/base.png"))
    reverse_arrows_img = Image.open(asset_path("jukugo/reverse_arrows.png"))
    draw = ImageDraw.Draw(base_img)

    font_name = asset_path("fonts/NotoSansJP-Light.ttf")
    font = ImageFont.truetype(font_name, size=50)
    fill = (0, 0, 0)
    xl, xc, xr = 43, 203, 363
    yt, yc, yb = 50, 223, 398

    xo, yo = -25, -37
    if params["top"]:
        draw.text((xc + xo, yt + yo), params["top"], font=font, fill=fill)
    if params["right"]:
        draw.text((xr + xo, yc + yo), params["right"], font=font, fill=fill)
    if params["bottom"]:
        draw.text((xc + xo, yb + yo), params["bottom"], font=font, fill=fill)
    if params["left"]:
        draw.text((xl + xo, yc + yo), params["left"], font=font, fill=fill)
    if params["hide"]:
        draw.text((xc + xo, yc + yo), "？", font=font, fill=fill)
    elif params["answer"]:
        draw.text((xc + xo, yc + yo), params["answer"], font=font, fill=fill)

    r = 20
    xo, yo = 80, 86
    squares = {
        "top": (xc - r, yt - r + yo, xc + r, yt + r + yo),
        "right": (xr - r - xo, yc - r, xr + r - xo, yc + r),
        "bottom": (xc - r, yb - r - yo, xc + r, yb + r - yo),
        "left": (xl - r + xo, yc - r, xl + r + xo, yc + r),
    }
    for position in ["top", "right", "bottom", "left"]:
        if not params[f"array_{position}"]:
            square = squares[position]
            base_img.paste(reverse_arrows_img.crop(square), (square[0], square[1]))

    new_width = 1200
    new_height = 630
    new_img = Image.new("RGBA", (new_width, new_height), (255, 255, 255, 255))
    new_img.paste(
        base_img,
        ((new_width - base_img.width) // 2, (new_height - base_img.height) // 2),
    )

    footer_font = ImageFont.truetype(font_name, size=30)
    footer_text = f"https://{os.getenv('DOMAIN_NAME_DISTRIBUTION')}/jukugo"
    bbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    footer_x = (new_width - (bbox[2] - bbox[0])) // 2
    footer_y = new_height - 50

    ImageDraw.Draw(new_img).text(
        (footer_x, footer_y),
        footer_text,
        font=footer_font,
        fill=fill,
    )

    image_bytes = io.BytesIO()
    new_img.save(image_bytes, format="PNG")
    image_bytes.seek(0)
    return image_bytes


def get_jukugo(query_strings):
    params = {
        "top": query_strings.get("t"),
        "right": query_strings.get("r"),
        "bottom": query_strings.get("b"),
        "left": query_strings.get("l"),
        "array_top": query_strings.get("at") != "0",
        "array_right": query_strings.get("ar") != "0",
        "array_bottom": query_strings.get("ab") != "0",
        "array_left": query_strings.get("al") != "0",
        "hide": query_strings.get("h") == "1",
        "answer": query_strings.get("a"),
    }

    bucket_name = os.getenv("S3_OGP_BUCKET_NAME")
    hash_key = hashlib.md5(
        json.dumps(params, sort_keys=True).encode(),
        usedforsecurity=False,
    ).hexdigest()
    image_key = f"jukugo/{hash_key}.png"
    image_url = f"https://{bucket_name}.s3.ap-northeast-1.amazonaws.com/{image_key}"

    if u.is_exists_in_s3(bucket_name, image_key):
        return u.redirect_response(image_url)

    u.upload_image_to_s3(bucket_name, image_key, generate_jukugo_image(params))
    return u.redirect_response(image_url)


@u.logger.inject_lambda_context(log_event=True)
def main(event, context):
    request = u.parse_api_request(event)
    if request.method == "GET" and request.parts in [["jukugo"], ["ja", "jukugo"], ["en", "jukugo"]]:
        return get_jukugo(request.query_string)
    return u.api_error_response(
        status_code=404,
        error_code="NOT_FOUND",
        message="APIが見つかりません",
    )
