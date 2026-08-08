#!/usr/bin/env python3
"""
SuperAgent rebrand script.

Runs inside the GitHub Actions `rebrand` job AFTER the Cherry Studio source tree
has been copied into the SuperAgent repo working directory. It performs
visible-branding string replacements, icon/logo handoff, Chinese-language
removal, and metadata (package.json / electron-builder.yml) fixes.

Design rules (per user instructions):
  * Change ONLY visible names / strings and the app icon/logo.
  * Do NOT touch functional code. In particular the `@cherrystudio/*` npm
    package scopes (1,300+ references) are preserved with a negative
    lookbehind so imports and workspace names keep working.
  * Remove Chinese text. zh locale JSON files are statically imported, so
    they are overwritten with English content (not deleted); standalone
    Chinese docs are deleted; residual CJK in source is stripped.
  * Author => Hyperspace Technologies <agent@superagent.ng>
"""

import json
import os
import re
import shutil
import sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")

# ---------------------------------------------------------------------------
# Branding token replacements (applied to every text file).
# Order matters: longest/most specific first.
# ---------------------------------------------------------------------------
TOKEN_REPLACEMENTS = [
    ("Cherry Studio", "SuperAgent"),
    ("CherryStudio", "SuperAgent"),
    ("CherryHQ", "Hyperspace Technologies"),
    ("kangfenmao", "hyperspace"),
    ("cherry-studio", "superagent"),
    ("cherry-ai.com", "superagent.ng"),
    # escaped form used inside regex literals (e.g. test assertions)
    ("cherry-ai\\.com", "superagent\\.ng"),
    # lowercase no-hyphen, but NEVER the @cherrystudio package scope.
    # Negative lookbehind for '@' preserves @cherrystudio/* imports & names.
    (re.compile(r"(?<!@)cherrystudio"), "superagent"),
    (re.compile(r"(?<!@)CherryAssistant"), "SuperAgent"),
]

# CJK ranges to strip from non-JSON text source (Chinese removal).
# Deliberately excludes JSON so Japanese (ja-jp.json) and other locale packs
# are preserved; zh JSON is overwritten with English separately.
CJK_RE = re.compile(
    "["
    "　-〿"   # CJK punctuation
    "㐀-䶿"   # CJK ext A
    "一-鿿"   # CJK unified
    "豈-﫿"   # CJK compatibility ideographs
    "＀-￯"   # fullwidth forms
    "]"
)

TEXT_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
    ".json", ".yml", ".yaml", ".md", ".markdown", ".html", ".htm",
    ".txt", ".nsh", ".plist", ".css", ".less", ".scss",
    ".env", ".example", ".toml", ".ini", ".sh", ".py",
}

SKIP_DIRS = {".git", "node_modules", ".next", "dist", "out", "release"}
SKIP_PATHS = {
    ".github/workflows/rebrand.yml",
    ".github/workflows/superagent-build.yml",
    "scripts/rebrand.py",
    "scripts/generate_icons.sh",
    "superagent_logo.svg",
}


def rel(path):
    return os.path.relpath(path, ROOT)


def is_text_file(path):
    ext = os.path.splitext(path)[1].lower()
    name = os.path.basename(path)
    if ext in TEXT_EXT or name in {".env", ".env.example", ".nvmrc", ".node-version"}:
        return True
    # fallback: sniff for null bytes
    try:
        with open(path, "rb") as f:
            return b"\x00" not in f.read(8192)
    except Exception:
        return False


def _is_japanese_locale(path):
    """Japanese locale packs reuse CJK characters and must be preserved."""
    name = os.path.basename(path).lower()
    return "ja-jp" in name or "ja_jp" in name or name == "ja.json"


def trim_electron_languages():
    """Remove Chinese from the bundled Electron language list."""
    yml = os.path.join(ROOT, "electron-builder.yml")
    if not os.path.exists(yml):
        return
    with open(yml, "r", encoding="utf-8") as f:
        lines = f.readlines()
    out = []
    for ln in lines:
        # strip trailing comments before comparing
        token = ln.strip().split("#", 1)[0].strip().lower()
        if token in ("- zh-cn", "- zh-tw", "- zh_cn", "- zh_tw"):
            continue
        out.append(ln)
    with open(yml, "w", encoding="utf-8") as f:
        f.writelines(out)
    changed_files.append("electron-builder.yml:electronLanguages")


def should_skip(path):
    r = rel(path)
    parts = r.split(os.sep)
    if any(p in SKIP_DIRS for p in parts):
        return True
    for sp in SKIP_PATHS:
        if r == sp or r.startswith(sp):
            return True
    return False


def apply_tokens(text):
    for tok, rep in TOKEN_REPLACEMENTS:
        if isinstance(tok, str):
            text = text.replace(tok, rep)
        else:
            text = tok.sub(rep, text)
    return text


changed_files = []


def walk_and_rebrand():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            if should_skip(fp):
                continue
            if not is_text_file(fp):
                continue
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    original = f.read()
            except Exception:
                continue
            new = apply_tokens(original)
            # strip residual Chinese (CJK) from every text file EXCEPT the
            # Japanese locale packs (ja-jp.json uses CJK chars and must stay).
            if not _is_japanese_locale(fp):
                new = CJK_RE.sub("", new)
            if new != original:
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(new)
                changed_files.append(rel(fp))


# ---------------------------------------------------------------------------
# Locale + Chinese-data handling
# ---------------------------------------------------------------------------
def copy_overwrite(src, dst):
    """Overwrite dst with src content (removes Chinese by substituting English)."""
    if os.path.exists(src) and os.path.exists(dst):
        shutil.copyfile(src, dst)
        changed_files.append("locale-en-overwrite:" + rel(dst))


