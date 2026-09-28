import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../docs/wix-racehub-navigation.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
test('Wix feature links preserve selections while booking, home and unrelated links remain intact',()=>{
  const cases=[
    ['https://www.cobracardiff.co.uk/driver-distance-tracker','https://racehub.cobracardiff.co.uk/?tracker=1'],
    ['https://www.cobracardiff.co.uk/sword-schedule','https://racehub.cobracardiff.co.uk/schedule/?type=sword'],
    ['https://www.cobracardiff.co.uk/virtual-race-replay?race=7072625&compare=A&compare=B#track','https://racehub.cobracardiff.co.uk/virtual-race-replay/?race=7072625&compare=A&compare=B#track'],
    ['https://www.cobracardiff.co.uk/event-list',null],
    ['https://www.cobracardiff.co.uk/',null],
    ['https://www.cobracardiff.co.uk/grand-prix-wales',null],
    ['https://cobracardiff.liverc.com/results/',null],
    ['https://example.com/race-stats',null]
  ];
  const links=cases.map(([href])=>({href,target:'_self',hasAttribute:()=>false}));
  let handler,assigned;
  runInNewContext(code,{URL,Object,MutationObserver:class{observe(){}},location:{href:'https://www.cobracardiff.co.uk/',assign:href=>assigned=href},document:{documentElement:{nodeType:1,matches:()=>false,querySelectorAll:()=>links},addEventListener:(_,fn)=>handler=fn}});
  cases.forEach(([original,expected],i)=>assert.equal(links[i].href,expected||original));
  let prevented=false,stopped=false;
  handler({target:{closest:()=>links[2]},button:0,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});
  assert.equal(assigned,cases[2][1]);assert.ok(prevented&&stopped);
  assigned=null;prevented=false;
  handler({target:{closest:()=>links[0]},button:0,ctrlKey:true,preventDefault:()=>prevented=true,stopImmediatePropagation(){}});
  assert.equal(assigned,null);assert.equal(prevented,false);
});
