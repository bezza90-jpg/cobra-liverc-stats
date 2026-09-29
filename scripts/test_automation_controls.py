import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class AvatarPauseTest(unittest.TestCase):
    def test_paused_check_never_touches_manifest_or_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/'scripts').mkdir(); (root/'public/data').mkdir(parents=True)
            shutil.copyfile(Path(__file__).with_name('sync-approved-avatars.py'),root/'scripts/sync-approved-avatars.py')
            manifest=root/'public/data/car-avatars.json'; manifest.write_text('{"kept":true}')
            controls=root/'public/data/automation-controls.json'
            controls.write_text(json.dumps({'version':1,'features':{'avatars':False}}))
            result=subprocess.run([sys.executable,str(root/'scripts/sync-approved-avatars.py'),'--check'],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout.strip(),'no')
            self.assertEqual(manifest.read_text(),'{"kept":true}')
            self.assertEqual(json.loads((root/'public/data/automation-status.json').read_text())['avatars']['status'],'paused')
            controls.write_text('{"version":1,"features":{"avatars":"false"}}')
            result=subprocess.run([sys.executable,str(root/'scripts/sync-approved-avatars.py'),'--check'],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(manifest.read_text(),'{"kept":true}')
