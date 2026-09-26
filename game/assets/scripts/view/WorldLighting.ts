import {Color, director, DirectionalLight, MeshRenderer, Node, renderer, Scene} from 'cc';

/** A single sun and a bounded shadow map keep the toy forms grounded. */
export function lightIsland(scene:Scene,softShadows=true):void{
  const shadows=scene.globals.shadows;shadows.enabled=true;shadows.type=1;shadows.shadowMapSize=1024;
  // Keep the authored palette readable on low-end devices.  The old scene
  // relied on a very low LDR sky fill, which compressed albedo into grey while
  // the directional light was occluded by the island.  Lift only the ambient
  // fill; materials and texture colors remain untouched.
  const hdr=director?.root?.pipeline?.pipelineSceneData?.isHDR===true;
  const ambient=scene.globals.ambient;
  if(ambient){
    // Public setters update the live render resource. HDR lux must never leak into LDR units.
    ambient.skyIllum=hdr?Math.max(ambient.skyIllum,28000):Math.min(1.2,Math.max(ambient.skyIllum,1.05));
    ambient.skyLightingColor=new Color(219,232,245,255);
    ambient.groundLightingColor=new Color(147,151,130,255);
  }
  const sun=scene.getComponentInChildren(DirectionalLight);
  if(sun){
    sun.node.setRotationFromEuler(-55,-32,0);sun.shadowEnabled=true;sun.shadowBias=.002;sun.shadowNormalBias=.025;
    // A compact island is viewed from one fixed camera: use one shadow frustum.
    // Creator otherwise defaults to four cascades and repeats the same small scene.
    sun.enableCSM=false;
    // Explicit 4-tap PCF; resolution, ambient and illumination stay unchanged for A/B review.
    sun.shadowPcf=softShadows?renderer.scene.PCFType.SOFT:renderer.scene.PCFType.HARD;
    sun.illuminance=hdr?Math.max(sun.illuminance||0,78000):Math.min(2,Math.max(sun.illuminance||0,1.35));
  }
}

export function receiveIslandShadows(root:Node,cast=true):void{
  for(const mesh of root.getComponentsInChildren(MeshRenderer)){
    mesh.receiveShadow=cast?1:0;mesh.shadowCastingMode=cast?MeshRenderer.ShadowCastingMode.ON:MeshRenderer.ShadowCastingMode.OFF;
  }
}
