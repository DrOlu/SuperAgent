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
    # Built-in default assistant display name (ships in agent.json + presets).
    ("Cherry Assistant", "SuperAgent Assistant"),
    # zh-CN fallback branch in defaultAssistant.ts ("Cherry 助手").
    ("Cherry 助手", "SuperAgent 助手"),
    # Specific FIRST: source-repo GitHub paths -> the new home.
    # Must precede the generic CherryHQ token so these become a valid
    # owner/repo pair (DrOlu/SuperAgent) instead of "Hyperspace Technologies/...".
    ("CherryHQ/cherry-studio", "DrOlu/SuperAgent"),
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

SKIP_DIRS = {
    ".git", "node_modules", ".next", "dist", "out", "release",
    "patches",  # pnpm patches are byte-exact diffs vs upstream packages — must NOT be altered
}
SKIP_PATHS = {
    ".github/workflows/rebrand.yml",
    ".github/workflows/superagent-build.yml",
    ".github/workflows/sync-and-release.yml",
    ".github/workflows/release.yml",
    "scripts/rebrand.py",
    "scripts/generate_icons.sh",
    "superagent_logo.svg",
    # Functional: pin to the real better-sqlite3 binary release repo + its
    # test. The Linux build downloads a prebuilt native addon from here.
    "scripts/linux-native/release.json",
    "scripts/__tests__/linux-native.test.ts",
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


# A CJK run inside a string/regex literal. We replace the run itself, never the
# surrounding delimiters, so literals stay syntactically valid.
_CJK_RUN = re.compile(r'[一-鿿　-〿＀-￯]+')


def _is_test_file(path):
    r = rel(path)
    return "__tests__" in r or ".test." in os.path.basename(r) or ".spec." in os.path.basename(r)


def strip_cjk_safe(text):
    """Remove Chinese without breaking TS/JS syntax.

    - String literals "..." '...' and templates `...`: replace CJK runs with ''
    - Regex literals /.../flags: replace CJK runs with '.' (still compiles, broad match)
    - Line comments //... and block comments /* ... */: strip CJK runs to ''
    - Everything else (identifiers, keywords): untouched (no CJK there normally)

    Test files are skipped entirely by the caller (not shipped to users, and
    their assertions often match specific Chinese button labels).
    """
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        # line comment
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            if j == -1:
                j = n
            seg = text[i:j]
            out.append(_CJK_RUN.sub("", seg))
            i = j
            continue
        # block comment
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            if j == -1:
                j = n
            else:
                j += 2
            seg = text[i:j]
            out.append(_CJK_RUN.sub("", seg))
            i = j
            continue
        # double / single quoted string
        if ch in ("'", '"'):
            quote = ch
            j = i + 1
            buf = [quote]
            while j < n:
                c = text[j]
                if c == "\\" and j + 1 < n:
                    buf.append(text[j:j + 2])
                    j += 2
                    continue
                if c == quote:
                    buf.append(quote)
                    j += 1
                    break
                if _CJK_RUN.match(c):
                    # consume the whole CJK run
                    m = _CJK_RUN.match(text, j)
                    buf.append(_CJK_RUN.sub("", m.group(0)))
                    j = m.end()
                    continue
                buf.append(c)
                j += 1
            out.append("".join(buf))
            i = j
            continue
        # template literal `...`
        if ch == "`":
            j = i + 1
            buf = ["`"]
            while j < n:
                c = text[j]
                if c == "\\" and j + 1 < n:
                    buf.append(text[j:j + 2])
                    j += 2
                    continue
                if c == "`":
                    buf.append("`")
                    j += 1
                    break
                if _CJK_RUN.match(c):
                    m = _CJK_RUN.match(text, j)
                    buf.append(_CJK_RUN.sub("", m.group(0)))
                    j = m.end()
                    continue
                buf.append(c)
                j += 1
            out.append("".join(buf))
            i = j
            continue
        # regex literal: a '/' that looks like a regex (preceded by non-identifier)
        if ch == "/" and _looks_like_regex(text, i):
            j = i + 1
            buf = ["/"]
            while j < n:
                c = text[j]
                if c == "\\" and j + 1 < n:
                    buf.append(text[j:j + 2])
                    j += 2
                    continue
                if c == "/":
                    buf.append("/")
                    j += 1
                    # consume flags
                    while j < n and text[j] in "gimsuy":
                        buf.append(text[j])
                        j += 1
                    break
                if c == "[":
                    # char class — copy until closing ]
                    k = text.find("]", j)
                    if k == -1:
                        k = j
                    seg = text[j:k + 1]
                    buf.append(_CJK_RUN.sub(".", seg))
                    j = k + 1
                    continue
                if _CJK_RUN.match(c):
                    m = _CJK_RUN.match(text, j)
                    buf.append("." * len(m.group(0)))
                    j = m.end()
                    continue
                buf.append(c)
                j += 1
            out.append("".join(buf))
            i = j
            continue
        out.append(ch)
        i += 1
    return "".join(out)


_IDRE = re.compile(r'[A-Za-z0-9_$\]\)\'"]')


def _looks_like_regex(text, i):
    """Heuristic: a '/' at position i is a regex literal if the previous
    non-space char is not an identifier/paren/quote (i.e. not division)."""
    k = i - 1
    while k >= 0 and text[k] in " \t":
        k -= 1
    if k < 0:
        return True
    return not bool(_IDRE.match(text[k]))


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
            ext = os.path.splitext(fp)[1].lower()
            is_code = ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts")
            if is_code:
                # Code files: token replacement only. CJK inside string/regex
                # literals and identifiers is LEFT INTACT — stripping it
                # char-by-char breaks TS syntax (regex literals, duplicate
                # property keys, template strings). All user-facing Chinese is
                # removed via the locale-pack overwrite + JSON/doc stripping
                # below; residual CJK here is internal comments/log strings.
                pass
            else:
                # non-code text (md, yml, html, nsh, …) and non-Japanese JSON:
                # strip CJK runs outright. Preserve Japanese locale packs.
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
        "    SuperAgent — rebranded and maintained by Hyperspace Technologies.\n"
        "    Built from an open-source AI assistant codebase under its original license.\n"
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


def fix_distinct_exe_test():
    """BootConfigMigrator.test.ts uses two DISTINCT exe paths (spaced
    'Cherry Studio' vs CamelCase 'CherryStudio') as object keys to test
    migration merge logic. The blanket token replace collapses both to
    'SuperAgent', producing a duplicate computed property (TS1117).
    Restore distinctness by suffixing the legacy (OLD_EXE) path."""
    p = os.path.join(
        ROOT,
        "src/main/data/migration/v2/migrators/__tests__/BootConfigMigrator.test.ts",
    )
    if not os.path.exists(p):
        return
    with open(p, "r", encoding="utf-8") as f:
        text = f.read()
    # The OLD_EXE line was: '/Applications/SuperAgent.app/Contents/MacOS/SuperAgent'
    # Make it distinct so CURRENT_EXE != OLD_EXE (mirrors the original v1→v2 rename).
    text = text.replace(
        "const OLD_EXE = '/Applications/SuperAgent.app/Contents/MacOS/SuperAgent'",
        "const OLD_EXE = '/Applications/SuperAgentLegacy.app/Contents/MacOS/SuperAgentLegacy'",
    )
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    changed_files.append("BootConfigMigrator.test.ts:distinct-exe")


# ---------------------------------------------------------------------------
# SuperAgent provider / feature customizations (after generic rebrand)
# ---------------------------------------------------------------------------
def patch_provider_logo(logo_svg, patches):
    """Replace the CherryIN provider logo with the SuperAgent logo.

    The raw SVG at packages/ui/icons/providers/light/cherryin.svg is the
    codegen source, but the *generated* light.tsx embeds the path data inline
    and is what actually renders. We overwrite BOTH so the change takes effect
    without running `pnpm icons:generate` (which isn't available in the rebrand
    job). Also updates colorPrimary in index.tsx to match the logo's brand red.
    """
    import re as _re

    # Parse paths out of the logo SVG: <path d="..." fill="..."/>
    paths = []
    for m in _re.finditer(r'<path\s+([^/]*?)/>', logo_svg):
        attrs = m.group(1)
        d = (_re.search(r'd="([^"]*)"', attrs) or [None, ""])[1] if 'd="' in attrs else ""
        fill = (_re.search(r'fill="([^"]*)"', attrs) or [None, ""])[1] if 'fill="' in attrs else "#000"
        d = d.strip()
        if d:
            paths.append((fill, d))
    # viewBox
    vb = (_re.search(r'viewBox="([^"]*)"', logo_svg) or [None, "0 0 512 512"])[1] if 'viewBox="' in logo_svg else "0 0 512 512"

    if not paths:
        patches.append("provider logo: WARN no paths found in SVG, skipping")
        return

    # 1. raw cherryin.svg (codegen source) — write the SuperAgent SVG, sized 120x120
    raw_svg = os.path.join(ROOT, "packages/ui/icons/providers/light/cherryin.svg")
    raw_content = (
        '<svg width="120" height="120" viewBox="' + vb + '" fill="none" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        + "".join(f'<path d="{d}" fill="{fill}"/>\n' for fill, d in paths)
        + '</svg>\n'
    )
    with open(raw_svg, "w", encoding="utf-8") as f:
        f.write(raw_content)
    patches.append("light/cherryin.svg → SuperAgent logo (raw)")

    # 2. generated light.tsx — embed the SuperAgent path data inline (this renders)
    light_tsx = os.path.join(ROOT, "packages/ui/src/components/icons/providers/cherryin/light.tsx")
    path_jsx = "".join(f'    <path fill="{fill}" d="{d}" />\n' for fill, d in paths)
    tsx_content = (
        "import type { SVGProps } from 'react'\n\n"
        "import type { IconComponent } from '../../types'\n"
        "const CherryinLight: IconComponent = (props: SVGProps<SVGSVGElement>) => (\n"
        '  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" '
        'viewBox="' + vb + '" {...props}>\n'
        + path_jsx +
        "  </svg>\n)\n"
        "export { CherryinLight }\n"
        "export default CherryinLight\n"
    )
    with open(light_tsx, "w", encoding="utf-8") as f:
        f.write(tsx_content)
    patches.append("cherryin/light.tsx → SuperAgent logo (generated, renders)")

    # 3. index.tsx — colorPrimary #FF5F5F → #CC1100 (SuperAgent brand red)
    idx_tsx = os.path.join(ROOT, "packages/ui/src/components/icons/providers/cherryin/index.tsx")
    if os.path.exists(idx_tsx):
        with open(idx_tsx, "r", encoding="utf-8") as f:
            t = f.read()
        t = t.replace("colorPrimary: '#FF5F5F'", "colorPrimary: '#CC1100'")
        with open(idx_tsx, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("cherryin/index.tsx → colorPrimary #CC1100")


def apply_superagent_patches():
    """Targeted SuperAgent-specific changes beyond the generic Cherry→SuperAgent
    token rebrand: provider rename, API host, OAuth→Paystack button, update feed,
    in-app + provider logo, version bump."""
    patches = []

    # Read the SuperAgent logo SVG (copied into repo root by the workflow)
    logo_svg_path = os.path.join(ROOT, "superagent_logo.svg")
    logo_svg = ""
    if os.path.exists(logo_svg_path):
        with open(logo_svg_path, "r", encoding="utf-8") as f:
            logo_svg = f.read()

    # 1. CherryIN provider logo → SuperAgent logo (overwrite the SVG)
    cherryin_svg = os.path.join(ROOT, "packages/ui/icons/providers/light/cherryin.svg")
    if os.path.exists(cherryin_svg) and logo_svg:
        sa = logo_svg.replace('width="32" height="32"', 'width="120" height="120"')
        with open(cherryin_svg, "w", encoding="utf-8") as f:
            f.write(sa)
        patches.append("cherryin.svg → SuperAgent logo")

    # 2. Provider display name CherryIN → SuperAgent + API host → api.superagent.ng
    #    Also repoint console/docs/official URLs (open.cherryin.ai → SuperAgent).
    for p in [
        "packages/provider-registry/data/providers.json",
        "packages/provider-registry/src/providers/cherryin.ts",
    ]:
        fp = os.path.join(ROOT, p)
        if not os.path.exists(fp):
            continue
        with open(fp, "r", encoding="utf-8") as f:
            t = f.read()
        t = t.replace('"name": "CherryIN"', '"name": "SuperAgent"')
        t = t.replace("name: 'CherryIN'", "name: 'SuperAgent'")
        t = t.replace("CherryIN - AI model provider", "SuperAgent - AI model provider")
        t = t.replace("https://open.cherryin.net", "https://api.superagent.ng")
        # console/token (get API key) → Paystack, consistent with the button
        t = t.replace("https://open.cherryin.ai/console/token", "https://paystack.com/buy/reactor-api-key")
        # docs / pricing / official → SuperAgent site
        t = t.replace("https://open.cherryin.ai/pricing", "https://superagent.ng")
        t = t.replace("https://open.cherryin.ai", "https://superagent.ng")
        with open(fp, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append(p + " (name + API host + URLs)")

    # 3. i18n: login_button → "Obtain API Key" (English first), then CherryIN → SuperAgent
    i18n_dir = os.path.join(ROOT, "src/renderer/i18n")
    if os.path.isdir(i18n_dir):
        for dirpath, _dn, filenames in os.walk(i18n_dir):
            for fn in filenames:
                if not fn.endswith(".json"):
                    continue
                fp = os.path.join(dirpath, fn)
                with open(fp, "r", encoding="utf-8") as f:
                    t = f.read()
                orig = t
                # English login_button → "Obtain API Key" (before blanket replace)
                t = t.replace('"Authorize with CherryIN"', '"Obtain API Key"')
                # Remaining CherryIN → SuperAgent (display name, descriptions, etc.)
                t = t.replace("CherryIN", "SuperAgent")
                # service_attribution + any residual cherryin.ai → superagent.ng
                t = t.replace("open.cherryin.ai", "superagent.ng")
                if t != orig:
                    with open(fp, "w", encoding="utf-8") as f:
                        f.write(t)
                    patches.append("i18n:" + os.path.relpath(fp, ROOT))

    # 4. "Authorize" button → "Obtain API Key" opening Paystack.
    #    Redirect handleOAuthLogin to open Paystack instead of running OAuth,
    #    so the existing handler (and its button onClick) stays wired up and
    #    no longer trips tsgo's noUnusedLocals (TS6133).
    oauth_cmp = os.path.join(
        ROOT,
        "src/renderer/pages/settings/ProviderSettings/ProviderSpecific/CherryInOauth.tsx",
    )
    if os.path.exists(oauth_cmp):
        with open(oauth_cmp, "r", encoding="utf-8") as f:
            t = f.read()
        # Insert the Paystack redirect as the first line of handleOAuthLogin's
        # try block, immediately after `try {`, so it returns before any OAuth.
        t = t.replace(
            "  const handleOAuthLogin = useCallback(async () => {\n    try {\n",
            "  const handleOAuthLogin = useCallback(async () => {\n    try {\n"
            "      // Obtain an API key via Paystack instead of running OAuth.\n"
            "      window.open('https://paystack.com/buy/reactor-api-key', '_blank')\n"
            "      return\n",
        )
        with open(oauth_cmp, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("CherryInOauth.tsx → Paystack redirect")

    # 5. Update feed: GitHub behind the scenes, visible → superagent.ng/downloads.html
    yml = os.path.join(ROOT, "electron-builder.yml")
    if os.path.exists(yml):
        with open(yml, "r", encoding="utf-8") as f:
            t = f.read()
        t = t.replace(
            "publish:\n  provider: generic\n  url: https://releases.superagent.ng",
            "publish:\n  provider: github\n  owner: DrOlu\n  repo: SuperAgent",
        )
        with open(yml, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("electron-builder.yml publish → github DrOlu/SuperAgent")

    # 5a. About / Feedback link overrides
    #     The generic token replace turns cherry-ai.com -> superagent.ng and
    #     CherryHQ/cherry-studio -> DrOlu/SuperAgent, but the About page and
    #     app menu need to point at specific destination pages. Override here
    #     AFTER the generic rebrand so these win.
    about = os.path.join(ROOT, "src/renderer/pages/settings/AboutSettings/AboutSettings.tsx")
    if os.path.exists(about):
        with open(about, "r", encoding="utf-8") as f:
            t = f.read()
        # Official Website -> https://superagent.ng/
        t = t.replace("onOpenWebsite('https://superagent.ng/downloads.html')", "onOpenWebsite('https://superagent.ng/')")
        # ensure bare https://superagent.ng has trailing slash
        t = t.replace("onOpenWebsite('https://superagent.ng')", "onOpenWebsite('https://superagent.ng/')")
        # Documentation -> https://superagent.ng/documentation.html
        t = t.replace("'https://docs.superagent.ng/'", "'https://superagent.ng/documentation.html'")
        t = t.replace("'https://docs.superagent.ng/docs/en-us'", "'https://superagent.ng/documentation.html'")
        # Enterprise -> https://superagent.ng/enterprise.html
        t = t.replace("onOpenWebsite('https://enterprise.superagent.ng')", "onOpenWebsite('https://superagent.ng/enterprise.html')")
        with open(about, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("AboutSettings.tsx → website /docs /enterprise override")

    # Feedback dialog + app menu: documentation & releases links
    feedback = os.path.join(ROOT, "src/renderer/pages/settings/FeedbackDialog.tsx")
    if os.path.exists(feedback):
        with open(feedback, "r", encoding="utf-8") as f:
            t = f.read()
        t = t.replace("'https://docs.superagent.ng/'", "'https://superagent.ng/documentation.html'")
        with open(feedback, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("FeedbackDialog.tsx → documentation.html")

    app_menu = os.path.join(ROOT, "src/main/services/AppMenuService.ts")
    if os.path.exists(app_menu):
        with open(app_menu, "r", encoding="utf-8") as f:
            t = f.read()
        # website -> https://superagent.ng/
        t = t.replace("shell.openExternal('https://superagent.ng')", "shell.openExternal('https://superagent.ng/')")
        # documentation -> https://superagent.ng/documentation.html
        t = t.replace("shell.openExternal('https://superagent.ng/docs')", "shell.openExternal('https://superagent.ng/documentation.html')")
        with open(app_menu, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("AppMenuService.ts → website /docs override")

    # 5b. Replace the CherryIN provider logo with the SuperAgent logo
    #     (overwrites the generated light.tsx that renders, not just the raw .svg)
    if logo_svg:
        patch_provider_logo(logo_svg, patches)

    # 5c. Login text changes on the CherryIN OAuth card
    i18n_files = [
        os.path.join(ROOT, "src/renderer/i18n/locales/en-us.json"),
        os.path.join(ROOT, "src/renderer/i18n/locales/zh-cn.json"),
    ]
    for dp in ["translate", "locales"]:
        d = os.path.join(ROOT, "src/renderer/i18n", dp)
        if os.path.isdir(d):
            for fn in os.listdir(d):
                if fn.endswith(".json"):
                    i18n_files.append(os.path.join(d, fn))
    for ip in i18n_files:
        if not os.path.exists(ip):
            continue
        with open(ip, "r", encoding="utf-8") as f:
            t = f.read()
        orig = t
        t = t.replace("After you sign in, you can use all model services",
                      "Obtain Key and access model services")
        # "Not logged in" only in the cherryIn oauth block — use the key-anchored
        # form to avoid touching unrelated "Not logged in" strings elsewhere.
        t = t.replace('"not_logged_in": "Not logged in"',
                      '"not_logged_in": "Obtain Key"')
        if t != orig:
            with open(ip, "w", encoding="utf-8") as f:
                f.write(t)
    patches.append("i18n: not_logged_in → 'Obtain Key'; tagline → 'Obtain Key and access model services'")

    # 5d. Rename physical resource directories.
    #     The generic `cherry-studio` -> `superagent` token replacement renames
    #     the PATH in code (e.g. `resources/superagent/release-history.json`) but
    #     not the physical directory on disk. The vite build reads these at
    #     config-load time and crashes with ENOENT if the dir name doesn't match.
    for old, new in [
        ("resources/cherry-studio", "resources/superagent"),
    ]:
        old_path = os.path.join(ROOT, old)
        new_path = os.path.join(ROOT, new)
        if os.path.isdir(old_path):
            if os.path.exists(new_path):
                # merge — move each file into the existing target
                for item in os.listdir(old_path):
                    src = os.path.join(old_path, item)
                    dst = os.path.join(new_path, item)
                    if os.path.isdir(src):
                        shutil.move(src, dst)
                    else:
                        shutil.copy2(src, dst)
                    os.remove(src) if os.path.isfile(src) else None
                os.rmdir(old_path)
            else:
                os.rename(old_path, new_path)
            patches.append(f"renamed {old}/ -> {new}/")

    # 6. Version bump → 2.0.6
    pkg = os.path.join(ROOT, "package.json")
    if os.path.exists(pkg):
        with open(pkg, "r", encoding="utf-8") as f:
            t = f.read()
        # bump from any prior SuperAgent version to 2.0.6
        t = t.replace('"version": "2.0.5"', '"version": "2.0.6"')
        t = t.replace('"version": "2.0.4"', '"version": "2.0.6"')
        # fall back if upstream reset it
        if not any(v in t for v in ('"version": "2.0.6"', '"version": "2.0.5"', '"version": "2.0.4"')):
            t = t.replace('"version": "2.0.3"', '"version": "2.0.6"')
        with open(pkg, "w", encoding="utf-8") as f:
            f.write(t)
        patches.append("package.json version → 2.0.6")

    # 6b. Inject the bumped version into release-history.json.
    #     electron-vite validates that the current package.json version
    #     exists in resources/superagent/release-history.json at build time
    #     (throws "must contain current stable version"). Upstream only has
    #     cherry-studio versions, so add our SuperAgent entry to the front.
    import json as _json
    hist_path = os.path.join(ROOT, "resources/superagent/release-history.json")
    if os.path.exists(hist_path):
        try:
            with open(hist_path, "r", encoding="utf-8") as f:
                hist = _json.load(f)
            # read the version we just wrote to package.json
            with open(pkg, "r", encoding="utf-8") as f:
                cur_ver = _json.load(f).get("version", "2.0.6")
            if isinstance(hist, list):
                if not any(e.get("version") == cur_ver for e in hist if isinstance(e, dict)):
                    notes = (
                        "<!--LANG:en-->\n"
                        "SuperAgent " + cur_ver + " — synced from the open-source Cherry Studio codebase.\n"
                        "Rebranded and maintained by Hyperspace Technologies.\n\n"
                        "<!--LANG:zh-CN-->\n"
                        "SuperAgent " + cur_ver + " — synced from the open-source Cherry Studio codebase.\n"
                        "Rebranded and maintained by Hyperspace Technologies.\n\n"
                        "<!--LANG:END-->"
                    )
                    hist.insert(0, {"version": cur_ver, "releaseNotes": notes})
                    with open(hist_path, "w", encoding="utf-8") as f:
                        _json.dump(hist, f, ensure_ascii=False, indent=2)
                    patches.append("release-history.json: injected " + cur_ver)
        except Exception as e:
            patches.append("release-history.json: WARN " + str(e)[:60])

    print(f"[patches] applied {len(patches)} SuperAgent-specific patches:")
    for p in patches:
        print("  - " + p)


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
    fix_distinct_exe_test()
    apply_superagent_patches()
    print(f"[rebrand] modified {len(changed_files)} files / operations")
    # summary log (first 200)
    for c in changed_files[:200]:
        print("  - " + c)
    if len(changed_files) > 200:
        print(f"  ... and {len(changed_files) - 200} more")
    print("[rebrand] done.")


if __name__ == "__main__":
    main()
