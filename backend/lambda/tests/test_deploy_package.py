import pathlib
import shutil
import tempfile
import unittest
import zipfile


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC_ROOT = LAMBDA_ROOT / "src"


def build_package_names(short_name: str) -> set[str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        stage = pathlib.Path(temp_dir) / short_name
        shutil.copytree(SRC_ROOT / short_name, stage)
        shutil.copy2(SRC_ROOT / "util.py", stage / "util.py")

        package_path = pathlib.Path(temp_dir) / "package.zip"
        with zipfile.ZipFile(package_path, "w") as archive:
            for path in stage.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(stage).as_posix())

        with zipfile.ZipFile(package_path) as archive:
            return set(archive.namelist())


class LambdaDeployPackageTest(unittest.TestCase):
    def test_api_package_includes_shared_util(self):
        package_names = build_package_names("api")

        self.assertIn("main.py", package_names)
        self.assertIn("util.py", package_names)

    def test_ogp_package_includes_shared_util_and_image_assets(self):
        package_names = build_package_names("ogp")

        self.assertIn("main.py", package_names)
        self.assertIn("util.py", package_names)
        self.assertIn("assets/jukugo/base.png", package_names)
        self.assertIn("assets/jukugo/reverse_arrows.png", package_names)
        self.assertIn("assets/fonts/NotoSansJP-Light.ttf", package_names)

    def test_realtime_package_includes_shared_util(self):
        package_names = build_package_names("realtime")

        self.assertIn("main.py", package_names)
        self.assertIn("util.py", package_names)
        self.assertIn("repository.py", package_names)

    def test_legacy_lambda_source_layout_is_removed(self):
        self.assertFalse((LAMBDA_ROOT / "api").exists())
        self.assertFalse((LAMBDA_ROOT / "ogp").exists())
        self.assertFalse((LAMBDA_ROOT / "util.py").exists())


if __name__ == "__main__":
    unittest.main()
