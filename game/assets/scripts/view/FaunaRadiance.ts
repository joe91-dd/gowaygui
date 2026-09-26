import {Color,Material,MeshRenderer,Node,resources,Texture2D,Vec3} from 'cc';
interface Binding {renderer:MeshRenderer;slot:number;source:Material}
interface Glow {material:Material;world:boolean;phase:number;textures:Texture2D[];glow:boolean}
/** Mutation affects prepared shell regions; face, eyes and ivory trim retain their atlas. */
export class FaunaRadiance {
 private materials=new Map<string,Glow>();
 private sourceIds=new WeakMap<Material,number>();private nextSourceId=0;
 private roots=new Map<Node,{signature:string;bindings:Binding[]}>();private time=0;private lastUpdate=0;
 private destroyed=false;private atlases=new Map<string,Promise<Texture2D|null>>();private ownedAtlases:Texture2D[]=[];
 private atlas(path:string):Promise<Texture2D|null>{
  if(!resources.getInfoWithPath(path,Texture2D))return Promise.resolve(null);
  let pending=this.atlases.get(path);
  if(!pending){pending=new Promise(resolve=>resources.load(path,Texture2D,(error,texture)=>{
   if(error||!texture){console.warn('[G1_MUTATION_LOAD]',path,error);resolve(null);return;}
   if(this.destroyed){resolve(null);return;}
   texture.addRef();this.ownedAtlases.push(texture);resolve(texture);
  }));this.atlases.set(path,pending);}
  return pending;
 }
 apply(root:Node,tier:number,colour:string,mutates:boolean,key=''):void{
  const signature=tier+'/'+colour+'/'+mutates+'/'+key;
  const surface=mutates&&tier<5&&/^g1-(b\d\d|e01)$/.test(key);
  let entry=this.roots.get(root);
  if(entry?.signature===signature)return;
  if(!entry){
   const bindings:Binding[]=[];
   for(const renderer of root.getComponentsInChildren(MeshRenderer))for(let slot=0;slot<renderer.sharedMaterials.length;slot++){
    const source=renderer.sharedMaterials[slot];
    if(source?.effectName==='builtin-standard'&&/G1_.*Atlas|CC0_Gem_/.test(source.name))bindings.push({renderer,slot,source});
   }
   entry={signature:'',bindings};this.roots.set(root,entry);
   root.once(Node.EventType.NODE_DESTROYED,()=>this.roots.delete(root));
  }
  for(const {renderer,slot,source} of entry.bindings){
   if(!renderer.isValid)continue;
   const variant=source.name.includes('Variant_Atlas'),glow=/Glow_Atlas|CC0_Gem_/.test(source.name);
   if(!surface&&!variant&&!glow)continue;
   // Locally adapted Standard materials may have no imported asset UUID.
   let sourceId=this.sourceIds.get(source);if(sourceId===undefined){sourceId=++this.nextSourceId;this.sourceIds.set(source,sourceId);}
   const cache=sourceId+'/'+signature;
   let record=this.materials.get(cache);
   if(!record){
    const material=new Material();material.copy(source);material.name=source.name+'_Grade_'+tier;
    if(surface||variant)material.setProperty('mainColor',new Color(surface?'#FFFFFF':mutates?colour:'#FFFFFF'));
    // Production pass: keep the source atlas, but give every enemy a consistent
    // coated-paint response so the gallery and battle view read as the same asset.
    material.setProperty('specularIntensity',.68);
    if(!glow){material.setProperty('roughness',surface?.48:variant?.54:.62);material.setProperty('emissiveScale',new Vec3(0,0,0));}
    else {material.setProperty('emissive',new Color(colour));material.setProperty('roughness',.30);material.setProperty('metallic',.08);material.setProperty('specularIntensity',.78);}
    const textures:Texture2D[]=[];const texture=source.getProperty('mainTexture');
    if(texture instanceof Texture2D){texture.addRef();textures.push(texture);}
    record={material,world:glow&&tier===6,phase:this.materials.size*1.39,textures,glow};this.materials.set(cache,record);
    if(surface){const grade=['blue','purple','orange','red','gold'][Math.max(0,Math.min(4,tier))];
     void this.atlas(`enemy-g1/variants/${key.slice(3)}/${grade}/texture`).then(texture=>{if(texture&&!this.destroyed&&material.isValid)material.setProperty('mainTexture',texture);});
    }
   }
   renderer.setSharedMaterial(record.material,slot);
  }
  entry.signature=signature;
 }
 update(dt:number):void{
  this.time+=dt;if(this.time-this.lastUpdate<.08)return;this.lastUpdate=this.time;
  for(const {material,world,phase,glow} of this.materials.values()){
   if(!glow)continue;
   const n=.12+Math.pow(.5+.5*Math.sin(this.time*1.7+phase),3)*(world?.28:.14);
   material.setProperty('emissiveScale',new Vec3(n,n,n));
  }
 }
 destroy():void{
  this.destroyed=true;
  this.roots.clear();
  for(const {material,textures} of this.materials.values()){material.destroy();for(const texture of textures)texture.decRef();}
  this.materials.clear();
  for(const texture of this.ownedAtlases)texture.decRef();this.ownedAtlases=[];this.atlases.clear();
 }
}
