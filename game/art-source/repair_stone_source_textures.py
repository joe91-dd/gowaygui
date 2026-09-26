"""Make promoted Blender source self contained; never rewrite runtime FBX."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
TEXTURES=ROOT/'game/assets/resources/models/stone-turtle'
for name in ['stone-turtle.blend','stone-turtle-review-scene.blend']:
    path=SOURCE/name;bpy.ops.wm.open_mainfile(filepath=str(path))
    repaired=[]
    for image in bpy.data.images:
        print('SOURCE_IMAGE',image.name,repr(image.filepath),image.source)
        basename=image.filepath.replace('\\','/').split('/')[-1]
        if basename not in {'stone-colour.png','stone-roughness.png'}:continue
        image.filepath=str(TEXTURES/basename);image.reload()
        # Blender defers decoding FILE images: has_data can be false immediately
        # after reload even when the PNG exists. Pack the verified source bytes.
        raw=(TEXTURES/basename).read_bytes();image.pack(data=raw,data_len=len(raw))
        assert image.packed_file and image.packed_file.size==len(raw)
        assert image.size[0]==1024,(name,image.name,image.filepath,list(image.size))
        repaired.append(basename)
    assert set(repaired)=={'stone-colour.png','stone-roughness.png'},repaired
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    print('SOURCE_TEXTURES_PACKED',name,repaired)
