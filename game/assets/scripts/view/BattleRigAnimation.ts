import {MeshRenderer,Node,SkeletalAnimation,SkinnedMeshRenderer} from 'cc';
const prepared=new WeakSet<Node>();
const equipmentSockets=new WeakSet<Node>();
function findJoint(node:Node,names:string[]):Node|undefined{
 if(names.includes(node.name.toLowerCase()))return node;
 for(const child of node.children){const found=findJoint(child,names);if(found)return found;}
 return undefined;
}
function socketAt(animation:SkeletalAnimation,joint:Node):Node|undefined{
 const names:string[]=[];let ancestor:Node|null=joint;
 while(ancestor&&ancestor!==animation.node){names.unshift(ancestor.name);ancestor=ancestor.parent;}
 return ancestor===animation.node&&names.length?(animation.createSocket(names.join('/'))??undefined):undefined;
}
/** Baked animation requires a socket for rigid equipment to follow a joint. */
export function prepareBattleRig(root:Node):SkeletalAnimation[]{
 const animations=root.getComponentsInChildren(SkeletalAnimation);
 if(prepared.has(root))return animations;
 for(const animation of animations){
  animation.useBakedAnimation=true;
  const hand=findJoint(animation.node,['hand.r','hand_r','r_hand','weapon_hand','lantern_hand']);
  for(const renderer of root.getComponentsInChildren(MeshRenderer)){
   const object=renderer.node;
   if(renderer instanceof SkinnedMeshRenderer||!hand)continue;
   if(/weapon|lantern|staff|bow|shield|sword|提灯|法杖|弓|盾|剑/i.test(object.name)&&object.parent!==hand)object.setParent(hand,true);
  }
  const targets:Node[]=[];
  const walk=(node:Node)=>{
   if(equipmentSockets.has(node))return;
   if(node!==animation.node&&(node.name.startsWith('FX_')||node.getComponent(MeshRenderer)&&!node.getComponent(SkinnedMeshRenderer))){targets.push(node);return;}
   for(const child of node.children)walk(child);
  };
  walk(animation.node);
  const sockets=new Map<Node,Node>();
  for(const target of targets){
   const parent=target.parent;if(!parent||parent===animation.node)continue;
   let socket=sockets.get(parent);
   if(!socket){socket=socketAt(animation,parent);if(!socket)continue;sockets.set(parent,socket);}
   target.setParent(socket,true);
  }
 }
 prepared.add(root);
 return animations;
}
/** Separate weapon exports place the grip at their origin, with Y pointing up. */
export function attachRigidWeapon(root:Node,weapon:Node,role:string,baked=true):boolean{
 const left=role==='stone'||role==='spike';
 const hand=findJoint(root,left?['hand.l','hand_l','l_hand']:['hand.r','hand_r','r_hand']);
 const animation=root.getComponentsInChildren(SkeletalAnimation)[0];
 if(!hand||!animation){weapon.destroy();return false;}
 animation.useBakedAnimation=baked;
 const socket=baked?socketAt(animation,hand):hand;
 if(!socket){weapon.destroy();return false;}
 equipmentSockets.add(socket);
 weapon.setParent(socket,false);weapon.setPosition(0,0,0);
 // The generated weapon files use a neutral Y-up grip. Keep the grip local to
 // the hand socket so the socket drives every facing, attack and skill pose.
 const euler:Record<string,[number,number,number]>={
  stone:[0,90,0],spike:[0,0,90],crystal:[0,0,0],leaf:[0,90,0],bubble:[0,0,0]
 };
 weapon.setRotationFromEuler(...(euler[role]??[0,0,0]));
 const scale=role==='leaf'?.42:role==='stone'?.62:role==='spike'?.66:.78;
 weapon.setScale(scale,scale,scale);
 return true;
}
