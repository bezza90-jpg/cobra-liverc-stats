import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('gate',Path(__file__).with_name('verify-avatar-review.py'))
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)


class DeploymentGateTests(unittest.TestCase):
    def test_exact_assets_pass_but_replacements_new_files_and_class_changes_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);data=root/'public/data';data.mkdir(parents=True)
            asset=root/'public/assets/car-avatars/CAR.png';asset.parent.mkdir(parents=True)
            asset.write_bytes(b'accepted')
            digest=hashlib.sha1(b'blob 8\0accepted').hexdigest()
            assignments={'DRIVER':{'Trucks':'assets/car-avatars/CAR.png'}}
            policy={'version':1,'assignments':assignments,'publishedAssets':{'assets/car-avatars/CAR.png':digest}}
            (data/'car-avatar-review-policy.json').write_text(json.dumps(policy))
            manifest=data/'car-avatars.json';manifest.write_text(json.dumps(assignments))
            gate.verify(root)
            asset.write_bytes(b'crappy replacement')
            with self.assertRaises(ValueError):gate.verify(root)
            asset.write_bytes(b'accepted')
            other=asset.with_name('NEW.png');other.write_bytes(b'unreviewed')
            with self.assertRaises(ValueError):gate.verify(root)
            other.unlink()
            manifest.write_text(json.dumps({'DRIVER':{'Vintage':'assets/car-avatars/CAR.png'}}))
            with self.assertRaises(ValueError):gate.verify(root)


if __name__=='__main__':unittest.main()
