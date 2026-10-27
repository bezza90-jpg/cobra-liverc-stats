"""Publish only approved, class-specific car avatars from the COBRA private review app."""

import argparse
import base64
import io
import hashlib
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
ALIASES = ROOT / "public/data/car-avatar-driver-aliases.json"
THUMBNAILS = ROOT / "public/assets/car-avatar-thumbnails"
CLASS_SUFFIX = {
    "2-Wheel Drive Buggy": "2WD", "4-Wheel Drive Buggy": "4WD", "Vintage": "VINTAGE",
    "Trucks": "TRUCKS", "Junior Racers": "JUNIORS"
}
KEY = re.compile(r"^[A-Z0-9_-]+$")
ID = re.compile(r"^[0-9a-f-]{36}$", re.I)
FILE_ID = re.compile(r"^[A-Za-z0-9_-]{10,}$")
HIDDEN_DRIVER_KEYS = {"BOB-BOBTECH-GELSTHARP"}


def review_policy():
    policy = read_json(ROOT / 'public/data/car-avatar-review-policy.json')
    if policy.get('version') != 1 or not isinstance(policy.get('reviews'), dict) or not isinstance(policy.get('blockedRevisions'), list):
        raise ValueError('Avatar review policy missing or invalid; existing images preserved.')
    return policy


def blocked_revision(revision):
    policy = review_policy()
    return (revision in policy['blockedRevisions']
            or hashlib.sha256(revision.encode()).hexdigest() in policy.get('blockedRevisionHashes', []))


def require_chat_review(pair, revision, submission_id, photo_bytes=None):
    review = review_policy()['reviews'].get(pair, {})
    if (blocked_revision(revision) or review.get('reviewedFileIdHash') != hashlib.sha256(revision.encode()).hexdigest()
            or review.get('submissionIdHash') != hashlib.sha256(submission_id.encode()).hexdigest()
            or review.get('method') != 'imagegen'
            or review.get('approvedBy') != 'Matt'
            or review.get('previewApproved') is not True
            or review.get('rightFacing') is not True
            or not re.fullmatch(r'[0-9a-f]{64}', str(review.get('sha256', '')))):
        raise ValueError('Exact image requires Matt\'s preview approval in chat; automatic background removal is prohibited.')
    if photo_bytes is not None and hashlib.sha256(photo_bytes).hexdigest() != review['sha256']:
        raise ValueError('Reviewed image bytes changed; existing image preserved.')


def read_json(path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except FileNotFoundError:
        return {}


def avatar_aliases():
    aliases = read_json(ALIASES)
    result = {}
    for source, value in aliases.items():
        target = value.get("driverKey", "") if isinstance(value, dict) else ""
        if not (KEY.fullmatch(source) and KEY.fullmatch(target)):
            raise ValueError("The car-avatar driver alias list is invalid.")
        result[source] = target
    return result


def canonical_driver_key(driver_key):
    return avatar_aliases().get(driver_key, driver_key)


def assigned_target(driver_key, source_class):
    routes = read_json(ROOT / 'public/data/car-avatar-class-moves.json')
    target = routes.get(driver_key + '|' + source_class, source_class)
    if isinstance(target, dict):
        key, cls = target.get('driverKey', ''), target.get('className', '')
    else: key, cls = driver_key, target
    if not isinstance(key,str) or not KEY.fullmatch(key) or cls not in {*CLASS_SUFFIX, 'default'}:
        raise ValueError('Invalid avatar assignment; existing images are preserved.')
    return key, cls

def assigned_class(driver_key, source_class):
    return assigned_target(driver_key, source_class)[1]


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
    # Keep one approved source per final driver/class target. Historic upload
    # names can remain in the sheet after a driver is given a canonical key;
    # when both exist, the canonical record is authoritative. Ambiguous
    # alias-only collisions still fail closed in validate_class_targets().
    candidates = {}
    for entry in records:
        if not isinstance(entry, dict): raise ValueError('Malformed avatar record; aborting safely.')
        key, cls = str(entry.get("driverKey", "")), str(entry.get("className", ""))
        ident, revision = str(entry.get("id", "")), str(entry.get("revision", ""))
        if not (KEY.fullmatch(key) and cls in CLASS_SUFFIX and ID.fullmatch(ident) and FILE_ID.fullmatch(revision)):
            raise ValueError('Invalid approved avatar record; existing assets are preserved.')
        if key in HIDDEN_DRIVER_KEYS:
            continue
        pair = f"{key}|{cls}"
        canonical = canonical_driver_key(key)
        target = assigned_target(canonical, cls)
        priority = int(key == target[0]) + int(cls == target[1])
        existing = candidates.get(target)
        if existing is None or priority > existing[0]:
            candidates[target] = (priority, pair, revision, ident)
        elif priority == existing[0]:
            # Preserve both so the existing collision guard can stop an
            # genuinely ambiguous class assignment without overwriting files.
            candidates[(target, pair)] = (priority, pair, revision, ident)
    current = {candidate[1]: candidate[2] for candidate in candidates.values()}
    photo_ids = {candidate[1]: candidate[3] for candidate in candidates.values()}
    return url, current, read_json(REVISIONS), photo_ids


def prepare_avatar(photo_bytes):
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(photo_bytes)) as loaded:
        if loaded.format != 'PNG':
            raise ValueError('Only a reviewed transparent PNG may be published.')
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
        raise ValueError('The reviewed PNG has no cut-out transparency. Basic background removal is disabled; return to chat review.')
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


def validate_class_targets(current):
    targets = set()
    for pair in current:
        if blocked_revision(current[pair]): continue
        if manually_kept(pair, current[pair]): continue
        source, cls = pair.split('|', 1)
        driver = canonical_driver_key(source)
        target = assigned_target(driver, cls)
        if target in targets:
            raise ValueError('Two approved images now target the same moved class. Move the published avatar to another empty class before retrying; existing images are preserved.')
        targets.add(target)


