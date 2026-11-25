import Phaser from 'phaser';
import { getConnectionUrl } from '@edgegap/sdk';
import { GroupAgent } from '@edgegap/sdk/matchmaking';
import './style.css';
import { ARENA, COLORS, NAMES, ROUND_SECONDS, WINS_TO_MATCH, addSlime, makeWorld, resetRound, stepWorld } from './rules.js';
import { matchmakerConfig } from './config.js';

const hud = {
  score: document.querySelector('#scoreboard'), round: document.querySelector('#round-label'),
  phase: document.querySelector('#phase-label'), timer: document.querySelector('#timer'),
  play: document.querySelector('#play-button'), find: document.querySelector('#find-match-button'),
  status: document.querySelector('#connection-status'), mode: document.querySelector('#mode-label'),
};

class SumoScene extends Phaser.Scene {
  constructor() {
    super('sumo'); this.scores = [0, 0, 0, 0]; this.round = 1; this.phase = 'ready';
    this.matchOver = false; this.audioOn = true; this.online = false; this.localId = null;
  }
  create() {
    this.cx = ARENA.centerX; this.cy = ARENA.centerY; this.baseRadius = ARENA.radius; this.radius = this.baseRadius;
    this.graphics = this.add.graphics();
    const pixel = this.make.graphics({x:0,y:0,add:false}); pixel.fillStyle(0xffffff,1); pixel.fillRect(0,0,4,4); pixel.generateTexture('pixel',4,4); pixel.destroy();
    this.slimes = []; this.world = makeWorld(); this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.input.keyboard.on('keydown-SPACE', () => this.dash());
    this.soundCtx = null; this.drawArena();
    ['YOU','BUBBLE','MISO','PICKLE'].forEach((name,i)=>addSlime(this.world,{id:i+1,name,bot:i>0,slot:i}));
    resetRound(this.world); this.localId=1; this.makeSlimes(); this.setPhase('READY?'); this.refreshScore(); this.showTimer(ROUND_SECONDS);
    hud.status.textContent='Solo mode / offline'; hud.mode.textContent='LOCAL ARCADE / 4 SLIMES'; hud.find.disabled=false; hud.play.disabled=false;
    this.events.on('start-round', () => this.startRound()); this.events.on('next-round', () => this.startRound());
    this.scale.on('resize', () => this.drawArena());
  }
  makeSlimes() {
    this.slimes = this.world.players.map((model) => {
      const g = this.add.graphics(), eyes = this.add.graphics();
      const label = this.add.text(0,0,model.name,{fontFamily:'DM Mono',fontSize:'8px',color:'#25302c',stroke:'#d3c6a2',strokeThickness:3}).setOrigin(.5).setDepth(1);
      return { ...model, g, eyes, label };
    });
    this.slimes.forEach((s) => this.paintSlime(s));
  }
  drawArena() {
    const g = this.graphics; g.clear(); g.fillStyle(0x17232c, 1); g.fillRect(0, 0, ARENA.width, ARENA.height);
    for (let y=8; y<ARENA.height; y+=28) for (let x=8; x<ARENA.width; x+=28) { g.fillStyle(0x96b5a3, .1); g.fillCircle(x,y, .8); }
    g.fillStyle(0x080f15, .54); g.fillCircle(this.cx, this.cy + 13, this.radius + 16);
    g.fillStyle(0x40504e, 1); g.fillCircle(this.cx, this.cy, this.radius + 12);
    g.lineStyle(2, 0x62726b, .55); g.strokeCircle(this.cx,this.cy,this.radius+6);
    g.fillStyle(0xb2a987, 1); g.fillCircle(this.cx, this.cy, this.radius);
    g.fillStyle(0xc0b693, 1); g.fillCircle(this.cx, this.cy - 3, this.radius - 5);
    for (let r=36; r<this.radius-6; r+=27) { g.lineStyle(1, 0x827c65, .24); g.strokeCircle(this.cx,this.cy-3,r); }
    g.lineStyle(1, 0x85816d, .31); g.strokeCircle(this.cx,this.cy-3,this.radius-8);
    for(let a=0;a<Math.PI*2;a+=Math.PI/12){g.lineStyle(1,0x817e6b,.25);g.lineBetween(this.cx+Math.cos(a)*15,this.cy-3+Math.sin(a)*15,this.cx+Math.cos(a)*(this.radius-8),this.cy-3+Math.sin(a)*(this.radius-8));}
    g.lineStyle(2, 0xe4d6ab, .65); g.strokeCircle(this.cx,this.cy-3,this.radius-3);
  }
  paintSlime(s) {
    s.g.clear(); s.eyes.clear(); s.label.setVisible(s.alive).setPosition(s.x,s.y-38); if (!s.alive) return;
    const color=COLORS[s.slot%4], pulse=Math.sin(this.time.now/180+(s.bob||0))*1.5;
    s.g.fillStyle(color,.24); s.g.fillEllipse(s.x,s.y+13,49,19); s.g.fillStyle(color,1);
    s.g.fillEllipse(s.x,s.y+2,43+pulse,37-pulse*.4); s.g.fillStyle(0xffffff,.26); s.g.fillEllipse(s.x-7,s.y-7,12,6);
    const fx=Math.cos(s.angle),fy=Math.sin(s.angle),px=-fy,py=fx,ex=s.x+fx*6,ey=s.y-3+fy*6;
    s.eyes.fillStyle(0x18232a,1); s.eyes.fillCircle(ex+px*5,ey+py*5,2.5); s.eyes.fillCircle(ex-px*5,ey-py*5,2.5);
    if(s.slot===0){s.g.fillStyle(0xf5f4ed,1);s.g.fillEllipse(s.x,s.y-20,23,8);s.g.fillStyle(color,1);s.g.fillTriangle(s.x-5,s.y-20,s.x+4,s.y-20,s.x,s.y-32);}
    if(s.dashTime>0){s.g.lineStyle(3,0xffffff,.55);s.g.strokeEllipse(s.x,s.y+2,51,43);}
  }
  setPhase(label) { this.phase=label==='FIGHT!'?'playing':label==='ROUND OVER'?'over':label==='MATCH OVER'?'matchover':label==='READY?'?'ready':this.phase; hud.phase.textContent=label; }
  refreshScore() {
    hud.score.innerHTML=this.slimes.map((s)=>{const score=this.online?(s.score||0):(this.scores[s.slot]||0);return `<div class="score-row ${s.slot===0?'player':''}"><span style="color:#${COLORS[s.slot%4].toString(16).padStart(6,'0')}">●</span><span class="score-name">${escapeHtml(s.name)}</span><span class="score-pips">${[0,1,2].map(n=>`<i class="score-pip ${n<score?'filled':''}"></i>`).join('')}</span></div>`;}).join('');
    hud.round.textContent=`ROUND ${String(this.round).padStart(2,'0')}`;
  }
  startRound() {
    if(this.matchOver){this.scores=[0,0,0,0];this.round=1;this.matchOver=false;this.refreshScore();}
    resetRound(this.world); this.slimes=this.world.players.map((model,i)=>Object.assign(this.slimes[i]||{},model));
    this.drawArena(); this.setPhase('FIGHT!'); hud.play.querySelector('span:first-child').textContent='RESTART ROUND'; this.beep(440,.09);
  }
  dash(){const p=this.slimes.find((s)=>s.id===this.localId)||this.slimes[0];if(this.phase!=='playing'||!p?.alive||p.cooldown>0)return;if(this.online)sendInput(true);else p.input.dash=true;}
  update(_,delta) {
    const dt=Math.min(delta/1000,.035);
    if(this.online){const now=performance.now();if(socket?.readyState===1&&now-(this.lastInputAt||0)>=33){this.lastInputAt=now;sendInput(false);}this.renderSnapshots();return;}
    if(this.phase!=='playing')return;
    const p=this.slimes[0];
    p.input.x=(this.keys.D.isDown||this.cursors.right.isDown?1:0)-(this.keys.A.isDown||this.cursors.left.isDown?1:0);
    p.input.y=(this.keys.S.isDown||this.cursors.down.isDown?1:0)-(this.keys.W.isDown||this.cursors.up.isDown?1:0);
    stepWorld(this.world,dt); this.syncLocal();
    const remain=Math.max(0,ROUND_SECONDS-this.world.elapsed); this.showTimer(remain);
    if(this.world.roundWinner!==null&&!this.roundScored){this.roundScored=true;const winner=this.world.roundWinner;this.time.delayedCall(750,()=>this.endRound(winner));}
  }
  syncLocal(){this.radius=this.world.radius;this.slimes=this.world.players.map((m,i)=>Object.assign(this.slimes[i]||{},m));this.drawArena();this.slimes.forEach((s)=>this.paintSlime(s));}
  renderSnapshots(){
    if(!this.latestState)return;
    const state=this.latestState, previous=new Map(this.slimes.map((s)=>[s.id,s]));
    this.slimes=state.s.players.map((model)=>{
      let s=previous.get(model.id);
      if(!s){const g=this.add.graphics(),eyes=this.add.graphics(),label=this.add.text(model.x,model.y-38,model.name,{fontFamily:'DM Mono',fontSize:'8px',color:'#25302c',stroke:'#d3c6a2',strokeThickness:3}).setOrigin(.5).setDepth(1);s={g,eyes,label};}
      previous.delete(model.id); return Object.assign(s,model);
    });
    for(const stale of previous.values()){stale.g.destroy();stale.eyes.destroy();stale.label.destroy();}
    this.radius=state.s.radius;this.drawArena();this.slimes.forEach((s)=>this.paintSlime(s));
    hud.mode.textContent='ONLINE MATCH / 4 SLIMES';
    this.showTimer(state.s.roundRemaining??0);this.round=state.s.round;this.refreshScore();
    if(state.phase==='playing'){this.setPhase('FIGHT!');hud.find.disabled=true;hud.find.querySelector('span:first-child').textContent='IN MATCH';hud.play.disabled=true;}
    else if(state.phase==='countdown')this.setPhase('READY?');
    else if(state.phase==='over'){this.setPhase('MATCH OVER');hud.status.textContent=state.result?.winner||'Match complete';}
    if(state.s.roundWinner!==null&&this.roundAnnounced!==state.s.round){this.roundAnnounced=state.s.round;this.setPhase('ROUND OVER');hud.status.textContent=`${state.players.find(p=>p.id===state.s.roundWinner)?.name||'A slime'} wins the round`;}
  }
  showTimer(remain){hud.timer.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(Math.floor(remain%60)).padStart(2,'0')}`;}
  endRound(winnerId){if(this.matchOver)return;this.setPhase('ROUND OVER');const winner=this.slimes.findIndex(s=>s.id===winnerId);if(winner>=0)this.scores[winner]++;this.refreshScore();const matchWinner=this.scores.findIndex(s=>s>=WINS_TO_MATCH);if(matchWinner>=0){this.matchOver=true;this.setPhase('MATCH OVER');hud.play.querySelector('span:first-child').textContent=matchWinner===0?'YOU WIN! PLAY AGAIN':'PLAY AGAIN';}else{this.round++;this.refreshScore();hud.play.querySelector('span:first-child').textContent=winner===0?'ROUND WON! NEXT':'NEXT ROUND';}}
  beep(freq,duration){if(!this.audioOn)return;try{this.soundCtx??=new AudioContext();const o=this.soundCtx.createOscillator(),g=this.soundCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.045,this.soundCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.soundCtx.currentTime+duration);o.connect(g);g.connect(this.soundCtx.destination);o.start();o.stop(this.soundCtx.currentTime+duration);}catch{}}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:ARENA.width,height:ARENA.height,backgroundColor:'#17232c',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,pixelArt:false},scene:[SumoScene]});
const scene=()=>game.scene.getScene('sumo');
let socket=null, agent=null, queueCancelled=false, pendingState=null;
async function connect(url,hello){
  return new Promise((resolve,reject)=>{let tries=0;function attempt(){tries++;const ws=new WebSocket(url);let welcomed=false;ws.onopen=()=>ws.send(JSON.stringify({t:'hello',...hello}));ws.onmessage=(e)=>{const msg=JSON.parse(e.data);if(msg.t==='welcome'&&!welcomed){welcomed=true;socket=ws;ws.send(JSON.stringify({t:'ping'}));const heartbeat=setInterval(()=>ws.readyState===1&&ws.send(JSON.stringify({t:'ping'})),5000);ws.addEventListener('close',()=>clearInterval(heartbeat),{once:true});resolve(msg);}if(msg.t==='state')onOnlineState(msg);if(msg.t==='error')reject(new Error(msg.message));};ws.onclose=()=>{if(!welcomed&&tries<12)setTimeout(attempt,1000);else if(!welcomed)reject(new Error('Could not connect to the game server'));};ws.onerror=()=>{if(tries>=12)reject(new Error('Could not connect to the game server'));};}attempt();});
}
function onOnlineState(msg){const s=scene();if(!s){pendingState=msg;return;}s.latestState=msg;s.online=true;if(!s.localId){s.localId=s.myPlayerId;}const me=msg.players.find(p=>p.id===s.myPlayerId);if(me)s.localId=me.id;if(s.phase==='ready'){s.phase=msg.phase;}}
function sendInput(dash){const s=scene(),keys=s.keys,c=s.cursors;const x=(keys.D.isDown||c.right.isDown?1:0)-(keys.A.isDown||c.left.isDown?1:0),y=(keys.S.isDown||c.down.isDown?1:0)-(keys.W.isDown||c.up.isDown?1:0);if(x||y){const me=s.slimes.find(p=>p.id===s.myPlayerId);if(me)me.angle=Math.atan2(y,x);}socket?.readyState===1&&socket.send(JSON.stringify({t:'input',x,y,dash}));}

async function findMatch(){
  const params=new URLSearchParams(location.search),mmUrl=params.get('mm')||matchmakerConfig.url,token=params.get('token')||matchmakerConfig.token;
  if(!mmUrl||!token){hud.status.textContent='Add your matchmaker URL and client token in src/config.local.js';return;}
  hud.find.disabled=false;hud.play.disabled=true;hud.find.querySelector('span:first-child').textContent='CANCEL SEARCH';hud.status.textContent='Finding a match…';queueCancelled=false;
  try{agent=new GroupAgent({baseUrl:mmUrl,authToken:token,logGroupUpdates:false});agent.initialize(undefined,({current})=>{if(current?.status)hud.status.textContent=`${current.status}…`;});await agent.createGroup({profile:'slime-sumo',attributes:{},is_ready:true},true);const assignment=await agent.nextAssignment();if(queueCancelled)return;const ticket=agent.group.current.ticket_id;agent.dispose();agent=null;await startOnline(getConnectionUrl(assignment,'gameport'),ticket);}
  catch(err){if(!queueCancelled)hud.status.textContent=err.message||'Matchmaking failed';hud.find.disabled=false;hud.find.querySelector('span:first-child').textContent='FIND MATCH';hud.play.disabled=false;}
}
function cancelSearch(){if(!agent)return;queueCancelled=true;const current=agent;agent=null;current.stopMatchmaking().catch(()=>{});current.dispose();hud.status.textContent='Queue cancelled';hud.find.disabled=false;hud.find.querySelector('span:first-child').textContent='FIND MATCH';hud.play.disabled=false;}
function playerName(){if(localStorage.getItem('slime-sumo-name'))return localStorage.getItem('slime-sumo-name');if(!sessionStorage.getItem('slime-sumo-name'))sessionStorage.setItem('slime-sumo-name',`Slime ${1000+Math.floor(Math.random()*9000)}`);return sessionStorage.getItem('slime-sumo-name');}
async function startOnline(url,ticket){
  try{hud.status.textContent='Connecting to match…';const welcome=await connect(url,{name:playerName(),ticket});while(!scene())await new Promise(resolve=>setTimeout(resolve,30));const s=scene();s.online=true;s.myPlayerId=welcome.id;s.localId=welcome.id;s.phase='waiting';s.scores=[0,0,0,0];s.round=1;s.matchOver=false;s.latestState=pendingState;pendingState=null;
    // The first state contains all match seats, including bot seats. Build render objects from that state.
    await new Promise(resolve=>{const check=()=>{if(s.latestState){s.renderSnapshots();hud.status.textContent='Connected · WASD to move · SPACE to dash';resolve();}else setTimeout(check,40);};check();});
    hud.find.disabled=true;hud.find.querySelector('span:first-child').textContent='IN MATCH';hud.play.disabled=true;
  }catch(err){hud.status.textContent=err.message;hud.find.disabled=false;hud.play.disabled=false;}
}
hud.find.addEventListener('click',()=>agent?cancelSearch():findMatch());
const direct=new URLSearchParams(location.search).get('server');if(direct)startOnline(direct,null);
window.addEventListener('pagehide',()=>{queueCancelled=true;agent?.stopMatchmaking().catch(()=>{});agent?.dispose();socket?.close();});
hud.play.addEventListener('click',()=>{const s=scene();if(s.online)return;if(s.phase==='ready')s.events.emit('start-round');else if(s.phase==='playing'){s.scores=[0,0,0,0];s.round=1;s.matchOver=false;s.world=makeWorld();['YOU','BUBBLE','MISO','PICKLE'].forEach((name,i)=>addSlime(s.world,{id:i+1,name,bot:i>0,slot:i}));resetRound(s.world);s.slimes=s.world.players.map((m,i)=>Object.assign(s.slimes[i],m));s.refreshScore();s.setPhase('FIGHT!');}else s.events.emit('next-round');});
document.querySelector('#sound-button').addEventListener('click',e=>{const s=scene();s.audioOn=!s.audioOn;e.currentTarget.innerHTML=s.audioOn?'♪ <span>SOUND ON</span>':'♪ <span>SOUND OFF</span>';});
