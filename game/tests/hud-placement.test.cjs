const test=require('node:test'),assert=require('node:assert/strict');
const {hudPlacementIssue}=require('../.test-build/core/hudPlacement.js');
const rects=[{left:-640,right:640,bottom:301,top:360},{left:164,right:640,bottom:-360,top:-255}];
test('角色脚在可见处但头或武器进入顶部UI时拒绝摆放',()=>{assert.ok(hudPlacementIssue({x:0,y:250},{x:0,y:325},rects));assert.equal(hudPlacementIssue({x:0,y:195},{x:0,y:270},rects),undefined);});
test('技能栏向上、向左留出完整点击身体余量；空白陆地区域不多占用',()=>{assert.ok(hudPlacementIssue({x:185,y:-249},{x:185,y:-180},rects));assert.ok(hudPlacementIssue({x:148,y:-272},{x:148,y:-200},rects));assert.equal(hudPlacementIssue({x:80,y:-210},{x:80,y:-135},rects),undefined);});
