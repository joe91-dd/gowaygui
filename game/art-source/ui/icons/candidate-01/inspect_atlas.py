"""Read PNG pixels and emit inspection/layout JSON; never modify an image."""
from pathlib import Path
from collections import Counter
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
NAMES = [
    ('gold', '金币', '唯一货币；金币与龟壳图案'),
    ('stamina', '体力', '青色闪电；资源而非货币'),
    ('attack-medicine', '攻击药', '橙色药瓶与剑'),
    ('health-medicine', '生命药', '珊瑚色药瓶与心'),
    ('defense-medicine', '防御药', '蓝色药瓶与盾'),
    ('growth-medicine', '成长药', '绿色药瓶与嫩芽'),
    ('collection-lock', '收藏锁定', '闭合青色挂锁'),
    ('growth-history', '成长历史', '青色历史册与回转箭头'),
]
FILES = {
    'icons-atlas.png': 'original; insufficient padding',
    'icons-atlas-padding-edit.png': 'rejected; RGB painted checkerboard',
    'icons-atlas-padded-transparent.png': 'review candidate; alpha fringe remains',
}
report = {'method': 'Pillow read-only pixel inspection; no output image processing', 'files': []}
for name, status in FILES.items():
    path = ROOT / name
    with Image.open(path) as im:
        record = {'file': name, 'status': status, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size, 'width': im.width, 'height': im.height, 'mode': im.mode}
        if 'A' in im.getbands():
            alpha = im.getchannel('A')
            hist = alpha.histogram()
            record.update({'transparentPixels': hist[0], 'alpha1To15Pixels': sum(hist[1:16]), 'alpha16To254Pixels': sum(hist[16:255]), 'opaquePixels': hist[255], 'transparentFraction': hist[0] / (im.width * im.height), 'mostCommonAlpha': Counter(dict(enumerate(hist))).most_common(8)})
        report['files'].append(record)

candidate = ROOT / 'icons-atlas-padded-transparent.png'
with Image.open(candidate) as im:
    alpha = im.getchannel('A')
    cells = []
    for i, (key, label, meaning) in enumerate(NAMES):
        # Integer boundaries partition this non-divisible image for inspection only.
        gx0, gy0 = round(i % 4 * im.width / 4), round(i // 4 * im.height / 2)
        gx1, gy1 = round((i % 4 + 1) * im.width / 4), round((i // 4 + 1) * im.height / 2)
        local = alpha.crop((gx0, gy0, gx1, gy1))
        # Threshold applies only to measurement. Original pixels remain untouched.
        bbox = local.point(lambda v: 255 if v >= 16 else 0).getbbox()
        x0, y0, x1, y1 = bbox
        cx, cy = gx0 + (x0 + x1) / 2, gy0 + (y0 + y1) / 2
        size = 320
        rx, ry = round(cx - size / 2), round(cy - size / 2)
        rect_alpha = alpha.crop((rx, ry, rx + size, ry + size))
        edge_max = max(rect_alpha.crop(b).getextrema()[1] for b in [(0, 0, size, 8), (0, size-8, size, size), (0, 0, 8, size), (size-8, 0, size, size)])
        cells.append({
            'id': key, 'label': label, 'meaning': meaning, 'column': i % 4, 'row': i // 4,
            'sourceGridRect': {'x': gx0, 'y': gy0, 'width': gx1-gx0, 'height': gy1-gy0},
            'spriteRect': {'x': rx, 'y': ry, 'width': size, 'height': size},
            'originalSize': {'width': size, 'height': size}, 'offset': {'x': 0, 'y': 0}, 'pivot': {'x': 0.5, 'y': 0.5}, 'rotated': False,
            'alpha16SubjectBounds': {'x': gx0+x0, 'y': gy0+y0, 'width': x1-x0, 'height': y1-y0},
            'alpha16PaddingInSpriteRect': {'left': gx0+x0-rx, 'top': gy0+y0-ry, 'right': rx+size-(gx0+x1), 'bottom': ry+size-(gy0+y1)},
            'outer8PixelMaxAlpha': edge_max,
        })
    layout = {
        'schemaVersion': 1, 'status': 'candidate_pending_root_visual_review', 'image': candidate.name,
        'imageWidth': im.width, 'imageHeight': im.height, 'coordinateOrigin': 'top-left in source PNG pixels',
        'logicalGrid': {'columns': 4, 'rows': 2, 'nominalCellWidth': im.width/4, 'nominalCellHeight': im.height/2},
        'spriteFrameSize': {'width': 320, 'height': 320},
        'note': 'Use the eight equal 320x320 spriteRect values for centered Cocos SpriteFrames; do not assume source-grid dimensions are integers or equal. Original PNG is not cropped or rescaled. Faint alpha fringe remains; runtime and 48px legibility need visual review.',
        'cells': cells,
    }
(ROOT / 'inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(ROOT / 'layout.json').write_text(json.dumps(layout, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'files': report['files'], 'spriteRects': [{'id': c['id'], 'rect': c['spriteRect'], 'outer8PixelMaxAlpha': c['outer8PixelMaxAlpha']} for c in cells]}, ensure_ascii=False, indent=2))
