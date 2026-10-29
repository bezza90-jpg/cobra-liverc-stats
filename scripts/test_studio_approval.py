import hashlib
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('studio',Path(__file__).with_name('publish-studio-avatars.py'))
studio=importlib.util.module_from_spec(spec);spec.loader.exec_module(studio)

class StudioApprovalTests(unittest.TestCase):
 def receipt(self):
  ident='11111111-1111-4111-8111-111111111111';revision='reviewed_file_12345'
  return dict(driverKey='TEST-DRIVER',className='4-Wheel Drive Buggy',id=ident,revision=revision,review=dict(version=1,method='cutout-studio',approvedBy='Matt',previewApproved=True,rightFacing=True,submissionIdHash=hashlib.sha256(ident.encode()).hexdigest(),reviewedFileIdHash=hashlib.sha256(revision.encode()).hexdigest(),sha256='1'*64,approvedAt='2026-10-29T19:00:00Z'))
 def test_exact_preview_receipt_accepted(self):
  with patch.object(studio.sync,'blocked_revision',return_value=False):self.assertEqual(studio.validate_receipt(self.receipt())[0],'TEST-DRIVER')
 def test_sheet_approval_alone_and_changed_revision_rejected(self):
  for change in ({'previewApproved':False},{'rightFacing':False},{'method':'automatic'}, {'reviewedFileIdHash':'0'*64}):
   row=self.receipt();row['review'].update(change)
   with self.assertRaises(ValueError):studio.validate_receipt(row)
 def test_blocked_revision_stays_blocked(self):
  with patch.object(studio.sync,'blocked_revision',return_value=True):
   with self.assertRaises(ValueError):studio.validate_receipt(self.receipt())
 def test_already_published_receipt_is_not_repeated(self):
  row=self.receipt();policy={'reviews':{'TEST-DRIVER|4-Wheel Drive Buggy':row['review']}}
  with patch.object(studio.sync,'request_jsonp',return_value={'receipts':[row]}),patch.object(studio.sync,'blocked_revision',return_value=False),patch.object(studio.sync,'review_policy',return_value=policy),patch.object(studio.sync,'read_json',return_value={'TEST-DRIVER|4-Wheel Drive Buggy':row['revision']}),patch.object(studio.sync,'canonical_driver_key',side_effect=lambda x:x),patch.object(studio.sync,'assigned_target',side_effect=lambda k,c:(k,c)):
   self.assertEqual(studio.pending_entries('fixed-authority'),[])
 def test_later_manual_review_is_preserved(self):
  row=self.receipt();policy={'reviews':{'TEST-DRIVER|4-Wheel Drive Buggy':{'approvedAt':'2026-10-30T00:00:00Z'}}}
  with patch.object(studio.sync,'request_jsonp',return_value={'receipts':[row]}),patch.object(studio.sync,'blocked_revision',return_value=False),patch.object(studio.sync,'review_policy',return_value=policy),patch.object(studio.sync,'read_json',return_value={}),patch.object(studio.sync,'canonical_driver_key',side_effect=lambda x:x),patch.object(studio.sync,'assigned_target',side_effect=lambda k,c:(k,c)):
   self.assertEqual(studio.pending_entries('fixed-authority'),[])

if __name__=='__main__':unittest.main()
