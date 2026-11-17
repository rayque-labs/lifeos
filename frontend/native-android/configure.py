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
main.set(f"{{{ANDROID}}}theme", "@style/LifeOSLaunchTheme")

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
    exported="false", foregroundServiceType="specialUse|microphone")
update_element(service, "property", "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
    value="User-enabled draggable digital assistant over other Android applications")

for permission in ("SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_SPECIAL_USE", "FOREGROUND_SERVICE_MICROPHONE", "FOREGROUND_SERVICE_MEDIA_PROJECTION", "RECORD_AUDIO"):
    update_element(base, "uses-permission", f"android.permission.{permission}")

update_element(app, "activity", ".PhotoTrashActivity", exported="false", theme="@style/LifeOSOverlayPanel")
for permission in ("READ_MEDIA_IMAGES", "READ_MEDIA_VISUAL_USER_SELECTED", "ACCESS_MEDIA_LOCATION"):
    update_element(base, "uses-permission", f"android.permission.{permission}")
update_element(base, "uses-permission", "android.permission.READ_EXTERNAL_STORAGE", maxSdkVersion="32")

queries = base.find("queries")
if queries is None:
    queries = ET.SubElement(base, "queries")
for action in ("android.intent.action.TTS_SERVICE", "android.speech.RecognitionService"):
    if queries.find(f"intent/action[@{{{ANDROID}}}name='{action}']") is None:
        update_element(ET.SubElement(queries, "intent"), "action", action)

update_element(app, "service", ".ScreenReadingService", exported="false", foregroundServiceType="mediaProjection")

legacy_controls = app.find(f"service[@{{{ANDROID}}}name='.TophAccessibilityService']")
if legacy_controls is not None:
    app.remove(legacy_controls)

for package in ("com.whatsapp", "com.whatsapp.w4b", "com.android.chrome", "com.instagram.android", "com.facebook.katana", "com.facebook.lite",
                "com.google.android.calendar", "com.google.android.calculator", "com.google.android.keep"):
    update_element(queries, "package", package)

ET.indent(tree, space="    ")
network_config = root / "res/xml/lifeos_network_security.xml"
network_config.parent.mkdir(parents=True, exist_ok=True)
network_config.write_text("""<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
</network-security-config>
""", encoding="utf-8")
app.set(f"{{{ANDROID}}}networkSecurityConfig", "@xml/lifeos_network_security")
tree.write(manifest, encoding="utf-8", xml_declaration=True)

package_path = root / "java/com/rayquelabs/lifeos"
native = Path(__file__).parent
for source in native.glob("*.java"):
    if source.name == "TophAccessibilityService.java":
        (package_path / source.name).unlink(missing_ok=True)
        continue
    shutil.copyfile(source, package_path / source.name)
for style in ("overlay_styles.xml", "launch_styles.xml"):
    shutil.copyfile(native / style, root / "res/values" / f"lifeos_{style}")


app_gradle = root.parents[1] / "build.gradle"
gradle = app_gradle.read_text()
mlkit = "    implementation 'com.google.mlkit:text-recognition:16.0.1'"
if mlkit not in gradle:
    if "dependencies {" not in gradle:
        raise ValueError("Bloco de dependências Android ausente")
    app_gradle.write_text(gradle.replace("dependencies {", "dependencies {\n" + mlkit, 1))
