import type {GameSave,Turtle} from './types';

/** Cosmetic only: never changes score order, battle roster or pet ownership. */
export function showcasePets(s:GameSave,fallback?:Turtle):Turtle[]{
 const ids=s.community?.showcase?.ids??[];
 const pets=ids.map(id=>s.collection[id]).filter((t):t is Turtle=>!!t&&!s.community?.hiddenPets.includes(t.id));
 if(pets.length)return pets;
 if(fallback&&s.collection[fallback.id]&&!s.community?.hiddenPets.includes(fallback.id))return [fallback];
 return Object.values(s.collection).filter(t=>!s.community?.hiddenPets.includes(t.id)).slice(0,1);
}
