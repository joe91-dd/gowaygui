import {Component,Node,Sprite} from 'cc';
import {CompanionMotion} from './CompanionMotion';
import type {Role} from '../core/types';
import type {ArtV2Assets} from './ArtV2Assets';

/** The same original-image rig, expressions and equipment emitters as the home hero. */
export class CompanionDisplay extends Component {
 private motion?:CompanionMotion;
 private reduced:()=>boolean=()=>false;
 setup(sprite:Sprite,role:Role,parent:Node,art:ArtV2Assets,reduced:()=>boolean):void{this.motion=new CompanionMotion(sprite,role,parent,art);this.reduced=reduced;}
 update(dt:number):void{this.motion?.update(dt,this.reduced());}
}
