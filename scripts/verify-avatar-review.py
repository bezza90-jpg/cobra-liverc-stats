"""Fail deployment if an avatar differs from its explicitly accepted file."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify(root=ROOT):
    public = root / 'public'
    policy = json.loads((public / 'data/car-avatar-review-policy.json').read_text())
    if policy.get('version') != 1 or not isinstance(policy.get('publishedAssets'), dict) or not isinstance(policy.get('assignments'), dict):
        raise ValueError('Avatar review policy is missing or invalid; deployment blocked.')
    manifest = json.loads((public / 'data/car-avatars.json').read_text())
    if manifest != policy['assignments']:
        raise ValueError('Avatar assignments changed without exact preview approval; deployment blocked.')
    actual = {}
    for folder in ('assets/car-avatars', 'assets/car-avatar-thumbnails'):
        for path in (public / folder).glob('*'):
            if not path.is_file():
                continue
            data = path.read_bytes()
            actual[path.relative_to(public).as_posix()] = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if actual != policy['publishedAssets']:
        changed = sorted(set(actual) ^ set(policy['publishedAssets']) | {p for p in actual.keys() & policy['publishedAssets'].keys() if actual[p] != policy['publishedAssets'][p]})
        raise ValueError('Unreviewed avatar file changes block deployment: ' + ', '.join(changed))
    print(f'Verified {len(actual)} pinned avatar files and their class assignments.')


if __name__ == '__main__':
    verify()
