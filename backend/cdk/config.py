import json
import os
from pathlib import Path


def _load_local_env() -> None:
    env_path = Path(__file__).parent / ".env.local"
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key, value)


def get_env_config():
    _load_local_env()
    cdk_dir = Path(__file__).parent
    env = os.getenv("CDK_ENV")
    if not env:
        raise ValueError("Environment variable 'CDK_ENV' is not set.")

    config_path = cdk_dir / "config" / f"{env}.json"
    if not config_path.exists():
        raise ValueError(f"Configuration file for environment '{env}' not found.")

    with config_path.open("r") as config_file:
        config = json.load(config_file)

    config["env"] = env
    return config
