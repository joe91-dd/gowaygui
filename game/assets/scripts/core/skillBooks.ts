import type {SkillId, Turtle} from './types';
import {random} from './random';
import type {RandomState} from './random';
import {skillsForRole,SKILL_BY_ID} from './data';
import {requireRule} from './save';

export interface SkillBookReceipt {
  turtleId: string;
  bookSkillId: SkillId;
  replacedSkillId: SkillId;
  /** Zero-based position in beforeSkills; all existing positions are equally likely. */
  replacedIndex: number;
  beforeSkills: SkillId[];
  afterSkills: SkillId[];
}

export interface SkillBookApplication {
  turtle: Turtle;
  receipt: SkillBookReceipt;
}
export function skillBookIssue(turtle:Turtle,id:SkillId):string|undefined{
  const skill=SKILL_BY_ID[id];
  if(skill?.specialization)return '进阶主动技仅可通过局内合成至3阶获得，不能学习进阶技能书';
  if(!skill||!skillsForRole(turtle.role).includes(id))return '该技能不适合当前职业';
  if(turtle.skills.includes(id))return '已经拥有该技能';
  if(skill.requires&&!turtle.skills.includes(skill.requires))return '需先拥有'+SKILL_BY_ID[skill.requires].name;
  if(skill.specialization&&turtle.skills.length<2)return '需要至少2个技能位，专精学习会保留职业主动';
}

/**
 * Apply a book to a validated permanent turtle without modifying that object.
 * The caller owns the outside-run guard, inventory and atomic save transaction.
 * Only a valid application advances the supplied transaction's random state.
 * The returned turtle keeps its identity; existing run snapshots stay separate.
 */
export function applySkillBook(state: RandomState, turtle: Turtle, bookSkillId: SkillId): SkillBookApplication {
  requireRule(state && Number.isSafeInteger(state.rng) && state.rng >= 0 && state.rng <= 4294967295, '随机状态不可用');
  requireRule(turtle && typeof turtle.id === 'string' && turtle.id.length > 0 && Array.isArray(turtle.skills)
    && turtle.innate && turtle.training && Array.isArray(turtle.parentIds), '龟资料不完整');
  const allowed = skillsForRole(turtle.role);
  requireRule(turtle.skills.length >= 1 && turtle.skills.length <= 12
    && new Set(turtle.skills).size === turtle.skills.length
    && turtle.skills.every(skill => skillsForRole(turtle.role,true).includes(skill)), '龟的现有技能组合不合法');
  requireRule(allowed.includes(bookSkillId), '这本技能书不适合该职业');
  requireRule(!turtle.skills.includes(bookSkillId), '这只龟已经拥有书上的技能');
  const issue=skillBookIssue(turtle,bookSkillId);requireRule(!issue,issue??'不能学习');

  const beforeSkills = [...turtle.skills];
  const next: Turtle = {
    ...turtle,
    skills: [...beforeSkills],
    innate: {...turtle.innate},
    training: {...turtle.training},
    parentIds: [...turtle.parentIds],
  };
  // Specialization occupies one of the existing twelve slots; its prerequisite cannot be overwritten by this application.
  const prerequisite=SKILL_BY_ID[bookSkillId].requires;
  const eligible=beforeSkills.map((_,i)=>i).filter(i=>beforeSkills[i]!==prerequisite);
  const replacedIndex = eligible[Math.floor(random(state) * eligible.length)];
  const replacedSkillId = beforeSkills[replacedIndex];
  next.skills[replacedIndex] = bookSkillId;
  return {
    turtle: next,
    receipt: {turtleId: turtle.id, bookSkillId, replacedSkillId, replacedIndex,
      beforeSkills, afterSkills: [...next.skills]},
  };
}
