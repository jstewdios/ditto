"""Rebuild synthetic image fixtures and the downloadable study folders.

Requires Pillow. Only test patterns are created; no user photos are used.
The committed JSON/ZIP allow tests and the app to run without Python or Pillow.
"""
import base64
import io
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from PIL import Image, ImageDraw
from PIL.TiffImagePlugin import IFDRational

ROOT = Path(__file__).resolve().parents[1]


def pattern(variant=0):
    image = Image.new('RGB', (480, 320), '#e8eef8')
    draw = ImageDraw.Draw(image)
    colors = ['#183bea', '#efaa32', '#2f8470', '#cf5470']
    for row in range(2):
        for col in range(2):
            draw.rectangle((20 + col * 240, 20 + row * 160, 220 + col * 240, 140 + row * 160), fill=colors[(row * 2 + col + variant) % 4])
    draw.text((28, 27), f'DITTO / SYNTHETIC PATTERN {variant}', fill='white')
    return image


def metadata(time, fraction='125', device='A', gps=True, time_only=False):
    exif = Image.Exif()
    fields = {36867: time}
    if not time_only:
        exif[271] = 'Ditto'
        exif[272] = f'Study Camera {device}'
        fields[36881] = '-07:00'
        fields[42033] = f'DITTO-SYNTHETIC-{device}'
        if fraction is not None:
            fields[37521] = fraction
        if gps:
            exif[34853] = {1: 'N', 2: (IFDRational(47), IFDRational(37), IFDRational(0)), 3: 'W', 4: (IFDRational(122), IFDRational(21), IFDRational(0))}
    exif[34665] = fields
    return exif


entries = []


def add(path, image, exif, truth, quality=90):
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=quality, exif=exif.tobytes() if exif else b'')
    entries.append({'path': path, 'base64': base64.b64encode(buffer.getvalue()).decode(), 'truth': truth})


base = pattern()
first = metadata('2026:09:07 10:20:00')
add('01-originals/color-study.jpg', base, first, 'Source pattern for the crop and small export.')
add('02-exports/color-study-crop.jpg', base.crop((0, 0, 320, 260)), first, 'A crop of color-study; metadata preserved.')
add('02-exports/color-study-small.jpg', base.resize((180, 120)), first, 'A resized, recompressed version; metadata preserved.', quality=70)
entries.append({**entries[0], 'path': '03-backups/renamed-copy.jpg', 'truth': 'Byte-for-byte copy of color-study.jpg.'})
add('02-exports/color-study-no-tags.jpg', base.resize((180, 120)), None, 'Visually related but metadata stripped; cannot be linked in this study.', quality=65)
add('04-burst/burst-1.jpg', pattern(1), metadata('2026:09:07 10:30:00', fraction='100'), 'Different synthetic shot; same whole second as burst-2.')
add('04-burst/burst-2.jpg', pattern(2), metadata('2026:09:07 10:30:00', fraction='250'), 'Different synthetic shot; fractional second conflicts with burst-1.')
add('05-camera-conflict/camera-a.jpg', pattern(0), metadata('2026:09:07 10:40:00', device='A'), 'Unrelated to camera-b despite identical capture time.')
add('05-camera-conflict/camera-b.jpg', pattern(3), metadata('2026:09:07 10:40:00', device='B'), 'Camera model and serial differ from camera-a.')
add('06-time-only/time-a.jpg', pattern(1), metadata('2026:09:07 11:00:00', time_only=True), 'Different synthetic image with only a whole-second timestamp.')
add('06-time-only/time-b.jpg', pattern(3), metadata('2026:09:07 11:00:00', time_only=True), 'Different synthetic image with the same timestamp; weak candidate.')

fixture = {'description': 'Synthetic technical test patterns with deliberately controlled metadata. No real photographs or private metadata.', 'entries': entries}
(ROOT / 'tests/fixtures/study-01.json').write_text(json.dumps(fixture, indent=2) + '\n')
readme = '''DITTO — STUDY 01: VERSIONS

These are synthetic technical test patterns, not real photographs.
Extract this archive, then choose the extracted ditto-study-01 folder once.
Do not separately select its subfolders.

Expected results: 11 photos checked, 1 exact-copy group, 4 possibly-related groups.
10 files have usable capture times. color-study-no-tags.jpg has no capture time.

Try each candidate and mark your assessment:
1. Color study (10:20 camera time): original + exact backup + crop + small export.
   All four files are versions of the same source pattern. Three different contents.
2. Burst (10:30): two distinct images with fractional seconds .100 and .250.
   Ditto should display a fractional-time conflict, not confirm a common origin.
3. Camera conflict (10:40): different images from different synthetic cameras.
   Ditto should display conflicting camera models and serial numbers.
4. Time only (11:00): different images sharing only a whole-second clock reading.
   Ditto should label these weak candidates and show missing evidence.

The stripped-metadata export is related to the first pattern but stays out of
possible groups. This is an intentional false negative illustrating the limit.

GPS coordinates are synthetic metadata near central Seattle, not a private
location. Camera names and serials are invented fixture values.

Export study notes to retain assessments and metadata evidence. All assessments
are session-only; they do not change automatic grouping or any original file.
'''
with ZipFile(ROOT / 'public/study-01.zip', 'w', compression=ZIP_DEFLATED) as archive:
    files = [('ditto-study-01/README.txt', readme.encode())] + [('ditto-study-01/' + entry['path'], base64.b64decode(entry['base64'])) for entry in entries]
    for path, data in files:
        info = ZipInfo(path, date_time=(2026, 9, 7, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data)
print(f'Created {len(entries)} synthetic fixtures and public/study-01.zip')
