"""Read-only bitmap analysis: extract navigation data; never edits artwork."""
import json, math, heapq, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
W,H=422,233
def masks(stage):
    im=Image.open(ROOT/f'assets/resources/art-modern/map-coast-stage-{stage}.png').convert('RGB').resize((W,H)).filter(ImageFilter.MedianFilter(3))
    a=np.asarray(im,dtype=np.float32);r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    mask=(r>195)&(g>145)&(r-g>(4 if stage==35 else 9))&(g-b>(8 if stage==35 else 25))&(b<235)
    mask=np.asarray(Image.fromarray(mask.astype('uint8')*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
    # Distance to road boundary, in 4-pixel cells (8-neighbour chamfer).
    d=np.where(mask,1000.,0.)
    for y in range(H):
      for x in range(W):
       if d[y,x]:
        d[y,x]=min(d[y,x],d[y-1,x]+1 if y else 1000,d[y,x-1]+1 if x else 1000,d[y-1,x-1]+1.414 if x and y else 1000)
    for y in range(H-1,-1,-1):
      for x in range(W-1,-1,-1):
       if d[y,x]:
        d[y,x]=min(d[y,x],d[y+1,x]+1 if y+1<H else 1000,d[y,x+1]+1 if x+1<W else 1000,d[y+1,x+1]+1.414 if x+1<W and y+1<H else 1000)
    return a,mask,d
def nearest(p,mask,d,radius=35):
    x,y=np.array(p)/4; yy,xx=np.mgrid[0:H,0:W];dist=np.hypot(xx-x,yy-y)
    score=np.where(mask&(dist<radius), dist-.95*np.minimum(d,20), 1e9)
    j,i=np.unravel_index(score.argmin(),score.shape);return (int(i),int(j))
def route(start,end,mask,d):
    q=[(0,start)]; cost={start:0}; prev={}; moves=[(1,0,1),(-1,0,1),(0,1,1),(0,-1,1),(1,1,1.414),(-1,-1,1.414),(1,-1,1.414),(-1,1,1.414)]
    while q:
      score,p=heapq.heappop(q)
      if p==end:break
      if score>cost[p]+1e-6:continue
      x,y=p
      for dx,dy,step in moves:
       nx,ny=x+dx,y+dy
       if nx<0 or nx>=W or ny<0 or ny>=H or not mask[ny,nx]:continue
       c=score+step*(1+55/(d[ny,nx]**2+1))
       if c<cost.get((nx,ny),1e20):cost[(nx,ny)]=c;prev[(nx,ny)]=p;heapq.heappush(q,(c,(nx,ny)))
    if end not in cost:raise ValueError(f'disconnected road {start}->{end}')
    points=[end]
    while points[-1]!=start:points.append(prev[points[-1]])
    return list(reversed(points))
def simplify(points,epsilon=1.1):
    if len(points)<3:return points
    a=np.array(points[0]);b=np.array(points[-1]);v=b-a;l=np.dot(v,v)
    ds=[np.linalg.norm(np.array(p)-(a+np.clip(np.dot(np.array(p)-a,v)/l,0,1)*v)) if l else np.linalg.norm(np.array(p)-a) for p in points]
    i=int(np.argmax(ds))
    if ds[i]<=epsilon:return [points[0],points[-1]]
    return simplify(points[:i+1],epsilon)[:-1]+simplify(points[i:],epsilon)
def runs(v):
    groups=[];cur=[]
    for i,ok in enumerate(v):
      if ok:cur.append(i)
      elif cur:
       if len(cur)>=5:groups.append(round(sum(cur)/len(cur)))
       cur=[]
    if len(cur)>=5:groups.append(round(sum(cur)/len(cur)))
    return groups
def extract(stage,spec):
    a,mask,d=masks(stage)
    entries=spec.get('entries') or [[0,y*4] for y in runs(mask[:,0])]+[[x*4,0] for x in runs(mask[0,:])]+[[x*4,932] for x in runs(mask[-1,:])]
    goal=spec['goal'];end=nearest([goal[0]-65,goal[1]],mask,d)
    routes=[]
    chains=spec.get('chains') or [[p] for p in entries]
    for chain in chains:
      way=[nearest(p,mask,d) for p in chain]+[end];line=[]
      for s,e in zip(way,way[1:]):line.extend(route(s,e,mask,d)[:-1])
      line.append(end);line=simplify(line);pixels=[[x*4,y*4] for x,y in line]
      # The source edge is a spawn and the pearl is the sole terminal.
      if chain[0][0]==0:pixels.insert(0,[0,pixels[0][1]])
      elif chain[0][1]==0:pixels.insert(0,[pixels[0][0],0])
      elif chain[0][1]==932:pixels.insert(0,[pixels[0][0],932])
      pixels.append(goal);routes.append(pixels)
    return {'routes':routes,'entries':entries,'size':[1688,932]}
if __name__=='__main__':
    specs=json.loads((ROOT/'tools/map-route-specs.json').read_text(encoding='utf-8'))
    dest=ROOT/'tools/map-route-analysis.json';out=json.loads(dest.read_text()) if dest.exists() else {}
    for stage in map(int,sys.argv[1:]):
      try:out[str(stage)]=extract(stage,specs[str(stage)]);print(stage,[len(r) for r in out[str(stage)]['routes']],flush=True)
      except Exception as ex:print(stage,'ERROR',str(ex),flush=True);continue
      dest.write_text(json.dumps(out,ensure_ascii=False),encoding='utf-8')
    dest.write_text(json.dumps(out,ensure_ascii=False),encoding='utf-8')
