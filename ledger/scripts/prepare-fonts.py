"""Build renamed, static OFL font subsets from the Google Fonts source files.

Usage: python3 scripts/prepare-fonts.py SOURCE_DIRECTORY
SOURCE_DIRECTORY must contain NotoSerifSC.ttf, LibreBaskerville.ttf and both OFL texts.
Requires fontTools. No network access; source URLs and hashes are recorded with the assets.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / "apps/client/assets/fonts"
target.mkdir(parents=True, exist_ok=True)
# The fixed GB2312 repertoire includes 6,763 common simplified Chinese ideographs.
# User labels/notes stay in system sans-serif; uncommon characters can use system fallback.
common = set(range(0x20, 0x100)) | set(range(0x2000, 0x2070)) | set(range(0x3000, 0x3040))
for high in range(0xA1, 0xF8):
    for low in range(0xA1, 0xFF):
        try:
            common.update(map(ord, bytes([high, low]).decode("gb2312")))
        except UnicodeDecodeError:
            pass
common.update(map(ord, "¥＋−×÷→←✓…，。 ·"))
manifest = []
licenses = []
reading_weight = 600
for original, name, repertoire, upstream in [
    ("NotoSerifSC", "LedgerSongti", common, "notoserifsc/NotoSerifSC%5Bwght%5D.ttf"),
    ("LibreBaskerville", "LedgerNumbers", set(range(0x20, 0x100)) | {0x2212, 0x2192}, "librebaskerville/LibreBaskerville%5Bwght%5D.ttf"),
]:
    path = source / (original + ".ttf")
    font = TTFont(path)
    font = instantiateVariableFont(font, {"wght": reading_weight}, inplace=True)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.name_legacy = True
    options.name_languages = [0x409]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=repertoire)
    worker.subset(font)
    # Use distinct derivative names, preserving source copyright/license records.
    font["name"].names = [r for r in font["name"].names if r.nameID not in (1, 2, 3, 4, 6, 16, 17)]
    for key, value in [(1, name), (2, "Regular"), (3, name + "-Regular"), (4, name), (6, name + "-Regular"), (16, name), (17, "Regular")]:
        font["name"].setName(value, key, 3, 1, 0x409)
    font.save(target / (name + ".ttf"))
    shutil.copyfile(source / (original + "-OFL.txt"), target / (original + "-OFL.txt"))
    licenses.append({"name": original, "text": (source / (original + "-OFL.txt")).read_text()})
    manifest.append({"asset": name + ".ttf", "source": "https://raw.githubusercontent.com/google/fonts/main/ofl/" + upstream, "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "weight": reading_weight, "codepoints": len(font.getBestCmap()), "license": original + "-OFL.txt"})
    print(name, "bytes:", (target / (name + ".ttf")).stat().st_size)
(target / "sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
(target / "licenses.json").write_text(json.dumps(licenses, ensure_ascii=False, indent=2) + "\n")
