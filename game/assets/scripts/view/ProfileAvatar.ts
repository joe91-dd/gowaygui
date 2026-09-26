import {ImageAsset,Texture2D,SpriteFrame,Sprite,UITransform,Node,isValid} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {Role} from '../core/types';

/** User-chosen pictures remain in the local save. No network upload or automatic camera access. */
export function paintAvatar(parent:Node,data:string,side:number):void{
  if(typeof Image==='undefined')return;
  const picture=new Image();picture.onload=()=>{
    if(!isValid(parent,true))return;
    const asset=new ImageAsset(picture),texture=new Texture2D();texture.image=asset;
    const frame=new SpriteFrame();frame.texture=texture;
    const host=parent.children.find(n=>n.name==='头像裁切')??parent;
    const node=new Node('自选头像');node.layer=parent.layer;node.setParent(host);
    const sprite=node.addComponent(Sprite);sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;
    node.getComponent(UITransform)!.setContentSize(side,side);
    node.once(Node.EventType.NODE_DESTROYED,()=>{frame.destroy();texture.destroy();asset.destroy();});
  };picture.src=data;
}
export function avatarPicker(ui:IslandUI,service:GameService,close:()=>void,error:(e:unknown)=>void):void{
  const p=ui.sheet('更换头像','选择龟龟头像，或使用自己的照片。照片仅保存在本机。',close);
  const choose=(role:Role,image?:string)=>{try{service.updateAvatar(`avatar:${Date.now()}:${service.snapshot.revision}`,{role,...(image?{image}:{})});close();}catch(e){error(e);}};
  (['stone','spike','crystal','leaf','bubble'] as Role[]).forEach((role,i)=>{
    const n=ui.button('',-400+i*200,60,156,156,()=>choose(role),{parent:p,selected:service.snapshot.avatar?.role===role&&!service.snapshot.avatar.image});
    ui.portrait(role,0,0,136,n);
  });
  const pick=(camera:boolean)=>{
    if(typeof document==='undefined'){ui.toast('当前平台暂不支持照片选择');return;}
    const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
    if(camera)input.setAttribute('capture','user');
    input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12*1024*1024){ui.toast('请选择12MB以内的照片');return;}
      const url=URL.createObjectURL(file),image=new Image();
      image.onerror=()=>{URL.revokeObjectURL(url);ui.toast('照片无法读取，请换一张');};
      image.onload=()=>{try{
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法处理照片');
        const side=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);
        if(ui.isInteractive(p))choose(service.snapshot.avatar?.role??'crystal',canvas.toDataURL('image/jpeg',.88));
      }catch(e){error(e);}finally{URL.revokeObjectURL(url);}};image.src=url;
    };input.click();
  };
  const camera=async()=>{
    if(typeof document==='undefined'||typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia){pick(true);return;}
    let stream:MediaStream|undefined,disposed=false;
    const previous=document.activeElement as HTMLElement|null;
    const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','拍照头像');
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#123e4dcc;display:grid;place-items:center;padding:20px;font-family:system-ui;color:#163f55';
    const panel=document.createElement('div');panel.style.cssText='background:#fff9ec;border-radius:24px;padding:24px;width:min(420px,90vw);box-sizing:border-box;text-align:center;box-shadow:0 12px 60px #062a3866';
    const title=document.createElement('h2');title.textContent='拍照头像';title.style.margin='0 0 12px';
    const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.style.cssText='width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px;background:#d6e7e3;transform:scaleX(-1)';
    const hint=document.createElement('p');hint.textContent='请允许使用摄像头，照片只保存在本机。';hint.style.cssText='font-size:14px;line-height:1.6';
    const controls=document.createElement('div');controls.style.cssText='display:flex;gap:12px;justify-content:center';
    const shutter=document.createElement('button'),cancel=document.createElement('button');
    shutter.textContent='拍照并使用';cancel.textContent='取消';shutter.disabled=true;
    [shutter,cancel].forEach((button,i)=>{button.style.cssText=`border:1px solid #73c8cd;border-radius:14px;padding:12px 20px;font:600 16px system-ui;cursor:pointer;color:${i?'#163f55':'white'};background:${i?'#f7f4e9':'#039fac'}`;controls.appendChild(button);});
    panel.append(title,video,hint,controls);overlay.appendChild(panel);document.body.appendChild(overlay);
    const cleanup=()=>{if(disposed)return;disposed=true;stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;overlay.remove();document.removeEventListener('keydown',keys);window.removeEventListener('pagehide',cleanup);p.off(Node.EventType.NODE_DESTROYED,cleanup);previous?.focus();};
    const keys=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cleanup();}else if(event.key==='Tab'){event.preventDefault();(document.activeElement===cancel&&!shutter.disabled?shutter:cancel).focus();}};
    cancel.onclick=cleanup;document.addEventListener('keydown',keys);window.addEventListener('pagehide',cleanup);p.once(Node.EventType.NODE_DESTROYED,cleanup);cancel.focus();
    shutter.onclick=()=>{try{
      if(!video.videoWidth||!video.videoHeight||!ui.isInteractive(p))return;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法处理照片');
      const side=Math.min(video.videoWidth,video.videoHeight);ctx.translate(256,0);ctx.scale(-1,1);ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,256,256);
      const data=canvas.toDataURL('image/jpeg',.88);cleanup();choose(service.snapshot.avatar?.role??'crystal',data);
    }catch(e){cleanup();error(e);}};
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:720}},audio:false});
      if(disposed||!ui.isInteractive(p)){stream.getTracks().forEach(track=>track.stop());cleanup();return;}
      video.srcObject=stream;await video.play();if(disposed)return;shutter.disabled=false;hint.textContent='调整位置后拍照，预览范围就是头像裁切范围。';
    }catch(e){if(disposed)return;cleanup();ui.toast('无法打开摄像头，可检查相机权限或选择上传照片。');}
  };
  ui.button('上传照片',-190,-160,300,56,()=>pick(false),{parent:p,primary:true,size:26});
  ui.button('拍照 / 相机',190,-160,300,56,()=>{void camera();},{parent:p,size:26});
  ui.text('照片居中裁切；打开相机后预览，拍照并使用。仅保存在本机。',0,-244,21,UI_COLORS.sand,p,1050,40);
}
