import json
from pathlib import Path


def load_ogp_locales(locales_dir: Path) -> dict:
    """Keep only the translations read by the Lambda@Edge OGP handler."""
    locales = {}
    for path in sorted(locales_dir.glob("*.json")):
        data = json.loads(path.read_text())
        locales[path.stem] = {
            "localeName": data["localeName"],
            "common": {"title": data["common"]["title"]},
            "tools": {
                tool: {
                    "title": messages["title"],
                    "description": messages["description"],
                }
                for tool, messages in data["tools"].items()
            },
        }
    return locales
