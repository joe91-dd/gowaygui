import {Color,Layers,Material,Mesh,MeshRenderer,Node,utils,Vec4} from 'cc';
import type {ArtV2Assets} from './ArtV2Assets';
import type {LevelDefinition} from '../core/types';
import {battleTheme} from '../core/battleThemes';
import {routeClearance} from '../core/mapPresentation';

/** The same route distance drives the visible road and the forbidden placement corridor. */
export class ThemedBattleTerrain {
 private mesh?:Mesh;private material?:Material;
 create(parent:Node,level:LevelDefinition,art:ArtV2Assets,wave=1,bossIndex=0):void{
  this.destroy();const theme=battleTheme(level.id,wave,bossIndex),frame=art.battleFrame(theme.atlas)!;
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
  const columns=180,rows=102;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
   const u=col/columns,v=row/rows,x=(u-.5)*18,z=(v-.5)*10.13;
   positions.push(x,-.075,z);normals.push(0,1,0);uvs.push(u,v);
   colors.push(Math.min(1,routeClearance(level,{x,z})/1.05),0,1,1);
   if(row&&col){const b=row*(columns+1)+col,a=b-columns-1;indices.push(a-1,b-1,a,a,b-1,b);}
  }
  this.mesh=utils.createMesh({positions,normals,uvs,colors,indices});
  const m=this.material=new Material();m.initialize({effectAsset:art.terrainEffect!});
  m.setProperty('mainTexture',art.battleFrame('terrain-material-atlas')!.texture);
  m.setProperty('themeTexture',frame.texture);m.setProperty('surfaceParams',new Vec4(0,3,1,level.id));
  // A one-pixel inset prevents neighbouring atlas panels from bleeding at the coast.
  const ix=1/frame.texture.width,iy=1/frame.texture.height;
  m.setProperty('themeRect',new Vec4(theme.panel%2*.5+ix,Math.floor(theme.panel/2)*.5+iy,.5-ix*2,.5-iy*2));
  m.setProperty('roadColor',new Color(theme.road));m.setProperty('mainColor',Color.WHITE);
  const node=new Node('主题地景 · '+theme.name+' · 实际行进路线');node.setParent(parent);node.layer=Layers.Enum.DEFAULT;
  const renderer=node.addComponent(MeshRenderer);renderer.mesh=this.mesh;renderer.setSharedMaterial(m,0);
 }
 destroy():void{this.mesh?.destroy();this.material?.destroy();this.mesh=undefined;this.material=undefined;}
}
