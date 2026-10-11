import base64
import importlib.util
import io
import hashlib
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
        reviews = {}
        for pair, revision, ident in [('DALE|Trucks','file1','id1'),('MARK|Trucks','file2','id2'),('PAUL-CURTIS|2-Wheel Drive Buggy','file1','id1'),('DALE|2-Wheel Drive Buggy','rev','id')]:
            reviews[pair] = {'submissionId':ident,'reviewedFileId':revision,'sha256':hashlib.sha256(b'photo').hexdigest(),'method':'imagegen','approvedBy':'Matt','previewApproved':True,'rightFacing':True}
        (self.data/'car-avatar-review-policy.json').write_text(json.dumps({'version':1,'reviews':reviews,'blockedRevisions':['rejected']}))
        self.patches = [patch.object(sync, 'ROOT', self.root), patch.object(sync, 'MANIFEST', self.data/'car-avatars.json'), patch.object(sync, 'REVISIONS', self.data/'revisions.json'), patch.object(sync, 'REPORT', self.data/'report.json'), patch.object(sync, 'ALIASES', self.data/'aliases.json'), patch.object(sync, 'THUMBNAILS', self.root/'public/assets/car-avatar-thumbnails')]
        for p in self.patches: p.start()
    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()
    def test_missing_asset_rebuilds_even_if_revision_matches(self):
        self.assertTrue(sync.needs_processing({'DALE|Trucks':'revision'}, {'DALE|Trucks':'revision'}, {'DALE|Trucks':'id'}))
    def test_manually_removed_photo_stays_removed_until_new_revision(self):
        pair='DALE|Trucks'
        (self.data/'car-avatar-manual-revisions.json').write_text(json.dumps({pair:'revision'}))
        self.assertFalse(sync.needs_processing({pair:'revision'}, {pair:'revision'}, {pair:'id'}))
        self.assertFalse(sync.needs_processing({pair:'newrevision'}, {pair:'revision'}, {pair:'id'}))
    def test_merged_same_class_old_revisions_do_not_collide(self):
        (self.data/'aliases.json').write_text(json.dumps({'OLD':{'driverKey':'MASTER'}}))
        held={'OLD|Trucks':'old','MASTER|Trucks':'master'}
        (self.data/'car-avatar-manual-revisions.json').write_text(json.dumps(held))
        sync.validate_class_targets(held)
        sync.validate_class_targets({'OLD|Trucks':'new','MASTER|Trucks':'master'})
    def test_stale_retry_is_harmless(self):
        self.assertFalse(sync.needs_processing({}, {}, {}, 'old-submission'))
    def test_one_failure_does_not_lose_other_avatar(self):
        state = ('https://example.test', {'DALE|Trucks':'file1','MARK|Trucks':'file2'}, {}, {'DALE|Trucks':'id1','MARK|Trucks':'id2'})
        def request(url, p):
            if p['id']=='id1': raise ValueError('Invalid foreground')
            return {'id':'id2','base64':base64.b64encode(b'photo').decode()}
        with patch.object(sync, 'state', return_value=state), patch.object(sync, 'request_jsonp', side_effect=request), patch.object(sync, 'prepare_avatar', return_value=b'PNG'), patch.object(sync, 'write_thumbnail'):
            sync.publish()
        manifest=json.loads(sync.MANIFEST.read_text())
        self.assertIn('MARK',manifest)
        self.assertNotIn('DALE',manifest)
        self.assertIn('DALE|Trucks',json.loads(sync.REPORT.read_text())['failures'])
    def test_driver_alias_publishes_under_liverc_name(self):
        sync.ALIASES.write_text(json.dumps({'PAUL-CURTIS': {'driverKey': 'BRUCE', 'displayName': 'BRUCE (PAUL CURTIS)'}}))
        (self.data/'car-avatars.json').write_text(json.dumps({'BRUCE':'assets/car-avatars/BRUCE.png'}))
        state = ('https://example.test', {'PAUL-CURTIS|2-Wheel Drive Buggy':'file1'}, {}, {'PAUL-CURTIS|2-Wheel Drive Buggy':'id1'})
        photo = {'id':'id1','base64':base64.b64encode(b'photo').decode()}
        with patch.object(sync, 'state', return_value=state), patch.object(sync, 'request_jsonp', return_value=photo), patch.object(sync, 'prepare_avatar', return_value=b'PNG'), patch.object(sync, 'write_thumbnail'):
            sync.publish()
        manifest=json.loads(sync.MANIFEST.read_text())
        self.assertEqual(manifest['BRUCE']['default'], 'assets/car-avatars/BRUCE.png')
        self.assertEqual(manifest['BRUCE']['2-Wheel Drive Buggy'], 'assets/car-avatars/BRUCE-AUTO-2WD.png')
        self.assertNotIn('PAUL-CURTIS', manifest)

    def test_new_submission_collision_does_not_overwrite_moved_avatar(self):
        (self.data/'car-avatar-class-moves.json').write_text(json.dumps({'DALE|2-Wheel Drive Buggy':'Trucks'}))
        with self.assertRaises(ValueError):
            sync.needs_processing({'DALE|2-Wheel Drive Buggy':'a','DALE|Trucks':'b'}, {}, {})

    def test_moved_class_survives_sync_and_retry(self):
        pair='DALE|2-Wheel Drive Buggy'
        image='assets/car-avatars/DALE-AUTO-2WD.png'
        (self.data/'car-avatar-class-moves.json').write_text(json.dumps({pair:'Trucks'}))
        sync.MANIFEST.write_text(json.dumps({'DALE':{'Trucks':image}}))
        asset=self.root/'public'/image;asset.parent.mkdir(parents=True);asset.write_bytes(b'original')
        current={pair:'rev'};ids={pair:'id'}
        self.assertFalse(sync.needs_processing(current,current,ids))
        state=('https://example.test',current,dict(current),ids)
        with patch.object(sync,'state',return_value=state),patch.object(sync,'request_jsonp') as request:
            sync.publish();request.assert_not_called()
        photo={'id':'id','base64':base64.b64encode(b'photo').decode()}
        with patch.object(sync,'state',return_value=state),patch.object(sync,'request_jsonp',return_value=photo),patch.object(sync,'prepare_avatar',return_value=b'new'),patch.object(sync,'write_thumbnail'):
            sync.publish('id')
        self.assertEqual(json.loads(sync.MANIFEST.read_text())['DALE'],{'Trucks':image})

    def test_withdrawn_moved_avatar_cleans_correct_class(self):
        pair='DALE|2-Wheel Drive Buggy';image='assets/car-avatars/DALE-AUTO-2WD.png'
        (self.data/'car-avatar-class-moves.json').write_text(json.dumps({pair:'Trucks'}))
        sync.MANIFEST.write_text(json.dumps({'DALE':{'Trucks':image,'Vintage':'other'}}))
        with patch.object(sync,'state',return_value=('url',{}, {pair:'rev'},{})):
            sync.publish()
        self.assertEqual(json.loads(sync.MANIFEST.read_text())['DALE'],{'Vintage':'other'})

    def test_cross_driver_move_survives_sync_retry_and_withdrawal(self):
        pair='DALE|2-Wheel Drive Buggy';image='assets/car-avatars/DALE-AUTO-2WD.png'
        (self.data/'car-avatar-class-moves.json').write_text(json.dumps({pair:{'driverKey':'MARK','className':'Trucks'}}))
        sync.MANIFEST.write_text(json.dumps({'MARK':{'Trucks':image,'Vintage':'other'}}))
        asset=self.root/'public'/image;asset.parent.mkdir(parents=True);asset.write_bytes(b'original')
        current={pair:'rev'};ids={pair:'id'}
        self.assertFalse(sync.needs_processing(current,current,ids))
        with self.assertRaises(ValueError):sync.needs_processing({**current,'MARK|Trucks':'other'}, {}, {})
        photo={'id':'id','base64':base64.b64encode(b'photo').decode()}
        with patch.object(sync,'state',return_value=('url',current,dict(current),ids)),patch.object(sync,'request_jsonp',return_value=photo),patch.object(sync,'prepare_avatar',return_value=b'new'),patch.object(sync,'write_thumbnail'):
            sync.publish('id')
        self.assertEqual(json.loads(sync.MANIFEST.read_text())['MARK']['Trucks'],image)
        self.assertNotIn('DALE',json.loads(sync.MANIFEST.read_text()))
        with patch.object(sync,'state',return_value=('url',{},dict(current),{})):sync.publish()
        self.assertEqual(json.loads(sync.MANIFEST.read_text())['MARK'],{'Vintage':'other'})

    def test_rectangular_photo_with_transparent_padding_is_rejected_without_removal(self):
        original = Image.new('RGBA', (100,100))
        original.paste(Image.new('RGBA',(80,60),(20,30,40,255)),(10,20))
        output=io.BytesIO();original.save(output,'PNG')
        from types import SimpleNamespace
        calls=[]
        fake=SimpleNamespace(new_session=lambda _:None, remove=lambda im,session:(calls.append(True) or im.convert('RGBA')))
        with patch.dict('sys.modules',{'rembg':fake}), self.assertRaisesRegex(ValueError, 'Basic background removal is disabled'):
            sync.prepare_avatar(output.getvalue())
        self.assertEqual(calls,[])

    def test_opaque_photo_is_rejected(self):
        output=io.BytesIO();Image.new('RGB',(100,100)).save(output,'JPEG')
        with self.assertRaisesRegex(ValueError,'transparent PNG'):sync.prepare_avatar(output.getvalue())

    def test_approved_feed_alone_cannot_publish_or_fetch_new_image(self):
        sync.MANIFEST.write_text(json.dumps({'DALE':{'Vintage':'keep.png'}}))
        state=('url',{'CHRIS|4-Wheel Drive Buggy':'unreviewed'}, {}, {'CHRIS|4-Wheel Drive Buggy':'submission'})
        with patch.object(sync,'state',return_value=state),patch.object(sync,'request_jsonp') as fetch:
            sync.publish('submission');fetch.assert_not_called()
        self.assertEqual(json.loads(sync.MANIFEST.read_text()),{'DALE':{'Vintage':'keep.png'}})
        self.assertIn('CHRIS|4-Wheel Drive Buggy',json.loads(sync.REPORT.read_text())['failures'])

    def test_exact_chat_review_and_bytes_required(self):
        sync.require_chat_review('DALE|Trucks','file1','id1',b'photo')
        for revision, ident, data in [('different','id1',b'photo'),('file1','other',b'photo'),('file1','id1',b'changed')]:
            with self.assertRaises(ValueError):sync.require_chat_review('DALE|Trucks',revision,ident,data)
        policy=json.loads((self.data/'car-avatar-review-policy.json').read_text())
        policy['reviews']['DALE|Trucks']['method']='rembg'
        (self.data/'car-avatar-review-policy.json').write_text(json.dumps(policy))
        with self.assertRaises(ValueError):sync.require_chat_review('DALE|Trucks','file1','id1',b'photo')

    def test_rejected_chris_revision_never_downloaded_or_published(self):
        state=('url',{'CHRIS|4-Wheel Drive Buggy':'rejected'}, {}, {'CHRIS|4-Wheel Drive Buggy':'id'})
        self.assertFalse(sync.needs_processing(state[1],state[2],state[3]))
        with patch.object(sync,'state',return_value=state),patch.object(sync,'request_jsonp') as fetch:
            sync.publish('id');fetch.assert_not_called()

    def test_missing_review_policy_fails_closed(self):
        (self.data/'car-avatar-review-policy.json').unlink()
        with self.assertRaises(ValueError):sync.needs_processing({'DALE|Trucks':'file1'}, {}, {'DALE|Trucks':'id1'})
    def test_existing_true_cutout_preserved(self):
        original=Image.new('RGBA',(30,30))
        original.putpixel((0,0),(1,2,3,255));original.putpixel((29,29),(1,2,3,255))
        output=io.BytesIO();original.save(output,'PNG')
        result=sync.prepare_avatar(output.getvalue())
        self.assertTrue(result.startswith(b'\x89PNG'))
    def test_thumbnail_is_small_transparent_webp(self):
        avatar=self.root/'public/assets/car-avatars/TEST.png'
        avatar.parent.mkdir(parents=True)
        Image.new('RGBA',(900,600),(0,200,0,120)).save(avatar,'PNG')
        sync.write_thumbnail(avatar)
        thumb=sync.thumbnail_path(avatar)
        self.assertTrue(thumb.is_file())
        with Image.open(thumb) as image:
            self.assertLessEqual(image.width,360)
            self.assertLessEqual(image.height,200)
            self.assertIn('A',image.getbands())

if __name__=='__main__': unittest.main()

