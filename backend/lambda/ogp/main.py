import os
import sys
import hashlib
from PIL import Image, ImageDraw, ImageFont
import io
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import util as u


def generate_jukugo_image(params):
    base_img = Image.open("assets/jukugo/base.png")
    reverse_arrows_img = Image.open("assets/jukugo/reverse_arrows.png")
    draw = ImageDraw.Draw(base_img)

    font_name = "assets/fonts/NotoSansJP-Light.ttf"

    font = ImageFont.truetype(font_name, size=22)
    fill = (0, 0, 0)
    x_left, x_center, x_right = 25, 117, 210
    y_top, y_center, y_bottom = 29, 129, 229

    xo, yo = -11, -17  # string x offset, y offset

    draw.text((x_center + xo, y_top + yo), params["top"], font=font, fill=fill)
    draw.text((x_right + xo, y_center + yo), params["right"], font=font, fill=fill)
    draw.text((x_center + xo, y_bottom + yo), params["bottom"], font=font, fill=fill)
    draw.text((x_left + xo, y_center + yo), params["left"], font=font, fill=fill)
    if params["hide"]:
        draw.text((x_center + xo, y_center + yo), "？", font=font, fill=fill)
    else:
        if params["answer"] != "":
            draw.text(
                (x_center + xo, y_center + yo), params["answer"], font=font, fill=fill
            )

    r = 10  # 半径的な
    xo, yo = 47, 50  # crop x offset, y offset
    squares = {
        "top": (x_center - r, y_top - r + yo, x_center + r, y_top + r + yo),
        "right": (x_right - r - xo, y_center - r, x_right + r - xo, y_center + r),
        "bottom": (x_center - r, y_bottom - r - yo, x_center + r, y_bottom + r - yo),
        "left": (x_left - r + xo, y_center - r, x_left + r + xo, y_center + r),
    }
    if not params["array_top"]:
        s = squares["top"]
        base_img.paste(reverse_arrows_img.crop(s), (s[0], s[1]))
    if not params["array_right"]:
        s = squares["right"]
        base_img.paste(reverse_arrows_img.crop(s), (s[0], s[1]))
    if not params["array_bottom"]:
        s = squares["bottom"]
        base_img.paste(reverse_arrows_img.crop(s), (s[0], s[1]))
    if not params["array_left"]:
        s = squares["left"]
        base_img.paste(reverse_arrows_img.crop(s), (s[0], s[1]))

    padding = 30
    new_width = base_img.width + padding * 2
    new_height = base_img.height + padding * 2
    new_img = Image.new("RGBA", (new_width, new_height), (255, 255, 255, 255))

    new_img.paste(base_img, (padding, padding))

    footer_font = ImageFont.truetype(font_name, size=12)
    footer_text = f"https://{os.getenv('DOMAIN_NAME_DISTRIBUTION')}/jukugo"
    bbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    text_width = bbox[2] - bbox[0]
    footer_x = (new_width - text_width) // 2
    footer_y = new_height - 20

    new_draw = ImageDraw.Draw(new_img)
    new_draw.text((footer_x, footer_y), footer_text, font=footer_font, fill=fill)

    image_bytes = io.BytesIO()
    new_img.save(image_bytes, format="PNG")
    image_bytes.seek(0)

    return image_bytes


def get_jukugo(query_strings):
    q = query_strings
    params = {
        "top": q.get("t"),
        "right": q.get("r"),
        "bottom": q.get("b"),
        "left": q.get("l"),
        "array_top": q.get("at") != "0",
        "array_right": q.get("ar") != "0",
        "array_bottom": q.get("ab") != "0",
        "array_left": q.get("al") != "0",
        "hide": q.get("h") == "1",
        "answer": q.get("a"),
    }

    bucket_name = os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME")

    hash_key = hashlib.md5(json.dumps(params).encode()).hexdigest()
    image_key = f"jukugo/{hash_key}.png"
    image_url = f"https://{bucket_name}.ap-northeast-1.s3.amazonaws.com/{image_key}"

    if u.is_exists_in_s3(bucket_name, image_key):
        return u.redirect_response(image_url)

    u.upload_public_image_to_s3(
        bucket_name,
        image_key,
        generate_jukugo_image(params),
    )
    return u.redirect_response(image_url)


@u.logger.inject_lambda_context(log_event=True)
def main(event, context):
    m, l, a, q = u.parse_request(event)
    try:
        if m == "GET" and l == 1 and a[0] == "jukugo":
            return get_jukugo(q)
    except Exception as e:
        u.logger.exception("API処理中にエラー")
        return u.api_response(status_code=500)

    return u.api_response(status_code=404)
