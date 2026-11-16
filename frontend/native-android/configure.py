from pathlib import Path
import shutil
import xml.etree.ElementTree as ET


ANDROID = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID)

def update_element(parent, tag, name, **attributes):
    node = parent.find(f"{tag}[@{{{ANDROID}}}name='{name}']")
    if node is None:
        node = ET.SubElement(parent, tag)
    node.set(f"{{{ANDROID}}}name", name)
    for key, value in attributes.items():
        node.set(f"{{{ANDROID}}}{key}", value)
    return node


root = Path("android/app/src/main")
manifest = root / "AndroidManifest.xml"
tree = ET.parse(manifest)
base = tree.getroot()
app = base.find("application")
main = app.find(f"activity[@{{{ANDROID}}}name='.MainActivity']") if app is not None else None
if main is None:
    raise ValueError("MainActivity ausente no projeto Android gerado")

assist = "android.intent.action.ASSIST"
old_component = ".AssistantPanelActivity"
previous_panel = app.find(f"activity[@{{{ANDROID}}}name='{old_component}']")
if previous_panel is not None:
    app.remove(previous_panel)

update_element(app, "activity", ".AssistantConversationActivity",
    exported="false", theme="@style/LifeOSOverlayPanel", launchMode="singleTask",
    excludeFromRecents="true", taskAffinity="com.rayquelabs.lifeos.assistant",
    windowSoftInputMode="adjustResize")
shortcut = ".AssistantShortcutActivity"
update_element(app, "activity", shortcut, exported="false",
    theme="@style/LifeOSOverlayPanel", excludeFromRecents="true",
    taskAffinity="com.rayquelabs.lifeos.shortcut")

# Preserve the component Android may already have saved as the user's assistant.
alias = update_element(app, "activity-alias", old_component, exported="true", targetActivity=shortcut)
if alias.find(f"intent-filter/action[@{{{ANDROID}}}name='{assist}']") is None:
    intent = ET.SubElement(alias, "intent-filter")
    update_element(intent, "action", assist)
    update_element(intent, "category", "android.intent.category.DEFAULT")

service = update_element(app, "service", ".AssistantOverlayService",
    exported="false", foregroundServiceType="specialUse")
update_element(service, "property", "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
    value="User-enabled draggable digital assistant over other Android applications")

for permission in ("SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_SPECIAL_USE"):
    update_element(base, "uses-permission", f"android.permission.{permission}")

queries = base.find("queries")
if queries is None:
    queries = ET.SubElement(base, "queries")
tts = "android.intent.action.TTS_SERVICE"
if queries.find(f"intent/action[@{{{ANDROID}}}name='{tts}']") is None:
    update_element(ET.SubElement(queries, "intent"), "action", tts)

ET.indent(tree, space="    ")
tree.write(manifest, encoding="utf-8", xml_declaration=True)

package_path = root / "java/com/rayquelabs/lifeos"
native = Path(__file__).parent
for source in native.glob("*.java"):
    shutil.copyfile(source, package_path / source.name)
shutil.copyfile(native / "overlay_styles.xml", root / "res/values/lifeos_overlay_styles.xml")
