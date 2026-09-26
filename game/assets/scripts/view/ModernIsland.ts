import {Color,Mat4,Mesh,primitives,Quat,utils,Vec3} from 'cc';
import type {LevelDefinition,Point} from '../core/types';

/** One vertex-coloured mesh keeps shore, roads and sparse vegetation inexpensive. */
export function modernIslandMesh(level:LevelDefinition,textured=false):Mesh{
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  const routes=level.routes??[level.route],points=routes.flat().concat(level.slots);
  const rx=Math.max(6,...points.map(p=>Math.abs(p.x)))+1.8,rz=Math.max(2.8,...points.map(p=>Math.abs(p.z)))+1.3;
  const theme=Math.floor(level.id/5)%10;
  const grass=['#AECF89','#9ECAA0','#A3C6A5','#B8C98B','#A2C4B8','#AAC998','#93C6B6','#BACB96','#A9BF9B','#9CBEC4'][theme];
  const add=(shape:{positions:number[];normals?:number[];indices?:number[];uvs?:number[]},hex:string,p:Vec3,scale:Vec3,rotation=new Quat())=>{
    const layer=hex===grass?0:['#F4DFBA','#F8E9C9'].includes(hex)?1:['#D6BE99','#C5B091','#C1AC8B','#E3D1AF'].includes(hex)?2:['#E7D8BB','#F7EFDC'].includes(hex)?3:-1;
    const c=new Color(textured&&layer>=0?(layer===0?'#C7E1DC':layer===2?'#EEEAE4':'#FFFFFF'):hex),base=positions.length/3,m=new Mat4();Mat4.fromRTS(m,rotation,p,scale);
    for(let i=0;i<shape.positions.length;i+=3){
      const v=Vec3.transformMat4(new Vec3(),new Vec3(...shape.positions.slice(i,i+3) as [number,number,number]),m);positions.push(v.x,v.y,v.z);
      const source=shape.normals??[],n=Vec3.transformQuat(new Vec3(),new Vec3((source[i]??0)/scale.x,(source[i+1]??1)/scale.y,(source[i+2]??0)/scale.z),rotation).normalize();normals.push(n.x,n.y,n.z);
      colors.push(c.r/255,c.g/255,c.b/255,1);
      if(!textured)uvs.push(0,0);
      else if(layer<0)uvs.push(.99,.99);
      else{
        const u=layer===2?(Math.atan2(v.z,v.x)+Math.PI)/(2*Math.PI):Math.max(0,Math.min(1,(v.x/rx+1)/2));
        const w=layer===2?Math.max(0,Math.min(1,-v.y/.85)):Math.max(0,Math.min(1,(v.z/rz+1)/2));
        uvs.push((layer%2)*.5+.006+u*.488,Math.floor(layer/2)*.5+.006+w*.488);
      }
    }
    for(const index of shape.indices??[])indices.push(base+index);
  };
  const sphere=primitives.sphere(.5,{segments:textured?16:10}),cylinder=primitives.cylinder(.5,.5,1,{radialSegments:textured?20:12}),box=primitives.box();
  const item=(shape:typeof sphere,hex:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rot:Vec3=new Vec3())=>add(shape,hex,new Vec3(x,y,z),new Vec3(sx,sy,sz),Quat.fromEuler(new Quat(),rot.x,rot.y,rot.z));
  const boundary=(factor:number,y:number)=>Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,c=Math.cos(a),s=Math.sin(a),jitter=1+Math.sin(i*1.7+theme)*.016;return new Vec3(Math.sign(c)*Math.sqrt(Math.abs(c))*rx*factor*jitter,y,Math.sign(s)*Math.sqrt(Math.abs(s))*rz*factor*jitter);});
  const triangle=(a:Vec3,b:Vec3,c:Vec3,hex:string)=>{const n=Vec3.cross(new Vec3(),Vec3.subtract(new Vec3(),b,a),Vec3.subtract(new Vec3(),c,a)).normalize();add({positions:[a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z],normals:[n.x,n.y,n.z,n.x,n.y,n.z,n.x,n.y,n.z],indices:[0,1,2]},hex,new Vec3(),new Vec3(1,1,1));};
  const top=boundary(1,-.04),bottom=boundary(.96,-.8),green=boundary(.90,-.012);
  for(let i=0;i<48;i++){const j=(i+1)%48;triangle(new Vec3(0,-.04,0),top[j],top[i],'#F4DFBA');triangle(new Vec3(0,-.012,0),green[j],green[i],grass);triangle(top[i],top[j],bottom[i],i%3?'#D6BE99':'#C5B091');triangle(bottom[i],top[j],bottom[j],'#C1AC8B');}
  const road=level.stationVersion===2?.84:1.28;
  for(const route of routes)for(let i=0;i<route.length;i++){
    const p=route[i];item(cylinder,'#F8E9C9',p.x,.012,p.z,road,.075,road);
    if(i){const a=route[i-1],dx=p.x-a.x,dz=p.z-a.z;item(box,'#F8E9C9',(p.x+a.x)/2,.012,(p.z+a.z)/2,road,.075,Math.hypot(dx,dz),new Vec3(0,Math.atan2(dx,dz)*180/Math.PI,0));}
  }
  const distance=(p:Point)=>Math.min(...routes.flatMap(route=>route.slice(1).map((b,i)=>{const a=route[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);})),...level.slots.map(s=>Math.hypot(p.x-s.x,p.z-s.z)));
  // Sparse vegetation stays away from every route and landing location.
  if(textured)for(let i=0;i<25;i++){
    const a=i/25*Math.PI*2+.21,p={x:Math.cos(a)*rx*.94,z:Math.sin(a)*rz*.92};if(distance(p)<1.15)continue;
    item(sphere,'#E3D1AF',p.x,-.18,p.z,.58+Math.sin(i*4)*.16,.56,.48,new Vec3(i*17,i*43,8));
  }
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2+.17,p={x:Math.cos(a)*rx*.87,z:Math.sin(a)*rz*.85};if(distance(p)<1.8)continue;
    item(sphere,'#E3D1AF',p.x,.12,p.z,.65,.4,.5);
    if(i%3===0){
      for(let j=0;j<4;j++)item(cylinder,j%2?'#BD8D5D':'#CB9D68',p.x+j*.08,.24+j*.36,p.z,.22-j*.025,.42,.22-j*.025,new Vec3(0,0,-10));
      for(let j=0;j<5;j++){const angle=j/5*Math.PI*2;
        if(!textured)item(sphere,j%2?'#76B862':'#93C971',p.x+.3+Math.cos(angle)*.44,1.58,p.z+Math.sin(angle)*.44,1.35,.12,.36,new Vec3(8,j*72,10));
        else{
          const center=new Vec3(p.x+.3,1.64,p.z),tip=new Vec3(center.x+Math.cos(angle)*1.35,1.34,center.z+Math.sin(angle)*1.35),mid=new Vec3(center.x+Math.cos(angle)*.63,1.87,center.z+Math.sin(angle)*.63);
          const left=new Vec3(mid.x-Math.sin(angle)*.25,mid.y-.08,mid.z+Math.cos(angle)*.25),right=new Vec3(mid.x+Math.sin(angle)*.25,mid.y-.08,mid.z-Math.cos(angle)*.25);
          triangle(center,left,mid,'#79AF6E');triangle(center,mid,right,'#9FC783');triangle(mid,left,tip,'#79AF6E');triangle(mid,tip,right,'#9FC783');
        }
      }
    }else for(let j=0;j<3;j++)item(sphere,j%2?'#77B777':'#90BF78',p.x+(j-1)*.18,.14,p.z,.33,.32,.5,new Vec3(10,35*j,20));
  }
  const base=level.stationVersion===2?1:1.38,cap=level.stationVersion===2?.92:1.28;
  for(const p of level.slots){item(cylinder,'#E7D8BB',p.x,.12,p.z,base,.24,base);item(cylinder,'#F7EFDC',p.x,.25,p.z,cap,.025,cap);}
  return utils.createMesh({positions,normals,colors,uvs,indices});
}
