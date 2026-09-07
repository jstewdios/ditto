"""Generate Study 02 technical JPEG patterns with controlled Apple MakerNotes.

Requires Pillow, like Study 01. No camera photos or private identifiers are used.
MakerNote structure is independently encoded here; no application parser is used.
"""
import base64
import io
import json
import struct
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
C = '33333333-3333-4333-8333-333333333333'


def apple_note(uuid, tag=11):
    text = uuid.encode('ascii') + b'\0'
    # Apple iOS header; big-endian IFD at 14; offsets relative to this note.
    return b'Apple iOS\0\0\1MM' + struct.pack('>H', 1) + struct.pack('>HHII', tag, 2, len(text), 32) + b'\0' * 4 + text


def pattern(frame=1):
    image = Image.new('RGB', (480, 320), '#edf2f9')
    draw = ImageDraw.Draw(image)
    draw.line((30, 230, 450, 230), fill='#344256', width=3)
    x = 50 + frame * 70
    draw.rectangle((x, 90, x + 60, 230), fill='#234cdb')
    draw.text((24, 24), f'DITTO / SYNTHETIC BURST / MOMENT {frame}', fill='#233249')
    return image


entries = []


def add(path, frame, note, time='2026:09:07 10:20:00', fraction='900', quality=90, make='Apple', truth=''):
    exif = Image.Exif()
    exif[271] = make
    exif[272] = 'Synthetic Study Camera'
    tags = {}
    if time:
        tags.update({36867: time, 36881: '-07:00', 37521: fraction})
    if note is not None:
        tags[37500] = note
    exif[34665] = tags
    buffer = io.BytesIO()
    pattern(frame).save(buffer, format='JPEG', quality=quality, exif=exif.tobytes())
    entries.append({'path': path, 'base64': base64.b64encode(buffer.getvalue()).decode(), 'truth': truth})


add('01-burst-a/moment-1.jpg', 1, apple_note(A), truth='Burst A, first moment at .900.')
add('01-burst-a/moment-2.jpg', 2, apple_note(A), time='2026:09:07 10:20:01', fraction='100', truth='Burst A crosses into the next second.')
add('02-exports/moment-1-preserved.jpg', 1, apple_note(A), quality=65, truth='Recompressed first moment, ID retained; not an extra frame.')
entries.append({'path': '03-backups/renamed-moment-1.jpg', 'base64': entries[0]['base64'], 'truth': 'Exact backup of the first moment.'})
add('02-exports/moment-3-no-time.jpg', 3, apple_note(A), time=None, truth='Burst A identifier survives without a capture time.')
add('04-burst-b/moment-1.jpg', 4, apple_note(B), truth='Separate Burst B at the same time as A.')
add('04-burst-b/moment-2.jpg', 5, apple_note(B), time='2026:09:07 10:20:01', fraction='100', truth='Separate Burst B, second moment.')
add('02-exports/moment-1-stripped.jpg', 1, None, truth='Known first-moment export with MakerNote removed. Must not join by timing.')
# Panasonic header with sequence number only. It is deliberately unsupported.
sequence = b'Panasonic\0\0\0' + struct.pack('<H', 1) + struct.pack('<HHII', 43, 4, 1, 1) + b'\0' * 4
add('05-counterexamples/sequence-only.jpg', 1, sequence, make='Panasonic', truth='Sequence number is not an explicit burst identity.')
add('05-counterexamples/invalid-id.jpg', 2, apple_note('00000000-0000-0000-0000-000000000000'), truth='Placeholder UUID is invalid, never a grouping key.')
add('05-counterexamples/singleton.jpg', 3, apple_note(C), truth='Valid ID present in only one file. Coverage only; no group.')
add('05-counterexamples/live-photo-id.jpg', 1, apple_note(A, tag=17), truth='Apple ContentIdentifier with the same UUID text. It is not BurstUUID.')

readme = '''Ditto / Study 02 — Explicit bursts

All images are synthetic technical patterns, with invented IDs and camera details.
Extract this archive and choose the ditto-study-02 parent folder once.

Expected: 12 files, 1 exact-copy group, 2 burst ID groups.
Burst A: 5 files / 4 different contents; Burst B: 2 files / 2 contents.
Different contents are NOT a count of original frames (A includes an export).
Coverage: 8 identified, 2 with no ID found, 1 unsupported, 1 invalid.

The A and B groups span two capture seconds but remain separate from each other.
The missing-time A file still joins via its ID. Its chronological order is unknown.
The preserved export joins A; the stripped export stays out even with matching time.
Sequence-only, zero UUID, and Live Photo ID files never create a burst group.
The singleton has an ID, but no other selected file sharing it.
Study 01's same-second candidates may contain A and B together; that view is unchanged.

Export burst notes includes all 12 files and their read status, including exclusions.
It contains file paths, hashes, camera details, and any recorded IDs.
These constructed examples validate rules, NOT real Apple Photos export behavior.
The next observation is whether IDs survive real original/export workflows.
'''

(ROOT / 'tests/fixtures/study-02.json').write_text(json.dumps({'entries': entries}, indent=2) + '\n')
with ZipFile(ROOT / 'public/study-02.zip', 'w', compression=ZIP_DEFLATED) as archive:
    def write(path, data):
        info = ZipInfo('ditto-study-02/' + path, (2026, 9, 7, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
    for entry in entries:
        write(entry['path'], base64.b64decode(entry['base64']))
    write('README.txt', readme)
print('Study 02: 12 synthetic files, 2 burst groups, 1 exact-copy group.')
