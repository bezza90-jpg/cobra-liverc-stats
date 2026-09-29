"""Publish only approved, class-specific car avatars from the COBRA private review app."""

import argparse
import base64
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "public/data/avatar-upload-config.json"
MANIFEST = ROOT / "public/data/car-avatars.json"
REVISIONS = ROOT / "public/data/car-avatar-source-revisions.json"
REPORT = ROOT / "public/data/car-avatar-processing.json"
THUMBNAILS = ROOT / "public/assets/car-avatar-thumbnails"
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
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=50) as response:
                raw = response.read(5_000_001)
            if len(raw) > 5_000_000:
                raise ValueError('The approval feed exceeds the size limit.')
            body = raw.decode('utf-8')
            break
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3: raise
            time.sleep(2 ** attempt)
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
    if not isinstance(records, list):
        raise ValueError('Invalid approval list; existing published avatars are preserved.')
    current = {}
    photo_ids = {}
    for entry in records:
        if not isinstance(entry, dict): raise ValueError('Malformed avatar record; aborting safely.')
        key, cls = str(entry.get("driverKey", "")), str(entry.get("className", ""))
        ident, revision = str(entry.get("id", "")), str(entry.get("revision", ""))
        if not (KEY.fullmatch(key) and cls in CLASS_SUFFIX and ID.fullmatch(ident) and FILE_ID.fullmatch(revision)):
            raise ValueError('Invalid approved avatar record; existing assets are preserved.')
        if key not in HIDDEN_DRIVER_KEYS:
            pair = f"{key}|{cls}"
            current[pair] = revision
            photo_ids[pair] = ident
    return url, current, read_json(REVISIONS), photo_ids


def prepare_avatar(photo_bytes):
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(photo_bytes)) as loaded:
        original = ImageOps.exif_transpose(loaded).convert("RGBA")
    original.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    # The review canvas can pad an unprocessed rectangular photo with transparency.
    # Only transparency INSIDE the foreground bounds indicates an actual cutout.
    bounds = original.getchannel('A').getbbox()
    if not bounds: raise ValueError('The reviewed photograph is fully transparent.')
    original = original.crop(bounds)
    alpha = original.getchannel('A')
    # Ignore a thin antialiased border from resizing a rectangular photo.
    inset = min(3, (min(original.size) - 1) // 2)
    interior = alpha.crop((inset, inset, original.width - inset, original.height - inset))
    histogram = interior.histogram()
    transparent_fraction = sum(histogram[:128]) / max(1, interior.width * interior.height)
    if transparent_fraction > 0.01:
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


def thumbnail_path(avatar_path):
    return THUMBNAILS / (avatar_path.stem + ".webp")


def write_thumbnail(avatar_path):
    from PIL import Image

    target = thumbnail_path(avatar_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(avatar_path) as image:
        image = image.convert("RGBA")
        image.thumbnail((360, 200), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=82, method=6, lossless=False)


def needs_processing(current, previous, photo_ids, retry_id=''):
    manifest = read_json(MANIFEST)
    if retry_id and retry_id not in photo_ids.values():
        raise ValueError('Retry submission is not in the current approved feed.')
    if current != previous or retry_id: return True
    for pair in current:
        key, cls = pair.split('|', 1)
        entry = manifest.get(key, {})
        path = entry.get(cls, '') if isinstance(entry, dict) else ''
        if not path or not (ROOT / 'public' / path).is_file(): return True
    return False


def publish(retry_id=''):
    url, current, previous, photo_ids = state()
    if not url:
        print("Avatar approvals are not configured; skipping.")
        return
    manifest = read_json(MANIFEST)
    if retry_id and retry_id not in photo_ids.values():
        raise ValueError('Retry submission is not in the current approved feed.')
    failures = {}
    changes = 0
    for pair, revision in current.items():
        existing = manifest.get(pair.split('|', 1)[0], {})
        assigned = existing.get(pair.split('|', 1)[1], '') if isinstance(existing, dict) else ''
        if previous.get(pair) == revision and photo_ids[pair] != retry_id and assigned and (ROOT / 'public' / assigned).is_file():
            continue
        driver_key, cls = pair.split("|", 1)
        ident = photo_ids[pair]
        try:
            photo = request_jsonp(url, {"action": "image", "id": ident})
            if str(photo.get("id")) != ident or (photo.get('revision') and photo['revision'] != revision):
                raise ValueError("The approved photo changed during processing. Retry the refresh.")
            decoded = base64.b64decode(photo["base64"], validate=True)
            if not decoded or len(decoded) > 3_000_000:
                raise ValueError("The approved photo is too large.")
            avatar_bytes = prepare_avatar(decoded)
        except Exception as error:
            # Keep the previous avatar and continue other submissions. Do not leak URLs/tokens.
            message = str(error) if isinstance(error, ValueError) else type(error).__name__ + ' while downloading or removing the background; see workflow log.'
            failures[pair] = {'id': ident, 'revision': revision, 'error': message[:300]}
            print(f'::warning::Avatar {ident}: {message[:300]}', file=sys.stderr)
            continue
        relative = f"assets/car-avatars/{driver_key}-AUTO-{CLASS_SUFFIX[cls]}.png"
        target = ROOT / "public" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(avatar_bytes)
        write_thumbnail(target)
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
            removed_avatar = ROOT / "public" / expected
            removed_avatar.unlink(missing_ok=True)
            thumbnail_path(removed_avatar).unlink(missing_ok=True)
        previous.pop(pair)
        changes += 1

    if changes:
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        REVISIONS.write_text(json.dumps(previous, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Approved avatar assignments updated: {changes}.")
    REPORT.write_text(json.dumps({'checkedAt': datetime.now(timezone.utc).isoformat(), 'updated': changes, 'failures': failures}, indent=2) + '\n', encoding='utf-8')
    if failures:
        print(f'::warning::{len(failures)} avatar(s) need attention. Successful avatars can still deploy.', file=sys.stderr)



def automation_enabled():
    data = json.loads((ROOT/'public/data/automation-controls.json').read_text())
    if data.get('version') != 1 or type(data.get('features',{}).get('avatars')) is not bool:
        raise ValueError('Invalid avatar processing controls; published images preserved.')
    return data['features']['avatars']


def automation_status(status, queued=None):
    file = ROOT/'public/data/automation-status.json'
    data = read_json(file)
    previous = data.get('avatars',{})
    stamp = datetime.now(timezone.utc).isoformat()
    data['avatars'] = {**previous,'status':status,'lastAttempt':stamp,'queued':queued if queued is not None else 'Unknown; source retained'}
    if status == 'success': data['avatars']['lastSuccess'] = stamp
    temp=file.with_suffix('.tmp'); temp.write_text(json.dumps(data,indent=2)+'\n');temp.replace(file)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument('--retry-id', default=os.environ.get('COBRA_AVATAR_SUBMISSION', ''))
    args = parser.parse_args()
    if not automation_enabled():
        automation_status('paused')
        print('no' if args.check else 'Avatar processing paused; Drive queue and published images retained.')
        sys.exit(0)
    if args.check:
        url, current, previous, photo_ids = state()
        pending = bool(url and needs_processing(current, previous, photo_ids, args.retry_id))
        automation_status('queued' if pending else 'success', sum(previous.get(k)!=v for k,v in current.items()))
        print('yes' if pending else 'no')
    else:
        publish(args.retry_id)
        report=read_json(REPORT)
        automation_status('needs-attention' if report.get('failures') else 'success',len(report.get('failures',{})))
