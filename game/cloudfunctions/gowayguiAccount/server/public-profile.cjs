'use strict';
const crypto=require('node:crypto');
const structuredClone=require('./clone.cjs');
function publicName(id){return '岛主'+crypto.createHash('sha256').update(String(id)).digest('hex').slice(0,10).toUpperCase();}
function publicPet(pet){const copy=structuredClone(pet);copy.name='';return copy;}
module.exports={publicName,publicPet};
