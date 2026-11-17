from pathlib import Path

from PIL import Image, ImageOps

source = Image.open("public/lifeos-brand.jpg").convert("RGBA")
resources = Path("android/app/src/main/res")
densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def artwork(size):
    return ImageOps.contain(source, (size, size), method=Image.Resampling.LANCZOS)


def padded_artwork(size, art_size):
    canvas = Image.new("RGBA", (size, size))
    emblem = artwork(art_size)
    canvas.alpha_composite(emblem, ((size - emblem.width) // 2, (size - emblem.height) // 2))
    return canvas


for density, scale in densities.items():
    launcher = resources / f"mipmap-{density}"
    launcher.mkdir(parents=True, exist_ok=True)
    artwork(round(48 * scale)).save(launcher / "ic_launcher.png")
    padded_artwork(round(48 * scale), round(37 * scale)).save(launcher / "ic_launcher_round.png")
    # Android's 66 dp safe zone keeps the emblem and its frame inside varying launcher masks.
    padded_artwork(round(108 * scale), round(66 * scale)).save(launcher / "ic_launcher_foreground.png")

    launch = resources / f"drawable-{density}"
    launch.mkdir(parents=True, exist_ok=True)
    padded_artwork(round(288 * scale), round(150 * scale)).save(launch / "lifeos_launch_art.png")

values = resources / "values"
(values / "lifeos_launcher_background.xml").write_text(
    '<resources><color name="lifeos_launcher_background">#000000</color></resources>',
    encoding="utf-8",
)
adaptive = resources / "mipmap-anydpi-v26"
adaptive.mkdir(parents=True, exist_ok=True)
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (adaptive / name).write_text(
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'
        '<background android:drawable="@color/lifeos_launcher_background"/>'
        '<foreground android:drawable="@mipmap/ic_launcher_foreground"/>'
        '</adaptive-icon>',
        encoding="utf-8",
    )
