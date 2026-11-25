import Phaser from 'phaser';
import './style.css';

const COLORS = [0xc9ef63, 0xff816f, 0x70d6db, 0xc09aff];
const NAMES = ['YOU', 'BUBBLE', 'MISO', 'PICKLE'];
const W = 720, H = 620;
const hud = {
  score: document.querySelector('#scoreboard'),
  round: document.querySelector('#round-label'),
  phase: document.querySelector('#phase-label'),
  timer: document.querySelector('#timer'),
  play: document.querySelector('#play-button'),
};

class SumoScene extends Phaser.Scene {
  constructor() { super('sumo'); this.scores = [0, 0, 0, 0]; this.round = 1; this.phase = 'ready'; this.matchOver = false; this.audioOn = true; }
  create() {
    this.cx = W / 2; this.cy = H / 2 + 8; this.baseRadius = 244; this.radius = this.baseRadius;
    this.graphics = this.add.graphics();
    const pixel = this.make.graphics({x:0,y:0,add:false}); pixel.fillStyle(0xffffff,1); pixel.fillRect(0,0,4,4); pixel.generateTexture('pixel',4,4); pixel.destroy();
    this.slimes = [];
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.input.keyboard.on('keydown-SPACE', () => this.dash());
    this.soundCtx = null;
    this.drawArena(); this.makeSlimes(); this.setPhase('READY?'); this.refreshScore();
    this.events.on('start-round', () => this.startRound());
    this.events.on('next-round', () => this.startRound());
    this.scale.on('resize', () => this.drawArena());
  }
  makeSlimes() {
    const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI];
    this.slimes = angles.map((angle, i) => {
      const x = this.cx + Math.cos(angle) * 111, y = this.cy + Math.sin(angle) * 111;
      const g = this.add.graphics();
      const eyes = this.add.graphics();
      const label = i === 0 ? null : this.add.text(x,y-38,NAMES[i],{fontFamily:'DM Mono',fontSize:'8px',color:'#25302c',stroke:'#d3c6a2',strokeThickness:3}).setOrigin(.5).setDepth(1);
      return { i, x, y, vx: 0, vy: 0, radius: 22, g, eyes, label, alive: true, angle: 0, cooldown: 0, dashTime: 0, botThink: 0, bob: Math.random() * 7 };
    });
    this.slimes.forEach(s => this.paintSlime(s));
  }
  drawArena() {
    const g = this.graphics; g.clear();
    g.fillStyle(0x17232c, 1); g.fillRect(0, 0, W, H);
    for (let y=8; y<H; y+=28) for (let x=8; x<W; x+=28) { g.fillStyle(0x96b5a3, .1); g.fillCircle(x,y, .8); }
    // outer ring and shadow
    g.fillStyle(0x080f15, .54); g.fillCircle(this.cx, this.cy + 13, this.radius + 16);
    g.fillStyle(0x40504e, 1); g.fillCircle(this.cx, this.cy, this.radius + 12);
    g.lineStyle(2, 0x62726b, .55); g.strokeCircle(this.cx,this.cy,this.radius+6);
    g.fillStyle(0xb2a987, 1); g.fillCircle(this.cx, this.cy, this.radius);
    g.fillStyle(0xc0b693, 1); g.fillCircle(this.cx, this.cy - 3, this.radius - 5);
    // subtle concentric straw weave
    for (let r=36; r<this.radius-6; r+=27) { g.lineStyle(1, 0x827c65, .24); g.strokeCircle(this.cx,this.cy-3,r); }
    g.lineStyle(1, 0x85816d, .31); g.strokeCircle(this.cx,this.cy-3,this.radius-8);
    for(let a=0;a<Math.PI*2;a+=Math.PI/12){g.lineStyle(1,0x817e6b,.25);g.lineBetween(this.cx+Math.cos(a)*15,this.cy-3+Math.sin(a)*15,this.cx+Math.cos(a)*(this.radius-8),this.cy-3+Math.sin(a)*(this.radius-8));}
    g.lineStyle(2, 0xe4d6ab, .65); g.strokeCircle(this.cx,this.cy-3,this.radius-3);
  }
  paintSlime(s) {
    s.g.clear(); s.eyes.clear(); if (s.label) s.label.setVisible(s.alive).setPosition(s.x,s.y-38); if (!s.alive) return;
    const color = COLORS[s.i], pulse = Math.sin(this.time.now / 180 + s.bob) * 1.5;
    s.g.fillStyle(color,.24); s.g.fillEllipse(s.x,s.y+13,49,19);
    s.g.fillStyle(color,1); s.g.fillEllipse(s.x,s.y+2,43+pulse,37-pulse*.4);
    s.g.fillStyle(0xffffff,.26); s.g.fillEllipse(s.x-7,s.y-7,12,6);
    const fx = Math.cos(s.angle), fy = Math.sin(s.angle), px=-fy, py=fx;
    const ex=s.x+fx*6, ey=s.y-3+fy*6;
    s.eyes.fillStyle(0x18232a,1); s.eyes.fillCircle(ex+px*5,ey+py*5,2.5); s.eyes.fillCircle(ex-px*5,ey-py*5,2.5);
    if(s.i===0){s.g.fillStyle(0xf5f4ed,1);s.g.fillEllipse(s.x,s.y-20,23,8);s.g.fillStyle(color,1);s.g.fillTriangle(s.x-5,s.y-20,s.x+4,s.y-20,s.x,s.y-32);}
    if(s.dashTime>0){s.g.lineStyle(3,0xffffff,.55);s.g.strokeEllipse(s.x,s.y+2,51,43);}

  }
  setPhase(label){ this.phase=label==='FIGHT!'?'playing':label==='READY?'?'ready':label==='ROUND OVER'?'over':label==='MATCH OVER'?'matchover':this.phase; hud.phase.textContent=label; }
  refreshScore(){
    hud.score.innerHTML=this.scores.map((score,i)=>`<div class="score-row ${i===0?'player':''}"><span style="color:#${COLORS[i].toString(16).padStart(6,'0')}">?</span><span class="score-name">${NAMES[i]}</span><span class="score-pips">${[0,1,2].map(n=>`<i class="score-pip ${n<score?'filled':''}"></i>`).join('')}</span></div>`).join('');
    hud.round.textContent=`ROUND ${String(this.round).padStart(2,'0')}`;
  }
  startRound(){
    if(this.matchOver){this.scores=[0,0,0,0];this.round=1;this.matchOver=false;this.refreshScore();}
    this.radius=this.baseRadius; this.elapsed=0; this.roundScored=false;
    const angles=[-Math.PI/2,0,Math.PI/2,Math.PI];
    this.slimes.forEach((s,i)=>{let a=angles[i]+(Math.random()-.5)*.45;s.x=this.cx+Math.cos(a)*110;s.y=this.cy+Math.sin(a)*110;s.vx=0;s.vy=0;s.alive=true;s.angle=a+Math.PI;s.cooldown=0;s.dashTime=0;this.paintSlime(s);});
    this.drawArena(); this.setPhase('FIGHT!'); hud.play.querySelector('span:first-child').textContent='RESTART ROUND';this.beep(440,.09);
  }
  dash(){const p=this.slimes[0];if(this.phase!=='playing'||!p?.alive||p.cooldown>0)return;p.vx+=Math.cos(p.angle)*510;p.vy+=Math.sin(p.angle)*510;p.cooldown=1.15;p.dashTime=.22;this.beep(630,.07);}
  update(_,delta){
    const dt=Math.min(delta/1000,.035); if(this.phase!=='playing')return;
    this.elapsed+=dt; this.radius=Math.max(111,this.baseRadius-Math.max(0,this.elapsed-5)*2.15);this.drawArena();
    this.slimes.forEach((s,i)=>{if(!s.alive)return;s.cooldown=Math.max(0,s.cooldown-dt);s.dashTime=Math.max(0,s.dashTime-dt);
      let ix=0,iy=0;
      if(i===0){ix=(this.keys.D.isDown||this.cursors.right.isDown?1:0)-(this.keys.A.isDown||this.cursors.left.isDown?1:0);iy=(this.keys.S.isDown||this.cursors.down.isDown?1:0)-(this.keys.W.isDown||this.cursors.up.isDown?1:0);}
      else {const target=this.chooseTarget(s);if(target){let dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;let safe=Math.hypot(s.x-this.cx,s.y-this.cy);ix=dx/d+(safe>this.radius-70?(this.cx-s.x)/Math.max(safe,1)*1.9:0);iy=dy/d+(safe>this.radius-70?(this.cy-s.y)/Math.max(safe,1)*1.9:0);let mag=Math.hypot(ix,iy)||1;ix/=mag;iy/=mag;if(d<93&&s.cooldown<=0&&Math.random()<.025){s.vx+=dx/d*350;s.vy+=dy/d*350;s.cooldown=1.4;s.dashTime=.2;this.beep(350+i*80,.06);}}}
      if(ix||iy){const m=Math.hypot(ix,iy);ix/=m;iy/=m;s.angle=Math.atan2(iy,ix);s.vx+=ix*390*dt;s.vy+=iy*390*dt;}
      const drag=Math.pow(.91,dt*60);s.vx*=drag;s.vy*=drag;const max=s.dashTime>0?510:196,sp=Math.hypot(s.vx,s.vy);if(sp>max){s.vx=s.vx/sp*max;s.vy=s.vy/sp*max;}
      s.x+=s.vx*dt;s.y+=s.vy*dt;
    });
    this.collide();
    this.slimes.forEach((s,i)=>{if(!s.alive)return;let d=Math.hypot(s.x-this.cx,s.y-this.cy);if(d>this.radius-s.radius*.35){s.alive=false;s.g.clear();s.eyes.clear();if(s.label)s.label.setVisible(false);this.burst(s.x,s.y,COLORS[i]);this.beep(160,.12);}});
    this.slimes.forEach(s=>this.paintSlime(s));
    const survivors=this.slimes.filter(s=>s.alive);if(survivors.length<=1&&!this.roundScored){this.roundScored=true;this.time.delayedCall(750,()=>this.endRound(survivors[0]?.i??-1));}
    const remain=Math.max(0,60-this.elapsed);hud.timer.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(Math.floor(remain%60)).padStart(2,'0')}`;
  }
  chooseTarget(s){const alive=this.slimes.filter(x=>x!==s&&x.alive);if(!alive.length)return null;return alive.sort((a,b)=>{const da=Math.hypot(a.x-s.x,a.y-s.y),db=Math.hypot(b.x-s.x,b.y-s.y);return da-db;})[0];}
  collide(){for(let i=0;i<this.slimes.length;i++)for(let j=i+1;j<this.slimes.length;j++){const a=this.slimes[i],b=this.slimes[j];if(!a.alive||!b.alive)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.radius+b.radius-3;if(d>=min)continue;if(!d){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,over=min-d;a.x-=nx*over*.5;a.y-=ny*over*.5;b.x+=nx*over*.5;b.y+=ny*over*.5;let rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const impulse=-rel*.8+22;a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;}if(a.dashTime>0){b.vx+=nx*240;b.vy+=ny*240;}if(b.dashTime>0){a.vx-=nx*240;a.vy-=ny*240;}}}
  burst(x,y,color){const p=this.add.particles(x,y,'pixel',{speed:{min:35,max:190},angle:{min:0,max:360},scale:{start:1.5,end:0},lifespan:450,tint:color,quantity:1,frequency:-1,blendMode:'ADD'});p.explode(14,x,y);this.time.delayedCall(500,()=>p.destroy());}
  endRound(winner){if(this.matchOver)return;this.setPhase('ROUND OVER');if(winner>=0)this.scores[winner]++;this.refreshScore();const matchWinner=this.scores.findIndex(s=>s>=3);if(matchWinner>=0){this.matchOver=true;this.setPhase('MATCH OVER');hud.play.querySelector('span:first-child').textContent=matchWinner===0?'YOU WIN! PLAY AGAIN':'PLAY AGAIN';}else{this.round++;this.refreshScore();hud.play.querySelector('span:first-child').textContent=winner===0?'ROUND WON! NEXT':'NEXT ROUND';} }
  beep(freq,duration){if(!this.audioOn)return;try{this.soundCtx??=new AudioContext();const o=this.soundCtx.createOscillator(),g=this.soundCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.045,this.soundCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.soundCtx.currentTime+duration);o.connect(g);g.connect(this.soundCtx.destination);o.start();o.stop(this.soundCtx.currentTime+duration);}catch{}}
}

const game = new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:W,height:H,backgroundColor:'#17232c',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,pixelArt:false},scene:[SumoScene]});
hud.play.addEventListener('click',()=>{const scene=game.scene.getScene('sumo');if(scene.phase==='ready')scene.events.emit('start-round');else if(scene.phase==='playing'){scene.scene.restart();scene.scores=[0,0,0,0];scene.round=1;scene.matchOver=false;scene.time.delayedCall(100,()=>{}); }else scene.events.emit('next-round');});
document.querySelector('#sound-button').addEventListener('click',e=>{const scene=game.scene.getScene('sumo');scene.audioOn=!scene.audioOn;e.currentTarget.innerHTML=scene.audioOn?'? <span>SOUND ON</span>':'? <span>SOUND OFF</span>';});



