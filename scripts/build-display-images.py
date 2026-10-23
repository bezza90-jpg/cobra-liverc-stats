from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
changed=[]
for source in (root/'public/assets/car-avatars').glob('*.png'):
    target=root/'public/assets/car-avatar-thumbnails'/f'{source.stem}.webp'
    # Published avatar thumbnails are review-pinned assets.  A checkout gives
    # source and target files fresh mtimes, so timestamp comparisons can
    # silently re-encode an already approved thumbnail with a newer Pillow
    # build.  Only create a missing thumbnail; replacements must travel with
    # the reviewed avatar update that also refreshes the approval manifest.
    if target.exists(): continue
    target.parent.mkdir(parents=True,exist_ok=True)
    try:
        with Image.open(source) as image:
            image=image.convert('RGBA');image.thumbnail((360,200),Image.Resampling.LANCZOS);image.save(target,'WEBP',quality=82,method=6)
    except OSError as error:
        print(f'::warning::Preserving existing image for {source.name}: {error}')
        continue
    changed.append(target.name)
print(f'Prepared {len(changed)} car display thumbnails.')

for source in (root/'public/podium-photos').glob('*'):
    if source.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'): continue
    target=root/'public/podium-photo-thumbnails'/f'{source.stem}.webp'
    if target.exists() and target.stat().st_mtime>=source.stat().st_mtime: continue
    target.parent.mkdir(parents=True,exist_ok=True)
    from PIL import ImageOps
    with Image.open(source) as image:
        image=ImageOps.exif_transpose(image).convert('RGB');image.thumbnail((1040,1040),Image.Resampling.LANCZOS);image.save(target,'WEBP',quality=82,method=6)
print('Prepared podium photo display copies; originals are unchanged.')

track_thumbnails=[]
for source in (root/'public/track-photos').rglob('*'):
    if source.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'): continue
    relative=source.relative_to(root/'public/track-photos').with_suffix('.webp')
    target=root/'public/track-photo-thumbnails'/relative
    if target.exists() and target.stat().st_mtime>=source.stat().st_mtime: continue
    target.parent.mkdir(parents=True,exist_ok=True)
    with Image.open(source) as image:
        image=ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((640,480),Image.Resampling.LANCZOS)
        image.save(target,'WEBP',quality=76,method=6)
    track_thumbnails.append(str(relative))
print(f'Prepared {len(track_thumbnails)} track photo thumbnails; originals are unchanged.')
