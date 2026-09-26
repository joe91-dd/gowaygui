// Hide Cocos' default debug counter overlay in the presentation package.
// Local qa=1 diagnostics remain available; battle scripts/assets are unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const build=path.resolve(process.argv[2]||path.join(__dirname,'../build/vfx-integrated-20260920'));
const file=path.join(build,'application.js'),source=fs.readFileSync(file,'utf8');
assert.match(source,/this\.showFPS = (true|false);/,'unrecognized Cocos application template');
fs.writeFileSync(file,source.replace('this.showFPS = true;','this.showFPS = false;'));
console.log('Hidden debug counter overlay: '+file);
