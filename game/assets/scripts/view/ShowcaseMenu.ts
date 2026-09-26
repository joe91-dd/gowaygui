import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {showcasePets} from '../core/honor';
import {PetDetails} from './PetDetails';
import {visualName} from './VisualIdentity';

export class ShowcaseMenu {
 constructor(private ui:IslandUI,private service:GameService,private command:(kind:string)=>string,private error:(e:unknown)=>void){}
 open(done:()=>void,selected=showcasePets(this.service.snapshot).map(t=>t.id),page=0):void{
  const s=this.service.snapshot,pets=Object.values(s.collection).filter(t=>!s.community?.hiddenPets.includes(t.id)),pages=Math.max(1,Math.ceil(pets.length/6)),current=Math.max(0,Math.min(page,pages-1));
  const p=this.ui.dialog('我的荣耀展示','选1至5只自有伙伴 · 按选择顺序轮换 · 不影响战斗阵容与成绩',()=>p.parent?.destroy(),1140,652);
  const reopen=(ids:string[],n=current)=>{p.parent?.destroy();this.open(done,ids,n);};
  pets.slice(current*6,current*6+6).forEach((t,i)=>{
   const active=selected.includes(t.id);this.ui.card(t.role,visualName(t),t.skills.length+' 技能',active?'展示顺序 '+(selected.indexOf(t.id)+1):'查看并选择',-354+i%3*354,97-Math.floor(i/3)*183,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:active?'取消展示':'加入展示',disabled:!active&&selected.length>=5,confirm:()=>reopen(active?selected.filter(id=>id!==t.id):selected.concat(t.id))}),{parent:p,turtle:t,selected:active});
  });
  if(!pets.length)this.ui.text('暂无可展示的公开伙伴',0,0,25,UI_COLORS.sand,p,750,70);
  this.ui.button('‹',-454,-252,70,45,()=>reopen(selected,current-1),{parent:p,disabled:current===0,size:28});this.ui.text((current+1)+' / '+pages,-350,-252,20,UI_COLORS.sand,p,110,30);
  this.ui.button('›',-247,-252,70,45,()=>reopen(selected,current+1),{parent:p,disabled:current===pages-1,size:28});
  this.ui.button('保存展示 · '+selected.length+'只',206,-252,480,48,()=>{try{this.service.communityAction(this.command('showcase'),{kind:'showcase',ids:selected,rotate:s.community?.showcase?.rotate??true});p.parent?.destroy();done();}catch(e){this.error(e);}},{parent:p,primary:true,disabled:!selected.length,size:24});
 }
 toggle(done:()=>void):void{try{const s=this.service.snapshot,ids=showcasePets(s).map(t=>t.id);if(!ids.length){this.open(done);return;}this.service.communityAction(this.command('showcase'),{kind:'showcase',ids,rotate:!(s.community?.showcase?.rotate??true)});done();}catch(e){this.error(e);}}
}
