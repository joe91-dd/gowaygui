import {Color, isValid, Material, MeshRenderer, Node, Texture2D, Vec3, Vec4} from 'cc';

interface AdaptedMaterial {
  source:Material;
  native:Material;
  textures:Texture2D[];
  users:number;
}
interface Binding { renderer:MeshRenderer; slot:number; material:AdaptedMaterial }
interface AdaptedRoot { bindings:Binding[]; onDestroyed:()=>void }

/**
 * Reversible bridge for explicitly named authored FBX atlases, not an art recolor.
 * Keeps the original images and replaces the DCC specular conversion with native Standard.
 * One adapter may own many turtle instances; it never modifies the source/pipeline material.
 */
export class TurtleMaterialAdapter {
  private readonly roots=new Map<Node,AdaptedRoot>();
  private readonly materials=new Map<Material,AdaptedMaterial>();
  private disposed=false;
  private readonly surfaces=new Map<string,{normal:Texture2D;surface:Texture2D}>();
  registerSurface(key:string,normal:Texture2D,surface:Texture2D):void{
    if(this.disposed||this.surfaces.has(key))return;normal.addRef();surface.addRef();this.surfaces.set(key,{normal,surface});
  }

  constructor(private readonly pipelineMaterial:Material,private readonly atlasPrefixes:readonly string[]=['StoneAtlas_']){
    if(pipelineMaterial.effectName!=='builtin-standard'||pipelineMaterial.technique!==0){
      throw new Error('石龟材质适配需要项目的原生 Standard 不透明材质');
    }
    // Material.copy does not acquire an Asset reference to its effect; retain the template.
    pipelineMaterial.addRef();
  }

  /** Call after instantiate. Idempotent; zero means this node has no eligible StoneAtlas. */
  apply(root:Node):number{
    if(this.disposed||!isValid(root,true))return 0;
    const existing=this.roots.get(root);if(existing)return existing.bindings.length;
    const record:AdaptedRoot={bindings:[],onDestroyed:()=>this.release(root)};
    this.roots.set(root,record);
    try{
      for(const renderer of root.getComponentsInChildren(MeshRenderer)){
        if(!isValid(renderer,true))continue;
        for(let slot=0;slot<renderer.sharedMaterials.length;slot++){
          const source=renderer.getSharedMaterial(slot);
          if(!source||!(source.effectName==='imported-specular-glossiness'||source.effectName.endsWith('/imported-specular-glossiness'))||!this.atlasPrefixes.some(prefix=>prefix.length>0&&source.name.startsWith(prefix)))continue;
          const material=this.materials.get(source)||this.createMaterial(source);
          if(!material)continue;
          material.users++;record.bindings.push({renderer,slot,material});
          renderer.setSharedMaterial(material.native,slot);
        }
      }
    }catch(error){this.release(root);throw error;}
    if(record.bindings.length)root.once(Node.EventType.NODE_DESTROYED,record.onDestroyed);
    else this.roots.delete(root);
    return record.bindings.length;
  }

  /** Restore only slots still owned by this adapter; preserve any later external override. */
  release(root:Node):void{
    const record=this.roots.get(root);if(!record)return;
    this.roots.delete(root);
    if(isValid(root))root.off(Node.EventType.NODE_DESTROYED,record.onDestroyed);
    for(const {renderer,slot,material} of record.bindings){
      if(isValid(renderer,true)&&isValid(renderer.node,true)&&renderer.getSharedMaterial(slot)===material.native){
        renderer.setSharedMaterial(material.source,slot);
      }
      material.users--;
      if(material.users===0){
        this.materials.delete(material.source);material.native.destroy();
        for(const texture of material.textures)texture.decRef();
        material.source.decRef();
      }
    }
  }

  /** Restores living instances and releases all references acquired by this adapter. */
  destroy():void{
    if(this.disposed)return;this.disposed=true;
    for(const root of Array.from(this.roots.keys()))this.release(root);
    for(const maps of this.surfaces.values()){maps.normal.decRef();maps.surface.decRef();}this.surfaces.clear();
    this.pipelineMaterial.decRef();
  }

