import json
import os


def get_env_config():
    env_config_path = os.path.join("config", "_env.json")
    if not os.path.exists(env_config_path):
        raise ValueError("Environment configuration file '_env.json' not found.")

    with open(env_config_path, "r") as env_config_file:
        env_config = json.load(env_config_file)

    env = env_config.get("env")
    if not env:
        raise ValueError("Environment 'env' is not set in '_env.json'.")

    config_path = os.path.join("config", f"{env}.json")
    if not os.path.exists(config_path):
        raise ValueError(f"Configuration file for environment '{env}' not found.")

    with open(config_path, "r") as config_file:
        config = json.load(config_file)

    config["env"] = env
    return config
