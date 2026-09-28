import base64
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('sync', Path(__file__).with_name('sync-approved-avatars.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / 'public/data'
        self.data.mkdir(parents=True)
        self.patches = [patch.object(sync, 'ROOT', self.root), patch.object(sync, 'MANIFEST', self.data/'car-avatars.json'), patch.object(sync, 'REVISIONS', self.data/'revisions.json'), patch.object(sync, 'REPORT', self.data/'report.json')]
        for p in self.patches: p.start()
    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()
    def test_missing_asset_rebuilds_even_if_revision_matches(self):
        self.assertTrue(sync.needs_processing({'DALE|Trucks':'revision'}, {'DALE|Trucks':'revision'}, {'DALE|Trucks':'id'}))
    def test_retry_unknown_id_refused(self):
        with self.assertRaises(ValueError): sync.needs_processing({}, {}, {}, 'unknown')
    def test_one_failure_does_not_lose_other_avatar(self):
        state = ('https://example.test', {'DALE|Trucks':'file1','MARK|Trucks':'file2'}, {}, {'DALE|Trucks':'id1','MARK|Trucks':'id2'})
        def request(url, p):
            if p['id']=='id1': raise ValueError('Invalid foreground')
            return {'id':'id2','base64':base64.b64encode(b'photo').decode()}
        with patch.object(sync, 'state', return_value=state), patch.object(sync, 'request_jsonp', side_effect=request), patch.object(sync, 'prepare_avatar', return_value=b'PNG'):
            sync.publish()
        manifest=json.loads(sync.MANIFEST.read_text())
        self.assertIn('MARK',manifest)
        self.assertNotIn('DALE',manifest)
        self.assertIn('DALE|Trucks',json.loads(sync.REPORT.read_text())['failures'])
    def test_rectangular_photo_with_transparent_padding_runs_removal(self):
        original = Image.new('RGBA', (100,100))
        original.paste(Image.new('RGBA',(80,60),(20,30,40,255)),(10,20))
        output=io.BytesIO();original.save(output,'PNG')
        from types import SimpleNamespace
        calls=[]
        fake=SimpleNamespace(new_session=lambda _:None, remove=lambda im,session:(calls.append(True) or im.convert('RGBA')))
        with patch.dict('sys.modules',{'rembg':fake}): sync.prepare_avatar(output.getvalue())
        self.assertEqual(calls,[True])
    def test_existing_true_cutout_preserved(self):
        original=Image.new('RGBA',(30,30))
        original.putpixel((0,0),(1,2,3,255));original.putpixel((29,29),(1,2,3,255))
        output=io.BytesIO();original.save(output,'PNG')
        result=sync.prepare_avatar(output.getvalue())
        self.assertTrue(result.startswith(b'\x89PNG'))

if __name__=='__main__': unittest.main()
