import {initCommunity} from './community';
import {makeInitialSave} from './game';
import {LEVELS} from './data';
import type {Role,SkillId} from './types';
import {validateSave} from './save';

/** An independent review seed. The caller must put it in memory-only storage. */
export function allMapsReviewSave(now:number,advancedAppearance=false,starterBalance=false){
 const s=makeInitialSave(now,0x61326);
 s.unlockedLevel=LEVELS.length-1;s.cleared=LEVELS.map(l=>l.id);s.tutorialDone=true;s.tutorialStarted=true;
 s.gold=200000;s.materials={attack:80,health:80,defense:80,growth:80};
 const builds:Record<Role,SkillId[]>={
  stone:['hold','stoneMastery','armor','block','taunt','reflect','regen','counterStorm'],
  spike:['piercingShot','spikeMastery','combo','scatter','critical','lifesteal','swift','pursuit'],
  crystal:['crystalCannon','crystalMastery','arcane','bounce','calm','spellDrain','extraTarget','pursuit'],
  leaf:['greatHeal','leafMastery','doubleHeal','healShield','holyLight','cleanse','strong','calm'],
  bubble:['bubbleRing','spirit','root','weaken','shredArmor','calm','resist','strong'],
 };
 const extras:Record<Role,SkillId[]>={stone:['resist','strong'],spike:['armor','strong'],crystal:['strong','resist'],leaf:['armor','regen'],bubble:['armor','regen']};
 if(!starterBalance)for(const t of Object.values(s.collection))t.skills=[...builds[t.role],...(advancedAppearance?extras[t.role]:[])];
 initCommunity(s,now);validateSave(s);return s;
}
