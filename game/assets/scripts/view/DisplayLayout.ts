/** Native Cocos stores camera priority as uint32_t. Negative priorities wrap and
 * render the backdrop over both the world and all interactive UI on Android. */
export const CAMERA_ORDER={backdrop:0,world:10,ui:20} as const;

/** Uniform cover for decorative scenery only. UI and playable map geometry keep
 * their authored scale so phone adaptation cannot move routes or touch targets. */
export function sceneryCoverScale(width:number,height:number):number{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 1;
  return Math.max(width/1280,height/720);
}

/** Fill a phone with the authored battle plate using one uniform camera zoom.
 * Routes, ground UVs, actor transforms and ray-based touch coordinates stay in
 * their shared world space. Only outer decorative artwork is cropped. */
export function battleCoverHalfHeight(width:number,height:number,modeMap=false):number{
  const aspect=width>0&&height>0?width/height:16/9;
  const artHeight=18*(modeMap?941/1672:932/1688);
  return Math.min(9/aspect,artHeight/2);
}

export function homeAdventureFold(width:number):{hiddenX:number;tabX:number}{
  const half=Math.max(1280,width)/2;
  return {hiddenX:260-half-24,tabX:-half+32};
}
