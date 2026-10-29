"""Publish only exact PNGs explicitly preview-approved in Cutout Studio.

The fixed private review service is the receipt authority. Pending/Approved
spreadsheet cells alone never authorise publication. No background removal here.
"""
import base64
import hashlib
import importlib.util
import json
import re
import sys
from datetime import datetime
from pathlib import Path

spec = importlib.util.spec_from_file_location('avatar_sync', Path(__file__).with_name('sync-approved-avatars.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def validate_receipt(entry):
    if not isinstance(entry, dict): raise ValueError('Invalid studio receipt.')
    key, cls, ident, revision = (str(entry.get(k, '')) for k in ('driverKey', 'className', 'id', 'revision'))
    review = entry.get('review', {})
    if not (sync.KEY.fullmatch(key) and cls in sync.CLASS_SUFFIX and sync.ID.fullmatch(ident) and sync.FILE_ID.fullmatch(revision)):
        raise ValueError('Invalid studio driver or class reference.')
    if not isinstance(review, dict) or review.get('version') != 1 or review.get('method') != 'cutout-studio' or review.get('approvedBy') != 'Matt' or review.get('previewApproved') is not True or review.get('rightFacing') is not True:
        raise ValueError('The studio cutout has no explicit preview approval.')
    if review.get('submissionIdHash') != hashlib.sha256(ident.encode()).hexdigest() or review.get('reviewedFileIdHash') != hashlib.sha256(revision.encode()).hexdigest() or not re.fullmatch('[0-9a-f]{64}', str(review.get('sha256', ''))):
        raise ValueError('The studio receipt does not match this image revision.')
    datetime.fromisoformat(str(review.get('approvedAt', '')).replace('Z', '+00:00'))
    if sync.blocked_revision(revision): raise ValueError('This image revision is blocked.')
    return key, cls, ident, revision, review


def pending_entries(url):
    feed = sync.request_jsonp(url, {'action': 'studio-receipts'})
    receipts = feed.get('receipts')
    if not isinstance(receipts, list) or len(receipts) > 500: raise ValueError('Invalid studio review feed.')
    policy = sync.review_policy()
    revisions = sync.read_json(sync.REVISIONS)
    pending, targets = [], set()
    for entry in receipts:
        key, cls, ident, revision, review = validate_receipt(entry)
        if key in sync.HIDDEN_DRIVER_KEYS: continue
        canonical = sync.canonical_driver_key(key)
        target = sync.assigned_target(canonical, cls)
        pair = key + '|' + cls
        target_pair = '|'.join(target)
        previous = policy['reviews'].get(target_pair, policy['reviews'].get(pair, {}))
        if revisions.get(pair) == revision and previous.get('reviewedFileIdHash') == review['reviewedFileIdHash']: continue
        # A later explicit review/pin wins over a delayed older studio receipt.
        if previous.get('approvedAt') and datetime.fromisoformat(previous['approvedAt'].replace('Z', '+00:00')) > datetime.fromisoformat(review['approvedAt'].replace('Z', '+00:00')): continue
        if target in targets: raise ValueError('Two studio reviews target the same driver class; existing images preserved.')
        targets.add(target)
        pending.append((key, cls, ident, revision, review, target))
    return pending


def git_blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def publish(url, entries):
    # Fail closed if anything unrelated changed without a reviewed policy entry.
    gate = importlib.util.spec_from_file_location('avatar_gate', Path(__file__).with_name('verify-avatar-review.py'))
    checker = importlib.util.module_from_spec(gate); gate.loader.exec_module(checker); checker.verify()
    policy, manifest = sync.review_policy(), sync.read_json(sync.MANIFEST)
    revisions = sync.read_json(sync.REVISIONS)
    pins_path = sync.ROOT / 'public/data/car-avatar-manual-revisions.json'
    pins = sync.read_json(pins_path)
    report = sync.read_json(sync.REPORT)
    changed = 0
    for key, cls, ident, revision, review, (driver, target_class) in entries:
        response = sync.request_jsonp(url, {'action': 'image', 'id': ident})
        if response.get('id') != ident or response.get('revision') != revision: raise ValueError('The studio image changed while publishing. Retry the update.')
        data = base64.b64decode(response['base64'], validate=True)
        if len(data) > 3_000_000 or hashlib.sha256(data).hexdigest() != review['sha256']: raise ValueError('The studio preview bytes changed; publication blocked.')
        prepared = sync.prepare_avatar(data)
        # Confirm the receipt is still current after downloading and processing.
        latest = sync.request_jsonp(url, {'action': 'studio-receipts'}).get('receipts', [])
        if not any(e.get('id') == ident and e.get('revision') == revision and e.get('review', {}).get('sha256') == review['sha256'] for e in latest): raise ValueError('A newer review replaced this cutout; publication cancelled.')
        relative = 'assets/car-avatars/' + driver + '-STUDIO-' + sync.CLASS_SUFFIX[cls] + '.png'
        target = sync.ROOT / 'public' / relative
        target.write_bytes(prepared)
        sync.write_thumbnail(target)
        existing = manifest.get(driver, {})
        existing = dict(existing) if isinstance(existing, dict) else {'default': existing}
        existing[target_class] = relative
        manifest[driver] = existing
        target_pair = driver + '|' + target_class
        policy['reviews'][target_pair] = {**review, 'manualPublish': True}
        policy['assignments'].setdefault(driver, {})
        if not isinstance(policy['assignments'][driver], dict): policy['assignments'][driver] = {'default': policy['assignments'][driver]}
        policy['assignments'][driver][target_class] = relative
        for asset in (target, sync.thumbnail_path(target)):
            policy['publishedAssets'][asset.relative_to(sync.ROOT / 'public').as_posix()] = git_blob(asset.read_bytes())
        pair = key + '|' + cls
        revisions[pair] = revision
        pins[pair] = revision
        if isinstance(report.get('failures'), dict): report['failures'].pop(pair, None)
        changed += 1
    if changed:
        for path, value in ((sync.MANIFEST, manifest), (sync.REVISIONS, revisions), (pins_path, pins), (sync.ROOT / 'public/data/car-avatar-review-policy.json', policy), (sync.REPORT, report)):
            path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        checker.verify()
    print('Published ' + str(changed) + ' explicitly checked studio cutouts.')


if __name__ == '__main__':
    url = str(sync.read_json(sync.CONFIG).get('webAppUrl', ''))
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', url): raise ValueError('Invalid fixed review-service URL.')
    pending = pending_entries(url)
    if '--check' in sys.argv: print('yes' if pending else 'no')
    else: publish(url, pending)
