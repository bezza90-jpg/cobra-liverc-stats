import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const snippet=readFileSync(new URL('../docs/wix-racehub-navigation.html',import.meta.url),'utf8');
const code=snippet.match(/<script>([\s\S]*?)<\/script>/)[1];
test('Wix feature links preserve selections while booking, home and unrelated links remain intact',()=>{
  const cases=[
    ['https://www.cobracardiff.co.uk/driver-distance-tracker','https://racehub.cobracardiff.co.uk/?tracker=1'],
    ['https://www.cobracardiff.co.uk/sword-schedule','https://racehub.cobracardiff.co.uk/schedule/?type=sword'],
    ['https://www.cobracardiff.co.uk/track-gallery','https://racehub.cobracardiff.co.uk/track-gallery/'],
    ['https://www.cobracardiff.co.uk/virtual-race-replay?race=7072625&compare=A&compare=B#track','https://racehub.cobracardiff.co.uk/virtual-race-replay/?race=7072625&compare=A&compare=B#track'],
    ['https://www.cobracardiff.co.uk/virtual-race-replay/3d.html?race=7072625','https://racehub.cobracardiff.co.uk/virtual-race-replay/3d.html?race=7072625'],
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

test('Wix loads the hosted shared header and privacy footer',()=>{
  assert.match(snippet,/assets\/wix-site-shell\.js/);
  const loader=readFileSync(new URL('../public/assets/wix-site-shell.js',import.meta.url),'utf8');
  assert.match(loader,/>2D Virtual Replay</);
  assert.match(loader,/>3D Virtual Replay</);
  assert.match(loader,/virtual-race-replay\/3d\.html/);
  assert.match(loader,/class=\\"cobra-site-footer\\"/);
  assert.match(loader,/data-cobra-shared-footer=\\"1\\"/);
  assert.match(loader,/Privacy &amp; cookies/);
  assert.match(loader,/data-cobra-original-footer/);
  assert.match(loader,/document\.body\.append\(replacement\)/);
  assert.doesNotMatch(snippet,/class="cobra-site-header"/);
});
