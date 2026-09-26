import {Color,EffectAsset,Layers,Material,Mesh,MeshRenderer,Node,Texture2D,utils,Vec4} from 'cc';
import {mapBounds,routeClearance} from '../core/mapPresentation';
import type {LevelDefinition} from '../core/types';

/** A continuous land/road surface. The road distance comes from simulation paths. */
export class CoastalTerrain {
 private mesh?:Mesh;private material?:Material;
 create(parent:Node,level:LevelDefinition,texture:Texture2D,effect:EffectAsset):void{
  const {rx,rz}=mapBounds(level),positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
  const rings=64,sectors=144,theme=level.id===56?0:level.id===55?13:level.id<50?Math.floor(level.id/5):level.id-40;
  const tiles=[[0,3],[2,3],[1,3],[1,3],[2,4],[1,4],[2,5],[2,4],[1,4],[2,4],[1,4],[2,5],[1,4],[2,4],[0,4]];
  for(let r=0;r<=rings;r++)for(let s=0;s<=sectors;s++){
   const a=s/sectors*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),v=r/rings;
   const edge=1+.012*Math.sin(a*7+level.id)+.009*Math.cos(a*13-level.id*.7);
   const x=Math.sign(c)*Math.pow(Math.abs(c),.25)*rx*v*edge,z=Math.sign(sn)*Math.pow(Math.abs(sn),.25)*rz*v*edge;
   const road=routeClearance(level,{x,z}),coast=Math.max(0,(v-.955)/.045),cliff=Math.min(1,coast*1.2);
   const y=.027-Math.pow(cliff,1.9)*.53+(road>.7&&v<.94?.012*Math.sin(x*1.7)*Math.cos(z*1.3):0);
   positions.push(x,y,z);normals.push(0,1,0);uvs.push(x/3.7,z/3.7);
   colors.push(Math.min(1,road/1.05),Math.min(1,coast),.82+.18*Math.sin(a*9+level.id)*Math.sin(a*9+level.id),1);
   if(r&&s){const b=r*(sectors+1)+s,t=b-sectors-1;indices.push(t-1,b-1,t,t,b-1,b);}
  }
  this.mesh=utils.createMesh({positions,normals,uvs,colors,indices});this.material=new Material();this.material.initialize({effectAsset:effect});
  this.material.setProperty('mainTexture',texture);this.material.setProperty('surfaceParams',new Vec4(tiles[theme][0],tiles[theme][1],0,level.id));this.material.setProperty('mainColor',Color.WHITE);
  const n=new Node('连贯地表 · 土路路肩 · 海岸岩层');n.layer=Layers.Enum.DEFAULT;n.setParent(parent);const renderer=n.addComponent(MeshRenderer);renderer.mesh=this.mesh;renderer.setSharedMaterial(this.material,0);
 }
 destroy():void{this.mesh?.destroy();this.material?.destroy();}
}
