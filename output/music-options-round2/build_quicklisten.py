"""Two 64-second samplers: outside combat 0-20, battle 22-42, boss 44-64."""
from pathlib import Path
import math, os, sys
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['OMP_NUM_THREADS']='1'
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tmp/tools/audio/python-libs'))
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
for group in ('a','b'):
    segments=[]
    for role in ('home','battle','boss'):
        data,sr=sf.read(HERE/'listening'/f'{group}-{role}.ogg',dtype='float32',always_2d=True)
        # The same 30-second entry point as the comparison page.
        clip=data[30*sr:50*sr]
        assert len(clip)==20*sr
        if sr!=44100:
            gcd=math.gcd(sr,44100)
            clip=resample_poly(clip,44100//gcd,sr//gcd).astype(np.float32)
        if clip.shape[1]==1: clip=np.repeat(clip,2,axis=1)
        fade=np.linspace(0,1,11025,dtype=np.float32)[:,None]
        clip[:11025]*=fade
        clip[-11025:]*=fade[::-1]
        if segments: segments.append(np.zeros((88200,2),dtype=np.float32))
        segments.append(clip)
    result=np.concatenate(segments)
    path=HERE/f'{group.upper()}-64秒串听.ogg'
    with sf.SoundFile(path,mode='w',samplerate=44100,channels=2,format='OGG',subtype='VORBIS') as out:
        for pos in range(0,len(result),16384):out.write(result[pos:pos+16384])
    print(path,sf.info(path).duration)
