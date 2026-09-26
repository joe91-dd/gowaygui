import type {LevelDefinition,Point} from './types';
/** Coordinates authored against the approved 1672 x 941 environment, never inferred from decoration. */
export const coastPoint=(x:number,y:number):Point=>({x:x/1672*18-9,z:y/941*10.13-5.065});
export function approvedCoast(levels:LevelDefinition[]):LevelDefinition[]{return levels.map(m=>m.id!==0?m:{...m,stationVersion:3});}