  private createMaterial(source:Material):AdaptedMaterial|null{
    const colour=source.getProperty('mainTexture');
    const detail=Array.from(this.surfaces.entries()).find(([key])=>source.name.startsWith('CC0_CoastalAtlas_'+key))?.[1];
    const roughness=detail?.surface??source.getProperty('shininessExponentMap');
    const normal=detail?.normal;const hasNormal=normal instanceof Texture2D&&isValid(normal);
    const modern=source.name.startsWith('G1_')||source.name.startsWith('CC0_');
    // A missing texture leaves the authored material intact; never replace it with grey.
    if(!modern&&(!(colour instanceof Texture2D)||!(roughness instanceof Texture2D)||!isValid(colour)||!isValid(roughness)))return null;
    const hasColour=colour instanceof Texture2D&&isValid(colour),hasRoughness=(!!detail||!modern)&&roughness instanceof Texture2D&&isValid(roughness);
    const textures:Texture2D[]=[];if(hasColour)textures.push(colour as Texture2D);if(hasRoughness&&roughness!==colour)textures.push(roughness as Texture2D);
    if(hasNormal)textures.push(normal!);
    const native=new Material();native.name=`${source.name}_NativeStandard`;
    source.addRef();for(const texture of textures)texture.addRef();
    try{
      // Base Material.recompileShaders is a warning-only no-op in 3.8.8.
      // copy(overrides) creates the correct native shader variants immediately.
      native.copy(this.pipelineMaterial,{technique:0,defines:{
        USE_ALBEDO_MAP:hasColour,USE_PBR_MAP:hasRoughness,USE_NORMAL_MAP:hasNormal,
        USE_OCCLUSION_MAP:false,USE_EMISSIVE_MAP:false,USE_VERTEX_COLOR:false,
        USE_ALPHA_TEST:false,USE_TWOSIDE:false,IS_ANISOTROPY:false,
      }});
      const authoredColour=source.getProperty('mainColor');
      native.setProperty('mainColor',modern&&authoredColour instanceof Color?authoredColour:new Color(255,255,255,255));
      native.setProperty('albedoScale',new Vec3(1,1,1));
      if(hasColour)native.setProperty('mainTexture',colour);
      if(hasRoughness)native.setProperty('pbrMap',roughness);
      if(hasNormal){native.setProperty('normalMap',normal);native.setProperty('normalStrength',.78);}
      // Standard: R=AO, G=roughness, B=metallic, A=specular intensity.
      // Legacy stone uses grayscale roughness; refined bosses preserve independent G/B channels.
      const crystal=source.name.includes('Crystal')||source.name.includes('CC0_Gem_'),coastal=source.name.includes('CC0_CoastalAtlas_'),brass=/Brass|brass/.test(source.name);
      // Aholo G1 materials often omit a separate roughness texture.  The old
      // .77 fallback made painted shells read as flat grey under the island
      // light; a controlled .62 gives the albedo a readable highlight without
      // turning the turtles into chrome.
      const equipment=source.name.includes('_Equipment_');
      native.setProperty('roughness',detail?1:modern?(crystal?.25:brass?.38:equipment?.46:coastal?.64:.62):1);
      native.setProperty('metallic',detail?1:brass?.45:equipment?.12:crystal?.06:0);
      native.setProperty('occlusion',0);
      native.setProperty('specularIntensity',modern?.72:.5); // keep legacy F0; brighten G1 coated surfaces
      native.setProperty('emissive',crystal?new Color(source.name.includes('chaoxing')?'#8063AF':'#267F9D'):new Color(0,0,0,255));
      native.setProperty('emissiveScale',crystal?new Vec3(.20,.20,.20):new Vec3(0,0,0));
      const tiling=source.getProperty('tilingOffset');
      native.setProperty('tilingOffset',tiling instanceof Vec4?new Vec4(tiling.x,tiling.y,tiling.z,tiling.w):new Vec4(1,1,0,0));
    }catch(error){
      native.destroy();for(const texture of textures)texture.decRef();source.decRef();throw error;
    }
    const result:AdaptedMaterial={source,native,textures,users:0};this.materials.set(source,result);return result;
  }
}
