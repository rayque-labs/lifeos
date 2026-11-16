from pathlib import Path
import shutil
import xml.etree.ElementTree as ET


ANDROID = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID)
root = Path("android/app/src/main")
manifest = root / "AndroidManifest.xml"
tree = ET.parse(manifest)
app = tree.find("application")
activity = app.find("activity") if app is not None else None
if activity is None or activity.get(f"{{{ANDROID}}}name") != ".MainActivity":
    raise ValueError("MainActivity ausente no projeto Android gerado")

assist = "android.intent.action.ASSIST"
if activity.find(f"intent-filter/action[@{{{ANDROID}}}name='{assist}']") is None:
    intent = ET.SubElement(activity, "intent-filter")
    ET.SubElement(intent, "action", {f"{{{ANDROID}}}name": assist})
    ET.SubElement(intent, "category", {f"{{{ANDROID}}}name": "android.intent.category.DEFAULT"})

queries = tree.find("queries")
if queries is None:
    queries = ET.SubElement(tree.getroot(), "queries")
tts = "android.intent.action.TTS_SERVICE"
if queries.find(f"intent/action[@{{{ANDROID}}}name='{tts}']") is None:
    intent = ET.SubElement(queries, "intent")
    ET.SubElement(intent, "action", {f"{{{ANDROID}}}name": tts})

ET.indent(tree, space="    ")
tree.write(manifest, encoding="utf-8", xml_declaration=True)

package_path = root / "java/com/rayquelabs/lifeos"
for name in ("MainActivity.java", "LifeOSAssistant.java"):
    shutil.copyfile(Path(__file__).parent / name, package_path / name)
