import {Color,EffectAsset,Mat4,Material,Mesh,MeshRenderer,Node,utils,Vec3,Vec4} from 'cc';

type Flow={root:Node;material:Material;role:string;phase:number;growth:boolean};

/** Equipment effects constructed in the approved mesh's bind coordinates.
 * The inverse joint bind puts every vertex on its actual weapon, so animation
 * cannot detach the effect from the bow or staff. No screen-space overlays.
 */
export class CastEquipmentEffects{
 private flows:Flow[]=[];private meshes:Mesh[]=[];
 constructor(private effect:EffectAsset){}
 attach(model:Node,role:string):void{
  const find=(n:Node,name:string):Node|undefined=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean);
  const joint=find(model,role==='leaf'?'lantern':'weapon');if(!joint)return;
  const inverse=new Mat4();Mat4.invert(inverse,joint.worldMatrix);
  const local=(x:number,y:number,z:number)=>{const p=Vec3.transformMat4(new Vec3(),new Vec3(-x,z,-y),model.worldMatrix);return Vec3.transformMat4(p,p,inverse);};
  // FBX bones can carry centimetre conversion even when the visible model is
  // metre-sized. Tube thickness must use the same bind transform as its path.
  const radiusScale=Vec3.distance(local(0,0,0),local(1,0,0));
  const x=role==='spike'||role==='leaf'?-.91:.92,y=role==='spike'||role==='leaf'?-.48:-.45;
  const make=(points:Vec3[],radius:number,color:string,phase:number,growth=false)=>{
   radius*=radiusScale;
   const pos:number[]=[],uv:number[]=[],normals:number[]=[],indices:number[]=[],sides=6;
   for(let i=0;i<points.length;i++){
    const tangent=Vec3.subtract(new Vec3(),points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]).normalize();
    const axis=Vec3.cross(new Vec3(),tangent,Math.abs(tangent.y)>.8?new Vec3(1,0,0):new Vec3(0,1,0)).normalize(),bitangent=Vec3.cross(new Vec3(),tangent,axis).normalize();
    for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides,n=Vec3.add(new Vec3(),Vec3.multiplyScalar(new Vec3(),axis,Math.cos(a)),Vec3.multiplyScalar(new Vec3(),bitangent,Math.sin(a)));const p=Vec3.scaleAndAdd(new Vec3(),points[i],n,radius);pos.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uv.push(i/(points.length-1),j/(sides-1));if(i){const k=i*sides+j,b=i*sides+(j+1)%sides;indices.push(k-sides,k,b-sides,b-sides,k,b);}}
   }
   const mesh=utils.createMesh({positions:pos,indices,normals,uvs:uv});this.meshes.push(mesh);const root=new Node('装备表面能量-'+role);root.layer=joint.layer;root.setParent(joint);const r=root.addComponent(MeshRenderer);r.mesh=mesh;const m=new Material();m.initialize({effectAsset:this.effect});m.setProperty('tint',new Color(color));m.setProperty('motion',new Vec4(0,0,0,0));r.setSharedMaterial(m,0);this.flows.push({root,material:m,role,phase,growth});
  };
  if(role==='spike'){
   const bow=[[x+.1,y,.53],[x-.20,y,.71],[x-.24,y,1.03],[x,y,1.24],[x-.18,y,1.59],[x-.12,y,1.95],[x+.02,y,2.06]];
   for(let strand=0;strand<2;strand++){
    const pts:Vec3[]=[];for(let i=0;i<=90;i++){const t=i/90*(bow.length-1),j=Math.min(bow.length-2,Math.floor(t)),q=t-j,phase=i*.48+strand*Math.PI;const a=bow[j],b=bow[j+1];pts.push(local(a[0]+(b[0]-a[0])*q+Math.cos(phase)*.06,a[1]+Math.sin(phase)*.065,a[2]+(b[2]-a[2])*q));}make(pts,.014,strand?'#B4DBA0':'#548F74',strand*.8,true);
   }
   for(let k=0;k<8;k++){const t=(k+.5)/8*(bow.length-1),j=Math.min(bow.length-2,Math.floor(t)),q=t-j,a=bow[j],b=bow[j+1],xx=a[0]+(b[0]-a[0])*q,zz=a[2]+(b[2]-a[2])*q,s=k%2?1:-1;make([local(xx,y-.062,zz),local(xx+s*.07,y-.077,zz+.075),local(xx+s*.045,y-.068,zz+.14)],.013,'#B6D99B',k*.15,true);}
  }else if(role==='crystal'){
   for(let strand=0;strand<3;strand++){
    const pts:Vec3[]=[];for(let i=0;i<=72;i++){const t=i/72,a=-Math.PI*.55+t*Math.PI*3.2,r=.34*(1-t)+.035;pts.push(local(x+Math.cos(a)*r,y-.026-strand*.012,2.54+Math.sin(a)*r));}make(pts,.009+strand*.002,strand===1?'#D4F7FF':'#66CBEF',strand*1.5);
   }
  }else if(role==='bubble'){
   for(let j=0;j<6;j++){const a=j*Math.PI/3,pts=[];for(let i=0;i<=16;i++){const t=i/16;pts.push(local(x+Math.cos(a)*(.025+t*.35),y-.08,2.56+Math.sin(a)*(.025+t*.35)));}make(pts,.013,j%2?'#DAC5FF':'#9874DC',j*.6,true);}
   const pts=[];for(let i=0;i<=60;i++){const a=i/60*Math.PI*2;pts.push(local(x+Math.cos(a)*.10,y+Math.sin(a)*.08,2.55+Math.sin(a*2)*.075));}make(pts,.009,'#D9C2FF',0);
  }else if(role==='leaf'){
   for(let j=0;j<4;j++){const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push(local(x+Math.sin(t*7+j)*(.025+j*.009),y-.13, .55+t*.32));}make(pts,.010+j*.003,j%2?'#FFE6A8':'#FFB567',j*.7,true);}
  }
 }
 update(time:number):void{for(const f of this.flows){const pulse=.5+.5*Math.sin(time*(f.role==='leaf'?2.3:1.6)-f.phase);const growth=f.growth?Math.min(1,Math.max(.01,(Math.sin(time*.52-f.phase*.13)+.25)*1.4)):0;const brightness=f.role==='bubble'?Math.pow(pulse,4)*.85+.12:.20+pulse*.5;f.material.setProperty('motion',new Vec4(time,brightness,growth,0));}}
 clear():void{for(const f of this.flows){f.root.destroy();f.material.destroy();}this.flows=[];for(const m of this.meshes)m.destroy();this.meshes=[];}
 destroy():void{this.clear();}
}
