import type {GameSave,Turtle} from './types';
/** Loan turtles are independent saved copies. They never alias the owner's archive. */
export function visiblePets(s:GameSave):Turtle[]{return Object.values(s.collection).concat((s.community?.loans??[]).filter(l=>!l.finished&&(!!l.usedBy||l.expiresAt>s.clockHighWater)).map(l=>l.turtle));}
export function accessiblePet(s:GameSave,id:string):Turtle|undefined{return visiblePets(s).find(t=>t.id===id);}
export function loanLabel(s:GameSave,id:string):string{const l=s.community?.loans.find(l=>l.id===id);return l?(l.kind==='rental'?'租赁':'借用')+' · '+(l.finished||(!l.usedBy&&l.expiresAt<=s.clockHighWater)?'剩余0次':l.usedBy?'本次参战中':'剩余1次'):'';}
export function editablePet(s:GameSave,id:string):Turtle|undefined{if(s.collection[id])return s.collection[id];return s.community?.loans.find(l=>l.id===id&&!l.finished&&!l.usedBy&&l.expiresAt>s.clockHighWater)?.turtle;}