def manually_kept(pair, revision):
    # A reviewed manual image remains authoritative even if the approval feed
    # still returns an older file ID. Only an explicit manual publish may replace
    # it; scheduled processing and retries must not overwrite it.
    if read_json(ROOT / 'public/data/car-avatar-manual-revisions.json').get(pair):
        return True
    review = review_policy()['reviews'].get(pair, {})
    return (review.get('manualPublish') is True
            and review.get('previewApproved') is True
            and review.get('approvedBy') == 'Matt'
            and review.get('method') == 'imagegen')


def needs_processing(current, previous, photo_ids, retry_id=''):
    validate_class_targets(current)
    manifest = read_json(MANIFEST)
    if retry_id and retry_id not in photo_ids.values():
        print('::warning::Retry submission is no longer in the current approved feed; skipping its stale retry.', file=sys.stderr)
        retry_id = ''
    if any(not blocked_revision(revision) and not manually_kept(pair,revision) and previous.get(pair)!=revision for pair,revision in current.items()) or set(previous)-set(current) or retry_id: return True
    for pair in current:
        if blocked_revision(current[pair]): continue
        if manually_kept(pair, current[pair]): continue
        key, cls = pair.split('|', 1)
        key = canonical_driver_key(key)
        key, target_class = assigned_target(key, cls)
        entry = manifest.get(key, {})
        path = entry.get(target_class, '') if isinstance(entry, dict) else entry if target_class == 'default' else ''
        if not path or not (ROOT / 'public' / path).is_file(): return True
    return False


def publish(retry_id=''):
    url, current, previous, photo_ids = state()
    if not url:
        print("Avatar approvals are not configured; skipping.")
        return
    validate_class_targets(current)
    manifest = read_json(MANIFEST)
    if retry_id and retry_id not in photo_ids.values():
        print('::warning::Retry submission is no longer in the current approved feed; skipping its stale retry.', file=sys.stderr)
        retry_id = ''
    failures = {}
    changes = 0
    for pair, revision in current.items():
        if blocked_revision(revision): continue
        if manually_kept(pair, revision): continue
        source_driver_key, cls = pair.split("|", 1)
        origin_key = canonical_driver_key(source_driver_key)
        driver_key, target_class = assigned_target(origin_key, cls)
        existing = manifest.get(driver_key, {})
        assigned = existing.get(target_class, '') if isinstance(existing, dict) else existing if target_class == 'default' else ''
        if previous.get(pair) == revision and photo_ids[pair] != retry_id and assigned and (ROOT / 'public' / assigned).is_file():
            continue
        ident = photo_ids[pair]
        try:
            # An Approved spreadsheet cell is insufficient. Fail before fetching
            # any image unless this exact version was previewed and accepted.
            require_chat_review(pair, revision, ident)
            photo = request_jsonp(url, {"action": "image", "id": ident})
            if str(photo.get("id")) != ident or (photo.get('revision') and photo['revision'] != revision):
                raise ValueError("The approved photo changed during processing. Retry the refresh.")
            decoded = base64.b64decode(photo["base64"], validate=True)
            if not decoded or len(decoded) > 3_000_000:
                raise ValueError("The approved photo is too large.")
            require_chat_review(pair, revision, ident, decoded)
            avatar_bytes = prepare_avatar(decoded)
        except Exception as error:
            # Keep the previous avatar and continue other submissions. Do not leak URLs/tokens.
            message = str(error) if isinstance(error, ValueError) else type(error).__name__ + ' while downloading or validating the reviewed PNG; see workflow log.'
            failures[pair] = {'id': ident, 'revision': revision, 'error': message[:300]}
            print(f'::warning::Avatar {ident}: {message[:300]}', file=sys.stderr)
            continue
        relative = f"assets/car-avatars/{origin_key}-AUTO-{CLASS_SUFFIX[cls]}.png"
        target = ROOT / "public" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(avatar_bytes)
        write_thumbnail(target)
        existing = manifest.get(driver_key, {})
        entry = dict(existing) if isinstance(existing, dict) else {"default": existing} if isinstance(existing, str) and existing else {}
        entry[target_class] = relative
        manifest[driver_key] = entry
        previous[pair] = revision
        changes += 1

    current_targets = {
        assigned_target(canonical_driver_key(pair.split('|', 1)[0]), pair.split('|', 1)[1])
        for pair in current
    }
    for pair in set(previous) - set(current):
        if manually_kept(pair, previous[pair]):
            previous.pop(pair)
            changes += 1
            continue
        source_driver_key, cls = pair.split("|", 1)
        origin_key = canonical_driver_key(source_driver_key)
        driver_key, target_class = assigned_target(origin_key, cls)
        if (driver_key, target_class) in current_targets:
            # A canonical source superseded a legacy alias for the same final
            # slot. Drop only the old revision marker; the live asset belongs
            # to the still-current canonical source.
            previous.pop(pair)
            changes += 1
            continue
        existing = manifest.get(driver_key)
        expected = f"assets/car-avatars/{origin_key}-AUTO-{CLASS_SUFFIX[cls]}.png"
        if isinstance(existing, str): existing = {'default': existing}
        if isinstance(existing, dict) and existing.get(target_class) == expected:
            entry = dict(existing)
            entry.pop(target_class)
            manifest[driver_key] = entry if entry else ""
            if not entry:
                manifest.pop(driver_key)
            removed_avatar = ROOT / "public" / expected
            still_used = any(expected in (value.values() if isinstance(value, dict) else [value]) for value in manifest.values())
            if not still_used:
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

