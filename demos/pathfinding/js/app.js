import {Ground} from './ground.js';
import {Network} from './algorithm.js';
import {Agent} from './agent.js';
import {aStar} from './pathfinder.js';
import {ascentLevel} from './levels.js';
import {CELL_SIZE as C,WORLD_W as W,WORLD_H as H} from './constants.js';
const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status'),metrics=document.querySelector('#metrics'),run=document.querySelector('#run');
const ground=new Ground();
let network,agent,start,goal,path=[],running=false,tool='ground',cursor=null,dragging=false,dragAction=null,keyboardMove=null,steps=0,frame=0,last=0,accumulator=0;
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
function message(text){if(status.textContent!==text)status.textContent=text;}
function findRoute(){path=aStar(network.graph,[agent.curr_x,agent.curr_y],goal);}
function valid(p){return network.graph.has(p.join(','));}
function updateControls(){run.textContent=running?'Pause':'Run agent';run.disabled=!running&&(!path.length||!valid(start)||!valid(goal));metrics.textContent=`${network.graph.size} nodes · ${[...network.graph.values()].reduce((n,m)=>n+m.size,0)} links`;}
function pause(){running=false;cancelAnimationFrame(frame);frame=0;last=0;accumulator=0;updateControls();}
function resetAgent(){pause();agent=new Agent(start,.6);steps=0;findRoute();updateControls();message(!valid(start)||!valid(goal)?'Place start and goal above platforms.':path.length?'Ready. Run the agent or edit the level.':'No route. Try moving the goal or adding platforms.');draw();}
function rebuild(){network=new Network();network.build(ground);resetAgent();}
function restore(){cursor=null;keyboardMove=null;releasePointer();const level=ascentLevel();ground.clear();ground.setCells(level.cells);start=[...level.start];goal=[...level.goal];rebuild();}
function toggleRun(){if(running){pause();message('Paused. Run to continue.');return;}if(run.disabled)return;running=true;agent.active=true;updateControls();message('Following the route…');last=0;frame=requestAnimationFrame(tick);}
function step(){findRoute();agent.AI(path,network.graph);agent.physics(ground.cells,H);steps++;findRoute();if(agent.on_grnd&&same([agent.grid_x,agent.grid_y],goal)){pause();message('Goal reached. Change the level and try another route.');}else if(!agent.active){pause();message('The agent fell. Reset or adjust the level.');}else if(steps>=3600){pause();message('Route not completed. Reset or adjust the platforms.');}}
function tick(now){if(!running)return;if(last)accumulator+=Math.min((now-last)/1000,.1);last=now;while(accumulator>=1/60&&running){accumulator-=1/60;step();}draw();if(running)frame=requestAnimationFrame(tick);}
function line(a,b,color,width=1,jump=false){const ax=(a[0]+.5)*C,ay=(a[1]+.5)*C,bx=(b[0]+.5)*C,by=(b[1]+.5)*C;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(ax,ay);if(jump)ctx.quadraticCurveTo((ax+bx)/2,Math.min(ay,by)-C*2,bx,by);else ctx.lineTo(bx,by);ctx.stroke();}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#0c0e10';ctx.fillRect(0,0,W,H);ctx.fillStyle='#24272b';for(let x=0;x<W;x+=C)for(let y=0;y<H;y+=C)ctx.fillRect(x,y,1.5,1.5);
 for(const [x,y]of ground.cells){ctx.fillStyle='#30373c';ctx.fillRect(x*C,y*C,C,C);ctx.fillStyle='#6b7479';ctx.fillRect(x*C,y*C,C,3);ctx.strokeStyle='#121619';ctx.strokeRect(x*C+.5,y*C+.5,C-1,C-1);}
 if(document.querySelector('#graph').checked){for(const [k,edges]of network.graph){const a=k.split(',').map(Number);for(const [nk,edge]of edges)line(a,nk.split(',').map(Number),edge[1]==='jmp'?'#683b46':'#343f46',1,edge[1]==='jmp');ctx.fillStyle='#89958f';ctx.fillRect((a[0]+.5)*C-2,(a[1]+.5)*C-2,4,4);}}
 for(let i=1;i<path.length;i++){const edge=network.graph.get(path[i-1].join(','))?.get(path[i].join(','));line(path[i-1],path[i],'#e8e6da',2.5,edge?.[1]==='jmp');}
 ctx.strokeStyle='#ff4655';ctx.lineWidth=1;ctx.strokeRect(start[0]*C+8,start[1]*C+8,C-16,C-16);
 const gx=(goal[0]+.5)*C,gy=(goal[1]+.5)*C;ctx.strokeStyle='#e8e6da';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(gx,gy-12);ctx.lineTo(gx+12,gy);ctx.lineTo(gx,gy+12);ctx.lineTo(gx-12,gy);ctx.closePath();ctx.stroke();
 ctx.fillStyle='#ff4655';ctx.beginPath();ctx.roundRect(agent.x-agent.w/2,agent.y-agent.h/2,agent.w,agent.h,12);ctx.fill();ctx.fillStyle='#090a0b';ctx.fillRect(agent.x+3,agent.y-9,5,5);
 if(cursor){ctx.strokeStyle=tool==='erase'?'#ff4655':'#e8e6da';ctx.lineWidth=2;ctx.strokeRect(cursor[0]*C+2,cursor[1]*C+2,C-4,C-4);}
}
function edit(p,action=tool){
 if(!p)return;const [x,y]=p;
 if(action==='ground'){
  if(same(p,start)||same(p,goal)||same(p,[agent.grid_x,agent.grid_y])||ground.has(x,y))return;
  ground.add(x,y);
 }else if(action==='erase'){
  if(!ground.has(x,y))return;ground.remove(x,y);
 }else {
  if(ground.has(x,y)){message('Choose an empty cell above a platform.');return;}
  if(action==='start')start=[x,y];else goal=[x,y];
 }
 rebuild();
}
function locate(e){const r=canvas.getBoundingClientRect();return[Math.max(0,Math.min(Math.ceil(W/C)-1,Math.floor((e.clientX-r.left)*W/r.width/C))),Math.max(0,Math.min(Math.ceil(H/C)-1,Math.floor((e.clientY-r.top)*H/r.height/C)))];}
function markerAt(p){if(same(p,[agent.grid_x,agent.grid_y])||same(p,start))return 'start';if(same(p,goal))return 'goal';return null;}
function releasePointer(){dragging=false;dragAction=null;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.button!==2)return;
 e.preventDefault();canvas.focus({preventScroll:true});keyboardMove=null;cursor=locate(e);
 const marker=markerAt(cursor);
 if(e.button===2&&marker==='start'){if(agent.active)resetAgent();else toggleRun();return;}
 // Select the gesture once: a marker drag never turns into painting.
 dragAction=e.button===2?'erase':marker||tool;
 if(running&&marker==='start'){dragAction=null;return;}
 dragging=true;canvas.setPointerCapture(e.pointerId);
 if(!marker||e.button===2)edit(cursor,dragAction);
 canvas.style.cursor=marker?'grabbing':'crosshair';draw();
});
canvas.addEventListener('pointermove',e=>{
 const p=locate(e),previous=cursor,changed=!previous||!same(p,previous);cursor=p;
 if(dragging&&changed){
  if(dragAction==='ground'||dragAction==='erase'){
   const n=Math.max(Math.abs(p[0]-previous[0]),Math.abs(p[1]-previous[1]));
   for(let i=1;i<=n;i++)edit([Math.round(previous[0]+(p[0]-previous[0])*i/n),Math.round(previous[1]+(p[1]-previous[1])*i/n)],dragAction);
  }else edit(p,dragAction);
 }
 canvas.style.cursor=dragging?'grabbing':markerAt(p)?'grab':'crosshair';draw();
});
canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
canvas.addEventListener('keydown',e=>{
 const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(dirs[e.key]){e.preventDefault();const d=dirs[e.key];cursor=cursor||[...start];cursor=[Math.max(0,Math.min(Math.ceil(W/C)-1,cursor[0]+d[0])),Math.max(0,Math.min(Math.ceil(H/C)-1,cursor[1]+d[1]))];if(keyboardMove)edit(cursor,keyboardMove);draw();}
 else if(e.key==='Enter'){e.preventDefault();cursor=cursor||[...start];if(keyboardMove)keyboardMove=null;else {keyboardMove=markerAt(cursor);if(!keyboardMove)edit(cursor);}}
 else if(e.key==='Escape'){keyboardMove=null;releasePointer();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();edit(cursor||start,'erase');}
 else if(e.code==='Space'){e.preventDefault();if(agent.active)resetAgent();else toggleRun();}
 else if(e.key.toLowerCase()==='h'){const check=document.querySelector('#graph');check.checked=!check.checked;draw();}
 else if(e.key.toLowerCase()==='x'){ground.clear();rebuild();}
});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{tool=button.dataset.tool;for(const b of document.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b===button));});
run.addEventListener('click',toggleRun);document.querySelector('#reset').addEventListener('click',resetAgent);document.querySelector('#example').addEventListener('click',restore);document.querySelector('#clear').addEventListener('click',()=>{ground.clear();rebuild();});document.querySelector('#graph').addEventListener('change',draw);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();message('Paused while this tab is hidden.');}});
restore();
