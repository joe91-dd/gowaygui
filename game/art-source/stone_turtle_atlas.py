"""Original full-atlas generator, extracted from the preserved c11 source.

No raster inputs. Palette, deterministic noise, UV-tile layout and analytic eye
regions are the editable source. Use inside Blender (bpy + bundled numpy).
"""
from pathlib import Path
import bpy
import numpy as np

PALETTE = [
    (.27,.26,.22), (.34,.33,.27), (.23,.24,.21), (.38,.35,.28),
    (.29,.33,.14), (.43,.46,.22), (.55,.54,.29), (.57,.46,.24),
    (.12,.15,.10), (.93,.90,.76), (.16,.19,.11), (.035,.045,.025),
    (.77,.73,.565), (.37,.40,.20), (.96,.94,.83), (.18,.19,.15),
]

def build_atlas(output_dir, *, iris_colour=(.22,.235,.125), noise_seed=4127, size=1024):
    """Generate all 16 tiles and all roughness pixels directly from parameters."""
    output_dir = Path(output_dir); output_dir.mkdir(parents=True, exist_ok=True)
    assert size % 4 == 0
    tile = size // 4; pixels = np.ones((size,size,4),dtype=np.float32)
    yy,xx = np.mgrid[0:tile,0:tile].astype(np.float32)
    noise_rng = np.random.default_rng(noise_seed)
    for index,base in enumerate(PALETTE):
        noise = noise_rng.normal(0,.009,(tile,tile))
        mineral = .017*np.sin(xx*.075+np.sin(yy*.038)*2.7)*np.sin(yy*.061)
        if index > 7: mineral *= .15; noise *= .3
        rgba = np.ones((tile,tile,4),dtype=np.float32)
        for channel in range(3): rgba[:,:,channel] = np.clip(base[channel]+noise+mineral,0,1)
        if index < 4:
            vein = np.exp(-np.abs(np.sin(xx*.024+yy*.042+np.sin(xx*.043)))*75)*.022
            rgba[:,:,:3] += vein[:,:,None]
        if index == 9:
            u=(xx+.5)/tile; v=(yy+.5)/tile
            iris_distance = np.sqrt(((u-.5)/.415)**2+((v-.49)/.411)**2)
            pupil_distance = np.sqrt(((u-.5)/.302)**2+((v-.49)/.314)**2)
            angle = np.arctan2(v-.49,u-.5)
            iris = np.zeros_like(rgba[:,:,:3]); grain=.012*np.sin(angle*37+iris_distance*10)
            for channel,value in enumerate(iris_colour):
                iris[:,:,channel] = value+grain-.060*np.clip((iris_distance-.76)/.24,0,1)
            blend=np.clip((1-iris_distance)*tile/1.4,0,1)[:,:,None]
            rgba[:,:,:3] = rgba[:,:,:3]*(1-blend)+iris*blend
            pupil=np.clip((1-pupil_distance)*tile/1.3,0,1)[:,:,None]
            rgba[:,:,:3] = rgba[:,:,:3]*(1-pupil)+np.array((.022,.028,.017))*pupil
            for cx,cy,rx,ry,colour in [(.405,.665,.056,.067,(.98,.97,.90)),(.632,.363,.019,.025,(.78,.84,.65))]:
                glint=np.clip((1-np.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2))*tile/1.4,0,1)[:,:,None]
                rgba[:,:,:3]=rgba[:,:,:3]*(1-glint)+np.array(colour)*glint
        pixels[(index//4)*tile:(index//4+1)*tile,(index%4)*tile:(index%4+1)*tile]=rgba
    colour = bpy.data.images.new('StoneTurtle_Colour_1024_Rebuilt',width=size,height=size,alpha=True)
    colour.pixels.foreach_set(pixels.ravel()); colour.filepath_raw=str(output_dir/'stone-colour.png')
    colour.file_format='PNG'; colour.save(); colour.pack()
    rough_pixels=np.ones((size,size,4),dtype=np.float32)
    for index in range(16):
        roughness=.57 if index<4 else (.20 if index in (9,10,11,14) else .43)
        rough_pixels[(index//4)*tile:(index//4+1)*tile,(index%4)*tile:(index%4+1)*tile,:3]=roughness
    rough=bpy.data.images.new('StoneTurtle_Roughness_1024_Rebuilt',width=size,height=size,alpha=True)
    rough.colorspace_settings.name='Non-Color'; rough.pixels.foreach_set(rough_pixels.ravel())
    rough.filepath_raw=str(output_dir/'stone-roughness.png'); rough.file_format='PNG'; rough.save(); rough.pack()
    parameters={'generator':'stone_turtle_atlas.py','raster_inputs':[], 'size':size,'tile_grid':[4,4],
        'noise_seed':noise_seed,'palette':PALETTE,'iris_colour':list(iris_colour),
        'iris_uv_center':[.5,.49],'iris_uv_radii':[.415,.411], 'pupil_uv_radii':[.302,.314],
        'provenance':'Original math/UV/noise formulas extracted from build_stone_turtle_candidate11.py; full colour and roughness maps are regenerated.'}
    return colour,rough,parameters
