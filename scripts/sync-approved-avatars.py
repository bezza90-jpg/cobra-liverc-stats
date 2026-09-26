"""Publish only approved, class-specific car avatars from the COBRA private review app."""

import argparse
import base64
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "public/data/avatar-upload-config.json"
MANIFEST = ROOT / "public/data/car-avatars.json"
REVISIONS = ROOT / "public/data/car-avatar-source-revisions.json"
CLASS_SUFFIX = {
    "2-Wheel Drive Buggy": "2WD", "4-Wheel Drive Buggy": "4WD", "Vintage": "VINTAGE",
    "Trucks": "TRUCKS", "Junior Racers": "JUNIORS"
}
KEY = re.compile(r"^[A-Z0-9_-]+$")
ID = re.compile(r"^[0-9a-f-]{36}$", re.I)
FILE_ID = re.compile(r"^[A-Za-z0-9_-]{10,}$")
HIDDEN_DRIVER_KEYS = {"BOB-BOBTECH-GELSTHARP"}


def read_json(path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except FileNotFoundError:
        return {}


def request_jsonp(url, params):
    query = urllib.parse.urlencode({**params, "callback": "cobraAvatarSync"})
    request = urllib.request.Request(f"{url}?{query}", headers={"User-Agent": "COBRA-avatar-sync/1.0"})
    with urllib.request.urlopen(request, timeout=50) as response:
        body = response.read(5_000_001).decode("utf-8")
    match = re.fullmatch(r"cobraAvatarSync\((\{.*\})\);?\s*", body, flags=re.S)
    if not match:
        raise ValueError("The avatar approval response was incomplete.")
    result = json.loads(match[1])
    if not result.get("ok"):
        raise ValueError(result.get("error", "The avatar approval feed failed."))
    return result


def state():
    url = str(read_json(CONFIG).get("webAppUrl", "")).strip()
    if not url:
        return "", {}, read_json(REVISIONS), {}
    if not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec", url):
        raise ValueError("The avatar upload web app URL is invalid.")
    records = request_jsonp(url, {"action": "list"}).get("avatars", [])
    current = {}
    photo_ids = {}
    for entry in records:
        key, cls = str(entry.get("driverKey", "")), str(entry.get("className", ""))
        ident, revision = str(entry.get("id", "")), str(entry.get("revision", ""))
        if key not in HIDDEN_DRIVER_KEYS and KEY.fullmatch(key) and cls in CLASS_SUFFIX and ID.fullmatch(ident) and FILE_ID.fullmatch(revision):
            pair = f"{key}|{cls}"
            current[pair] = revision
            photo_ids[pair] = ident
    return url, current, read_json(REVISIONS), photo_ids


def prepare_avatar(photo_bytes):
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(photo_bytes)) as loaded:
        original = ImageOps.exif_transpose(loaded).convert("RGBA")
    original.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    if original.getchannel("A").getextrema()[0] < 255:
        # Preserve the cutout explicitly reviewed and approved in the browser.
        cutout = original
    else:
        from rembg import new_session, remove
        cutout = remove(original.convert("RGB"), session=new_session("u2netp")).convert("RGBA")
    bbox = cutout.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("No foreground car was found in the reviewed photograph.")
    cutout = cutout.crop(bbox)
    cutout.thumbnail((640, 640), Image.Resampling.LANCZOS)
    pad = max(8, round(max(cutout.size) * .06))
    canvas = Image.new("RGBA", (cutout.width + 2 * pad, cutout.height + 2 * pad))
    canvas.alpha_composite(cutout, (pad, pad))
    blob = io.BytesIO()
    canvas.save(blob, "PNG", optimize=True)
    while blob.tell() > 380_000 and min(canvas.size) > 170:
        canvas.thumbnail((round(canvas.width * .8), round(canvas.height * .8)), Image.Resampling.LANCZOS)
        blob = io.BytesIO()
        canvas.save(blob, "PNG", optimize=True)
    if blob.tell() > 380_000:
        raise ValueError("The transparent avatar is too large for the podium image.")
    return blob.getvalue()


def publish():
    url, current, previous, photo_ids = state()
    if not url:
        print("Avatar approvals are not configured; skipping.")
        return
    manifest = read_json(MANIFEST)
    changes = 0
    for pair, revision in current.items():
        if previous.get(pair) == revision:
            continue
        driver_key, cls = pair.split("|", 1)
        ident = photo_ids[pair]
        photo = request_jsonp(url, {"action": "image", "id": ident})
        if str(photo.get("id")) != ident:
            raise ValueError("The approved photo ID did not match its listing.")
        decoded = base64.b64decode(photo["base64"], validate=True)
        if not decoded or len(decoded) > 3_000_000:
            raise ValueError("The approved photo is too large.")
        avatar_bytes = prepare_avatar(decoded)
        relative = f"assets/car-avatars/{driver_key}-AUTO-{CLASS_SUFFIX[cls]}.png"
        target = ROOT / "public" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(avatar_bytes)
        existing = manifest.get(driver_key, {})
        entry = dict(existing) if isinstance(existing, dict) else {"default": existing} if isinstance(existing, str) and existing else {}
        entry[cls] = relative
        manifest[driver_key] = entry
        previous[pair] = revision
        changes += 1

    for pair in set(previous) - set(current):
        driver_key, cls = pair.split("|", 1)
        existing = manifest.get(driver_key)
        expected = f"assets/car-avatars/{driver_key}-AUTO-{CLASS_SUFFIX[cls]}.png"
        if isinstance(existing, dict) and existing.get(cls) == expected:
            entry = dict(existing)
            entry.pop(cls)
            manifest[driver_key] = entry if entry else ""
            if not entry:
                manifest.pop(driver_key)
            (ROOT / "public" / expected).unlink(missing_ok=True)
        previous.pop(pair)
        changes += 1

    if changes:
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        REVISIONS.write_text(json.dumps(previous, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Approved avatar assignments updated: {changes}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        url, current, previous, _ = state()
        print("yes" if url and current != previous else "no")
    else:
        publish()
