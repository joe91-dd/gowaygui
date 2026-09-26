import {game} from 'cc';
let software:boolean|undefined;
export function softwareRendering():boolean{
 if(software!==undefined)return software;
 try{const gl=game.canvas&&(game.canvas.getContext('webgl2')||game.canvas.getContext('webgl'));if(!gl)return false;const e=gl.getExtension('WEBGL_debug_renderer_info');const name=String(e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));software=/SwiftShader|llvmpipe|Microsoft Basic Render|Software|WARP/i.test(name);return software;}catch{return false;}
}
