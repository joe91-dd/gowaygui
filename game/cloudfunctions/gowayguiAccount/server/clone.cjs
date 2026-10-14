'use strict';
const {serialize,deserialize}=require('node:v8');
// CloudBase's Node 16 runtime has no global structuredClone. Preserve nested
// save data, undefined values and repeated references without a JSON roundtrip.
const clone=typeof globalThis.structuredClone==='function'
 ?globalThis.structuredClone.bind(globalThis)
 :value=>deserialize(serialize(value));
module.exports=clone;