def handle_chinese_locales():
    base = ROOT
    # renderer i18n
    r = os.path.join(base, "src/renderer/i18n")
    if os.path.isdir(r):
        copy_overwrite(os.path.join(r, "locales/en-us.json"), os.path.join(r, "locales/zh-cn.json"))
        copy_overwrite(os.path.join(r, "locales/en-us.json"), os.path.join(r, "translate/zh-tw.json"))
    # main i18n
    m = os.path.join(base, "src/main/i18n")
    if os.path.isdir(m):
        copy_overwrite(os.path.join(m, "locales/en-us.json"), os.path.join(m, "locales/zh-cn.json"))
        copy_overwrite(os.path.join(m, "locales/en-us.json"), os.path.join(m, "translate/zh-tw.json"))
    # painting templates
    p = os.path.join(base, "resources/data/painting-templates/locales")
    if os.path.isdir(p):
        copy_overwrite(os.path.join(p, "en-us.json"), os.path.join(p, "zh-cn.json"))
    # agents data
    a = os.path.join(base, "resources/data")
    if os.path.isdir(a):
        copy_overwrite(os.path.join(a, "agents-en.json"), os.path.join(a, "agents-zh.json"))


# Standalone Chinese docs / data to delete outright (no imports depend on them).
ZH_DELETE_GLOBS = [
    "resources/cherry-studio/privacy-zh.html",
    "src/renderer/routes/README.zh-CN.md",
    ".agents/skills/README.zh.md",
    ".claude/skills/README.zh.md",
    "v2-refactor-temp/docs/knowledge/rfc-local-embedding-and-ocr.zh-CN.md",
    "v2-refactor-temp/docs/knowledge/rfc-knowledge-workflow-architecture.zh-CN.md",
    "resources/builtin-agents/cherry-assistant/.claude/skills/cherry-assistant-guide/skill-zh-cn-template.md",
]


def delete_zh_docs():
    for relp in ZH_DELETE_GLOBS:
        fp = os.path.join(ROOT, relp)
        if os.path.exists(fp):
            os.remove(fp)
            changed_files.append("deleted-zh:" + relp)
    # any README.zh-CN.md / *.zh.md scattered anywhere
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".zh-CN.md") or fn.endswith(".zh.md"):
                fp = os.path.join(dirpath, fn)
                try:
                    os.remove(fp)
                    changed_files.append("deleted-zh:" + rel(fp))
                except Exception:
                    pass


# ---------------------------------------------------------------------------
# Metadata edits
# ---------------------------------------------------------------------------
def edit_package_json():
    pkg_path = os.path.join(ROOT, "package.json")
    with open(pkg_path, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    pkg["name"] = "SuperAgent"
    pkg["productName"] = "SuperAgent"
    pkg["description"] = "SuperAgent — a powerful AI assistant. Rebranded by Hyperspace Technologies."
    pkg["author"] = {
        "name": "Hyperspace Technologies",
        "email": "agent@superagent.ng",
    }
    if "homepage" in pkg or True:
        pkg["homepage"] = "https://github.com/DrOlu/SuperAgent"
    pkg["repository"] = {
        "type": "git",
        "url": "https://github.com/DrOlu/SuperAgent.git",
    }
    with open(pkg_path, "w", encoding="utf-8") as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
        f.write("\n")
    changed_files.append("package.json")


def edit_electron_builder_release_notes():
    """Replace the multilingual releaseNotes block with a clean SuperAgent note.
    The releaseInfo section is the last key in the file, so we truncate there."""
    yml = os.path.join(ROOT, "electron-builder.yml")
    if not os.path.exists(yml):
        return
    with open(yml, "r", encoding="utf-8") as f:
        text = f.read()
    idx = text.find("releaseNotes: |")
    if idx == -1:
        return
    head = text[:idx]
    new_tail = (
        "releaseNotes: |\n"
        "  SuperAgent — rebranded and maintained by Hyperspace Technologies.\n"
        "  Built from an open-source AI assistant codebase under its original license.\n"
    )
    with open(yml, "w", encoding="utf-8") as f:
        f.write(head + new_tail)
    changed_files.append("electron-builder.yml:releaseNotes")


def trim_language_picker():
    """Remove zh-CN / zh-TW from the visible language picker."""
    p = os.path.join(ROOT, "src/renderer/i18n/languages.ts")
    if not os.path.exists(p):
        return
    with open(p, "r", encoding="utf-8") as f:
        lines = f.readlines()
    out = [ln for ln in lines if "'zh-CN'" not in ln and "'zh-TW'" not in ln]
    with open(p, "w", encoding="utf-8") as f:
        f.writelines(out)
    changed_files.append("languages.ts")


def trim_i18next_config():
    p = os.path.join(ROOT, "i18next.config.ts")
    if not os.path.exists(p):
        return
    with open(p, "r", encoding="utf-8") as f:
        text = f.read()
    text = text.replace("locales: ['en-us', 'zh-cn']", "locales: ['en-us']")
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    changed_files.append("i18next.config.ts")


def main():
    print(f"[rebrand] root = {ROOT}")
    handle_chinese_locales()
    delete_zh_docs()
    walk_and_rebrand()
    edit_package_json()
    edit_electron_builder_release_notes()
    trim_electron_languages()
    trim_language_picker()
    trim_i18next_config()
    print(f"[rebrand] modified {len(changed_files)} files / operations")
    # summary log (first 200)
    for c in changed_files[:200]:
        print("  - " + c)
    if len(changed_files) > 200:
        print(f"  ... and {len(changed_files) - 200} more")
    print("[rebrand] done.")


if __name__ == "__main__":
    main()
