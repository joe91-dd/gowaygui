/** Screen-space checks keep a whole selectable character clear of the HUD. */
export interface HudRect {left:number;right:number;bottom:number;top:number}
export function hudPlacementIssue(feet:{x:number;y:number},head:{x:number;y:number},rects:HudRect[]):string|undefined{
 if(![feet.x,feet.y,head.x,head.y].every(Number.isFinite))return '请选择地图上的位置';
 const body={left:Math.min(feet.x,head.x)-28,right:Math.max(feet.x,head.x)+28,bottom:feet.y-13,top:Math.max(feet.y+68,head.y)+12};
 if(rects.some(r=>body.left<r.right+8&&body.right>r.left-8&&body.bottom<r.top+8&&body.top>r.bottom-8))return '这里会被战斗信息栏遮挡，请向地图内侧放置';
}
