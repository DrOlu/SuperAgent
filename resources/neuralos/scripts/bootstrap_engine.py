#!/usr/bin/env python3
"""Bootstrap a Needle 3 standalone engine bundle — no jax, no training stack.

Downloads the prebuilt engine binary for a platform, copies the base
needle3.cact weights beside it, and prints the exact command to run. Works
on macOS, Linux and Windows (Python 3.9+).

Usage:
    python bootstrap_engine.py                       # auto-detect this platform
    python bootstrap_engine.py --platform linux-arm64
    python bootstrap_engine.py --platform windows-x86_64 --dest C:\\needle

Requires `pip install cactus-needle` in the Python running this script (the
fetch machinery comes from the package). The produced bundle itself needs no
Python at runtime.

Afterwards the bundle is fully offline-portable: copy the whole folder to
any matching machine and run needle/needle.exe from it.
"""

import argparse
import platform as host
import shutil
import sys


def detect_platform() -> str:
    machine = host.machine().lower()
    system = sys.platform
    if system == "darwin":
        if machine in ("arm64", "aarch64"):
            return "macos-arm64"
        raise SystemExit("unsupported macOS architecture: "
                         f"{machine} (no x86_64 macOS build is published)")
    if system.startswith("linux"):
        return {"x86_64": "linux-x86_64", "amd64": "linux-x86_64",
                "aarch64": "linux-arm64", "armv7l": "linux-armv7",
                "armv8l": "linux-arm64",
                "riscv64": "linux-riscv64"}.get(machine, None) or _fail(machine)
    if system == "win32":
        return {"amd64": "windows-x86_64", "x86_64": "windows-x86_64",
                "arm64": "windows-arm64"}.get(machine, None) or _fail(machine)
    raise SystemExit(f"unsupported system: {system} ({machine}); "
                     "pass --platform explicitly")


def _fail(machine: str):
    raise SystemExit(f"no published engine for {machine}; "
                     "pass --platform explicitly (see engine-binary.md)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--platform", help="engine platform to download "
                        "(default: auto-detect this machine)")
    parser.add_argument("--dest", help="destination directory "
                        "(default: ./<platform>)")
    parser.add_argument("--list", action="store_true",
                        help="list published platforms and exit")
    args = parser.parse_args()

    try:
        from needle.agent import fetch
    except ImportError:
        raise SystemExit("cactus-needle is not installed for this Python "
                         f"({sys.executable}). Run: "
                         f"{sys.executable} -m pip install cactus-needle")

    if args.list:
        print("published platforms:")
        for name in fetch.PLATFORMS:
            print(f"  {name}")
        return

    plat = args.platform or detect_platform()
    if plat not in fetch.PLATFORMS:
        raise SystemExit(f"unknown platform {plat!r}; "
                         f"known: {', '.join(fetch.PLATFORMS)}")

    import os
    dest = args.dest or plat
    print(f"downloading engine bundle for {plat} -> {dest}/ ...", flush=True)
    files = fetch.download_platform(plat, os.path.dirname(os.path.abspath(dest))
                                   or ".", generation=3,
                                   dest=os.path.abspath(dest))
    for path in files:
        print(f"  {path}")

    print("fetching base weights (needle3.cact, ~35 MB, cached) ...", flush=True)
    weights = fetch.fetch_weights(generation=3)
    target = os.path.join(os.path.abspath(dest), os.path.basename(weights))
    if os.path.abspath(weights) != os.path.abspath(target):
        shutil.copyfile(weights, target)
    print(f"  {target}")

    binary = next((f for f in files if os.path.basename(f) in
                   ("needle", "needle.exe")), None)
    print("\nready. answer one query and exit with:")
    if binary:
        if sys.platform == "win32":
            print(f'  {binary} --model needle3.cact --tools tools.json '
                  '--prompt "your question"')
        else:
            print(f'  {binary} --model needle3.cact --tools tools.json '
                  '--prompt "your question"')
    print("or serve HTTP on :8080 with:  ... --serve")
    print("the binary emits the chosen call as JSON; it does not execute "
          "tools — run them yourself. tools.json can be produced with "
          "export_tools.py.")


if __name__ == "__main__":
    main()
