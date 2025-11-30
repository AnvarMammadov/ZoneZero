
const $ = id => document.getElementById(id);
const CELL = 50; 
const rand = (min, max) => Math.random() * (max - min) + min;

// ITEMS DATABASE
const ITEMS_DB = {
    'ak74': { name: 'AK-74M', w: 4, h: 2, type: 'primary', color: '#451a03', icon: '🔫' },
    'pistol': { name: 'PM Pistol', w: 2, h: 1, type: 'primary', color: '#52525b', icon: '🔫' },
    'helmet': { name: '6B47 Kask', w: 2, h: 2, type: 'head', color: '#3f6212', icon: '⛑️' },
    'armor': { name: 'Zireh (Lvl 4)', w: 3, h: 3, type: 'armor', color: '#14532d', icon: '🛡️' },
    'backpack': { name: 'Berkut Çanta', w: 3, h: 3, type: 'backpack', color: '#57534e', icon: '🎒' },
    'cms': { name: 'CMS Kit', w: 2, h: 1, type: 'med', sub: 'surgery', color: '#ea580c', icon: '👜' },
    'medkit': { name: 'Salewa', w: 2, h: 1, type: 'med', sub: 'heal', heal: 85, color: '#b91c1c', icon: '❤️‍🩹' },
    'bandage': { name: 'Bandaj', w: 1, h: 1, type: 'med', sub: 'bandage', color: '#fca5a5', icon: '🧻' },
    'canned': { name: 'Tuşonka', w: 1, h: 1, type: 'food', energy: 40, color: '#eab308', icon: '🥫' },
    'water': { name: 'Su', w: 1, h: 2, type: 'food', energy: 10, color: '#3b82f6', icon: '💧' },
    'ammo': { name: '5.45 BT', w: 1, h: 1, type: 'ammo', amount: 30, color: '#71717a', icon: '📐' },
    'tape': { name: 'İzolyasiya', w: 1, h: 1, type: 'junk', color: '#0ea5e9', icon: '🔵' },
    'screw': { name: 'Vint', w: 1, h: 1, type: 'junk', color: '#a1a1aa', icon: '🔩' },
    'gpu': { name: 'Qrafik Kartı', w: 2, h: 1, type: 'junk', color: '#a855f7', icon: '📼' }
};

// HIGH QUALITY WEAPON SVGS
const SVGS = {
    'ak74': `<svg viewBox="0 0 200 60" fill="#d1d5db" stroke="black" stroke-width="1"><path d="M10,25 L180,25 L180,30 L195,30 L195,45 L180,45 L180,50 L160,50 L150,35 L120,35 L120,55 L100,55 L105,35 L40,35 L40,45 L20,45 L10,25 Z M50,25 L60,15 L140,15 L130,25 Z M125,35 L130,50 L115,50 Z" fill="#4b5563"/><rect x="50" y="28" width="80" height="4" fill="#1f2937"/></svg>`,
    'pistol': `<svg viewBox="0 0 100 60" fill="#9ca3af" stroke="black" stroke-width="1"><path d="M10,10 L70,10 L70,25 L60,25 L60,45 L40,45 L40,25 L10,25 Z" fill="#4b5563"/><rect x="15" y="15" width="40" height="5" fill="#374151"/></svg>`
};

function toIso(x, y, z=0) { return { x: (x - y), y: (x + y) * 0.5 - z }; }
function toWorld(sx, sy) { let y = (sy / 0.5 - sx) / 2; let x = y + sx; return { x, y }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

class Bullet {
    constructor(x, y, ang, owner) {
        this.x = x; this.y = y; this.z = 30;
        this.vx = Math.cos(ang) * 20; this.vy = Math.sin(ang) * 20; 
        this.owner = owner; this.life = 100;
    }
    update() { 
        let steps = 5;
        for(let i=0; i<steps; i++) {
            this.x += this.vx/steps;
            this.y += this.vy/steps;
            if(Game.checkCollision(this.x, this.y, true)) { 
                this.life = 0; return; 
            }
        }
        this.life -= 1;
    }
    draw(ctx, cam) {
        let p = toIso(this.x, this.y, this.z);
        let sx = p.x - cam.x + Game.cw/2, sy = p.y - cam.y + Game.ch/2;
        let tailX = this.x - this.vx;
        let tailY = this.y - this.vy;
        let pt = toIso(tailX, tailY, this.z);
        let tx = pt.x - cam.x + Game.cw/2, ty = pt.y - cam.y + Game.ch/2;
        let grad = ctx.createLinearGradient(sx, sy, tx, ty);
        grad.addColorStop(0, '#fde047'); 
        grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = grad; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }
}

class Character {
    constructor(x, y, isPlayer) {
        this.x = x; this.y = y; this.z = 0;
        this.isPlayer = isPlayer;
        this.active = true;
        this.angle = 0;
        this.body = { head: 35, thorax: 85, stomach: 70, larm: 60, rarm: 60, lleg: 65, rleg: 65 };
        this.maxBody = { ...this.body };
        this.bleeds = []; 
        this.gear = { head: null, armor: null, primary: null, backpack: null };
        this.grids = { pockets: new Grid('pockets', 4, 1), backpack: null };
        this.ammo = 0; this.reloading = false; this.firing = false;
        this.crouching = false; this.sprinting = false; this.stamina = 100;
        this.inputs = {w:false, s:false, a:false, d:false, shift:false};
        this.reactionTimer = 0; this.reactionThreshold = 150; this.seenPlayer = false;

        if(isPlayer) {
            // STARTER GEAR
            this.gear.primary = { ...ITEMS_DB['ak74'], uid: Math.random() };
            this.ammo = 30; // Loaded mag
            this.addItemToGrid('pockets', 'medkit');
            this.addItemToGrid('pockets', 'ammo'); 
            this.addItemToGrid('pockets', 'ammo'); 
        } else {
            if(Math.random()>0.5) this.gear.primary = { ...ITEMS_DB['ak74'], uid: Math.random() };
            else this.gear.primary = { ...ITEMS_DB['pistol'], uid: Math.random() };
            this.ammo = 1000;
        }
    }
    
    get totalHp() { return Object.values(this.body).reduce((a,b)=>a+b,0); }

    addItemToGrid(gridName, itemId) {
        if (!this.grids[gridName]) return;
        let itemDef = ITEMS_DB[itemId];
        let item = { id: itemId, uid: Math.random(), ...itemDef, x:0, y:0 };
        let g = this.grids[gridName];
        for(let y=0; y<=g.h - item.h; y++) {
            for(let x=0; x<=g.w - item.w; x++) {
                if (g.canPlace(x, y, item.w, item.h)) {
                    item.x = x; item.y = y; g.items.push(item); return true;
                }
            }
        }
        return false;
    }

    takeDamage(dmg) {
        let parts = Object.keys(this.body);
        let p = parts[Math.floor(Math.random()*parts.length)];
        if (this.body[p] > 0) {
            this.body[p] -= dmg;
            if (this.body[p] <= 0) { this.body[p] = 0; if (p === 'head' || p === 'thorax') this.die(); }
        } else {
            let spread = dmg * 0.7; 
            parts.forEach(part => {
                if(part !== p && this.body[part] > 0) {
                    this.body[part] -= spread / 6;
                    if(this.body[part] <= 0) { this.body[part] = 0; if(part === 'head' || part === 'thorax') this.die(); }
                }
            });
        }
        if (Math.random() < 0.2 && !this.bleeds.includes(p) && this.body[p] > 0) this.bleeds.push(p);
        if(this.isPlayer) {
            let ol = $('hurt-overlay'); if(ol) { ol.style.opacity = 0.6; setTimeout(() => ol.style.opacity = 0, 200); }
            Game.updateHealthUI();
        } else if(this.totalHp <= 0) this.die();
    }
    
    useMed(item) {
        if (item.sub === 'bandage') {
            if (this.bleeds.length > 0) { this.bleeds.pop(); Game.updateHealthUI(); return true; }
        } else if (item.sub === 'heal') {
            let healed = false; let pool = item.heal;
            ['head', 'thorax', 'stomach', 'larm', 'rarm', 'lleg', 'rleg'].forEach(p => {
                if (pool > 0 && this.body[p] > 0 && this.body[p] < this.maxBody[p]) {
                    let need = this.maxBody[p] - this.body[p]; let amt = Math.min(pool, need);
                    this.body[p] += amt; pool -= amt; healed = true;
                }
            });
            Game.updateHealthUI(); return healed;
        } else if (item.sub === 'surgery') {
            let repaired = false;
            ['larm', 'rarm', 'lleg', 'rleg', 'stomach'].forEach(p => {
                if (!repaired && this.body[p] === 0) {
                    this.maxBody[p] -= 20; if(this.maxBody[p] < 1) this.maxBody[p] = 1;
                    this.body[p] = 1; repaired = true;
                }
            });
            Game.updateHealthUI(); return repaired;
        }
        return false;
    }

    die() {
        if (!this.active) return;
        this.active = false;
        Game.map.loot.push(new LootContainer(this.x, this.y, 'body'));
        if (this.isPlayer) {
            Game.onPlayerDeath();
        }
    }

    shoot() {
        if (this.reloading || !this.gear.primary) return;
        if (this.ammo > 0) {
            this.ammo--;
            let spreadBase = this.crouching ? 0.02 : 0.08; 
            if (!this.isPlayer) spreadBase = 0.4; 
            let finalAngle = this.angle + (Math.random()-0.5) * spreadBase;
            Game.bullets.push(new Bullet(this.x, this.y, finalAngle, this));
            if(this.isPlayer) { this.angle += (Math.random()-0.5) * 0.1; Game.updateWeaponUI(); }
        }
    }
    
    reload() {
        if (this.reloading || !this.gear.primary) return;
        if (this.ammo === 30) {
            if(this.isPlayer) { 
                let el=$('ammo-ui'); 
                if(el) { el.innerText="DOLUDUR"; el.style.color='orange'; setTimeout(()=>Game.updateWeaponUI(), 1000); }
            }
            return;
        }
        
        let ammoItem = null; let ammoGrid = null;
        const checkGrid = (g) => g ? g.items.find(i => i.type === 'ammo') : null;
        ammoItem = checkGrid(this.grids.pockets);
        if(ammoItem) ammoGrid = this.grids.pockets;
        else if (this.grids.backpack) { ammoItem = checkGrid(this.grids.backpack); if(ammoItem) ammoGrid = this.grids.backpack; }

        if(!ammoItem) {
            if(this.isPlayer) { 
                let el = $('ammo-ui'); 
                if(el) { el.innerText="YOXDUR"; el.style.color='red'; setTimeout(()=>Game.updateWeaponUI(), 1000); }
            }
            return; 
        }
        this.reloading = true;
        if(this.isPlayer) { let el=$('ammo-ui'); if(el) el.innerText = '...'; }
        setTimeout(() => { 
            ammoGrid.items = ammoGrid.items.filter(i => i.uid !== ammoItem.uid);
            this.ammo = 30; this.reloading = false; 
            if(this.isPlayer) { Game.updateWeaponUI(); if(Game.inventoryOpen) InvUI.render(); }
        }, 2000);
    }

    update() {
        if (!this.active) return;
        if (this.bleeds.length > 0 && Game.tick % 120 === 0) {
            this.bleeds.forEach(p => { if (this.body[p] > 0) this.body[p] -= 1; else this.takeDamage(1); });
            if(this.isPlayer) Game.updateHealthUI();
        }
        let speed = 2.0;
        if (this.crouching) speed = 1.0;
        if (this.sprinting && this.stamina > 0) { speed = 3.5; this.stamina -= 0.5; }
        else this.stamina = Math.min(100, this.stamina + 0.3);

        if (this.isPlayer) {
            let dx=0, dy=0;
            if(this.inputs.w) dy=-1; if(this.inputs.s) dy=1; if(this.inputs.a) dx=-1; if(this.inputs.d) dx=1;
            if(dx||dy) {
                let m = toWorld(dx, dy); let l = Math.hypot(m.x, m.y);
                let nx = this.x + (m.x/l)*speed; let ny = this.y + (m.y/l)*speed;
                if(!Game.checkCollision(nx, this.y)) this.x = nx;
                if(!Game.checkCollision(this.x, ny)) this.y = ny;
            }
            let wPos = toWorld(Game.mouse.x - Game.cw/2 + Game.cam.x, Game.mouse.y - Game.ch/2 + Game.cam.y);
            this.angle = Math.atan2(wPos.y - this.y, wPos.x - this.x);
            if(this.firing && Game.tick % 8 === 0) this.shoot();
        } else {
            let d = dist(this, Game.player);
            if (d < 500) {
                let angleToPlayer = Math.atan2(Game.player.y - this.y, Game.player.x - this.x);
                let angleDiff = Math.abs(this.angle - angleToPlayer);
                while(angleDiff > Math.PI) angleDiff -= Math.PI*2;
                angleDiff = Math.abs(angleDiff);
                let canSee = d < 500 && angleDiff < 2.0 && !Game.checkLineOfSight(this.x, this.y, Game.player.x, Game.player.y);

                if (canSee) {
                    this.seenPlayer = true;
                    this.angle = angleToPlayer + (Math.random()-0.5)*0.2; 
                    this.reactionTimer++;
                    if (this.reactionTimer > this.reactionThreshold) {
                        if(d > 250) { this.x += Math.cos(this.angle)*1.5; this.y += Math.sin(this.angle)*1.5; }
                        if(Math.random()<0.08) this.shoot(); 
                    }
                } else {
                    this.reactionTimer = Math.max(0, this.reactionTimer - 1);
                    if(this.reactionTimer === 0) this.seenPlayer = false;
                }
            }
        }
    }

    draw(ctx, cam) {
        if (!this.active) return;
        let p = toIso(this.x, this.y, 0);
        let sx = p.x - cam.x + Game.cw/2, sy = p.y - cam.y + Game.ch/2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(sx, sy, 12, 6, 0, 0, Math.PI*2); ctx.fill();
        let hOff = this.crouching ? 20 : 0;
        if (this.gear.backpack) { ctx.fillStyle = this.gear.backpack.color; ctx.fillRect(sx-10, sy-35+hOff, 20, 20); }
        ctx.fillStyle = this.gear.armor ? '#14532d' : (this.isPlayer ? '#3f3f46' : '#57534e'); ctx.fillRect(sx-8, sy-40+hOff, 16, 25);
        ctx.strokeStyle = '#18181b'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(sx-4, sy-15); ctx.lineTo(sx-4, sy-5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx+4, sy-15); ctx.lineTo(sx+4, sy-5); ctx.stroke();
        let headY = sy-46+hOff;
        if (this.gear.head) { ctx.fillStyle = this.gear.head.color; ctx.beginPath(); ctx.arc(sx, headY, 7, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.arc(sx, headY+4, 5, 0, Math.PI); ctx.fill(); } 
        else { ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.arc(sx, headY, 5, 0, Math.PI*2); ctx.fill(); }
        ctx.save(); ctx.translate(sx, sy-30+hOff);
        let aimPt = toIso(this.x + Math.cos(this.angle)*50, this.y + Math.sin(this.angle)*50, 0);
        let asx = aimPt.x - cam.x + Game.cw/2; let asy = aimPt.y - cam.y + Game.ch/2;
        ctx.rotate(Math.atan2(asy - sy, asx - sx));
        if (this.gear.primary) {
            let w = this.gear.primary; ctx.fillStyle = '#000';
            if (w.id === 'ak74') { ctx.fillRect(0, -2, 28, 4); ctx.fillStyle = '#451a03'; ctx.fillRect(-6, -1, 10, 3); }
            else if (w.id === 'pistol') { ctx.fillRect(0, -2, 12, 4); ctx.fillStyle = '#52525b'; ctx.fillRect(-2, -1, 4, 3); }
        } else { ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.arc(5, 0, 3, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
}

class Building {
    constructor(x, y, w, h) { this.x=x; this.y=y; this.w=w; this.h=h; this.wallH=120; this.doorW=60; }
    
    checkCollision(x, y, isBullet = false) {
        let t = 10;
        if (x >= this.x - t && x <= this.x + this.w + t && y >= this.y - t && y <= this.y + this.h + t) {
            if (x > this.x + t && x < this.x + this.w - t && y > this.y + t && y < this.y + this.h - t) return false;
            let midX = this.x + this.w/2;
            if (y > this.y + this.h - 20 && x > midX - 30 && x < midX + 30) return false;
            return true;
        }
        return false;
    }

    draw(ctx, cam, layer) {
        let ox = -cam.x + Game.cw/2, oy = -cam.y + Game.ch/2;
        const poly = (pts, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(pts[0].x+ox,pts[0].y+oy); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x+ox,pts[i].y+oy); ctx.fill(); ctx.stroke(); };
        let inside = (Game.player.x>this.x && Game.player.x<this.x+this.w && Game.player.y>this.y && Game.player.y<this.y+this.h);
        let p1=toIso(this.x,this.y), p2=toIso(this.x+this.w,this.y), p3=toIso(this.x+this.w,this.y+this.h), p4=toIso(this.x,this.y+this.h);
        let midX = this.x + this.w/2; let d1=toIso(midX-30,this.y+this.h), d2=toIso(midX+30,this.y+this.h);
        if (layer==='floor' && inside) poly([p1,p2,p3,p4], '#27272a');
        let h = this.wallH;
        let h1=toIso(this.x,this.y,h), h2=toIso(this.x+this.w,this.y,h), h3=toIso(this.x+this.w,this.y+this.h,h), h4=toIso(this.x,this.y+this.h,h);
        let dh1=toIso(midX-30,this.y+this.h,h), dh2=toIso(midX+30,this.y+this.h,h);
        if (layer==='walls') {
            poly([h1,h2,p2,p1], '#52525b'); poly([h4,h1,p1,p4], '#3f3f46');
            if(!inside) { poly([h2,h3,p3,p2], '#3f3f46'); poly([h4,dh1,d1,p4], '#52525b'); poly([dh2,h3,p3,d2], '#52525b'); poly([dh1,dh2,d2,d1], '#111'); }
        }
        if (layer==='roof') { ctx.globalAlpha = inside ? 0.1 : 1; poly([h1,h2,h3,h4], '#18181b'); ctx.globalAlpha = 1; }
    }
}

class LootContainer {
    constructor(x, y, type='box') {
        this.x = x; this.y = y; this.type = type;
        this.grid = new Grid('loot', 5, 5);
        if(type==='body') {
            this.grid.items.push({ ...ITEMS_DB['ak74'], uid:Math.random(), x:0, y:0 });
        } else {
            // INCREASED GEAR CHANCE
            let pool = ['ak74','pistol','helmet','armor','backpack','backpack','ammo','ammo','ammo','medkit','cms','bandage','canned','water','tape','screw','gpu'];
            let count = rand(4, 8); // More loot
            for(let i=0; i<count; i++) {
                let id = pool[Math.floor(Math.random()*pool.length)];
                let def = ITEMS_DB[id];
                for(let ly=0; ly<=5-def.h; ly++) {
                    for(let lx=0; lx<=5-def.w; lx++) {
                        if(this.grid.canPlace(lx, ly, def.w, def.h)) {
                            this.grid.items.push({ id, uid: Math.random(), ...def, x: lx, y: ly }); lx=10; ly=10;
                        }
                    }
                }
            }
        }
    }
    draw(ctx, cam) {
        let p = toIso(this.x, this.y, 0);
        let sx = p.x - cam.x + Game.cw/2, sy = p.y - cam.y + Game.ch/2;
        if(this.type==='body') { ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.ellipse(sx, sy, 20, 10, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#18181b'; ctx.fillRect(sx-10, sy-5, 20, 10); } 
        else { ctx.fillStyle = '#4d7c0f'; ctx.fillRect(sx-15, sy-10, 30, 20); ctx.strokeStyle='#000'; ctx.strokeRect(sx-15, sy-10, 30, 20); }
    }
}

class Grid {
    constructor(id, w, h) { this.id=id; this.w=w; this.h=h; this.items=[]; }
    canPlace(tx, ty, w, h, ignoreUid = null) {
        if (tx < 0 || ty < 0 || tx+w > this.w || ty+h > this.h) return false;
        for(let item of this.items) {
            if (item.uid === ignoreUid) continue;
            if (tx < item.x + item.w && tx + w > item.x && ty < item.y + item.h && ty + h > item.y) return false;
        }
        return true;
    }
}

// === GLOBAL STASH (BASE ANBARI) ===
const Stash = new Grid('stash', 10, 6); // 10x6 böyük anbar


const Game = {
    canvas: $('gameCanvas'), ctx: $('gameCanvas').getContext('2d'),
    cw: 0, ch: 0, tick: 0, cam: {x:0, y:0}, mouse: {x:0, y:0},
    player: null, map: { buildings: [], loot: [] }, bullets: [], enemies: [],
    inventoryOpen: false, activeLoot: null,

    state: 'base', // 'base' və ya 'raid'
    extractZone: { x: 1600, y: 300, radius: 90, timer: 0, need: 180 }, // 180 tick ~ 3 saniyə

    init() {
        this.resize(); window.addEventListener('resize', () => this.resize());
        this.setupInput();
        this.player = new Character(300, 300, true);
        this.map.buildings.push(new Building(500, 400, 400, 300));
        this.map.buildings.push(new Building(1200, 200, 300, 400));
        for(let i=0; i<6; i++) this.map.loot.push(new LootContainer(Math.random()*1500+200, Math.random()*1500+200));
        for(let i=0; i<4; i++) this.enemies.push(new Character(Math.random()*1500+200, Math.random()*1500+200, false));
        this.updateHealthUI();
        this.updateWeaponUI();
        this.enterBase(true);
        requestAnimationFrame(this.loop);
    },
    resize() { this.cw=this.canvas.width=window.innerWidth; this.ch=this.canvas.height=window.innerHeight; },

    toggleInventory(forceClose = false, lootObj = null) {
        let menu = $('context-menu'); if(menu) menu.style.display = 'none'; 
        if (forceClose || this.inventoryOpen) {
            this.inventoryOpen = false; $('inventory-screen').style.display = 'none'; this.activeLoot = null;
        } else {
            this.inventoryOpen = true; $('inventory-screen').style.display = 'flex'; this.activeLoot = lootObj; InvUI.render();
        }
    },
    
    checkCollision(x, y, isBullet=false) {
        for(let b of this.map.buildings) if(b.checkCollision(x, y, isBullet)) return true;
        return false;
    },
    
    checkLineOfSight(x1, y1, x2, y2) {
        let d = Math.hypot(x2-x1, y2-y1);
        let steps = d / 20;
        let dx = (x2-x1)/steps, dy = (y2-y1)/steps;
        let cx = x1, cy = y1;
        for(let i=0; i<steps; i++) {
            cx += dx; cy += dy;
            if(this.checkCollision(cx, cy)) return true; 
        }
        return false; 
    },
    
    setupInput() {
        window.addEventListener('keydown', e => {
            if (e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); this.toggleInventory(); }
            if (e.code === 'KeyF' && !this.inventoryOpen) this.interact();
            if(!this.inventoryOpen) {
                if(e.code==='KeyW') this.player.inputs.w=true; if(e.code==='KeyS') this.player.inputs.s=true;
                if(e.code==='KeyA') this.player.inputs.a=true; if(e.code==='KeyD') this.player.inputs.d=true;
                if(e.code==='ShiftLeft') this.player.sprinting=true;
                if(e.code==='KeyC') { this.player.crouching=!this.player.crouching; $('stance-ui').innerText = this.player.crouching ? "ÇÖMƏLİB" : "AYAKTA"; }
                if(e.code==='KeyR') this.player.reload();
            }
        });
        window.addEventListener('keyup', e => {
             if(e.code==='KeyW') this.player.inputs.w=false; if(e.code==='KeyS') this.player.inputs.s=false;
             if(e.code==='KeyA') this.player.inputs.a=false; if(e.code==='KeyD') this.player.inputs.d=false;
             if(e.code==='ShiftLeft') this.player.sprinting=false;
        });
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX; this.mouse.y = e.clientY; InvUI.handleDragMove(e);
        });
        window.addEventListener('mousedown', e => {
            if(this.inventoryOpen) {
                if(e.button === 2) InvUI.handleRightClick(e);
                else InvUI.handleDragStart(e);
            } else this.player.firing = true;
        });
        window.addEventListener('mouseup', e => {
            if(this.inventoryOpen && e.button === 0) InvUI.handleDragEnd(e); else this.player.firing = false;
        });
        $('gameCanvas').addEventListener('contextmenu', e => e.preventDefault());
    },

    interact() {
        let closest = this.map.loot.find(l => dist(this.player, l) < 80);
        if (closest) this.toggleInventory(false, closest);
    },

    updateHealthUI() {
        let b = this.player.body;
        let max = this.player.maxBody;
        const col = (id) => {
            let curr = b[id]; let mx = max[id];
            if (curr === 0) return '#000'; if (curr < mx) return '#b91c1c'; return '#15803d';
        };
        ['head','thorax','stomach','larm','rarm','lleg','rleg'].forEach(p => {
            let el = $(`hp-${p}`); if(el) el.style.background = col(p);
            if(el) { if(this.player.bleeds.includes(p)) el.classList.add('bleeding'); else el.classList.remove('bleeding'); }
        });
        let hpt = $('hp-total'); if(hpt) hpt.innerText = Math.floor(this.player.totalHp);
        let bar = $('bar-hp'); if(bar) bar.style.width = (this.player.totalHp/440*100)+'%';
        let status = [];
        if(this.player.bleeds.length > 0) status.push("QANAXMA");
        let st = $('status-text'); if(st) st.innerText = status.join(" | ");
    },

    updateWeaponUI() {
        let wn = $('weapon-name');
        let au = $('ammo-ui');
        let svg = $('weapon-svg');
        
        if(this.player.gear.primary) {
            if(wn) wn.innerText = this.player.gear.primary.name;
            if(au) { au.innerText = this.player.ammo + '/30'; au.style.color = 'white'; }
            if(svg) svg.innerHTML = SVGS[this.player.gear.primary.id] || '';
        } else {
            if(wn) wn.innerText = "YUMRUQ";
            if(au) au.innerText = "--/--";
            if(svg) svg.innerHTML = '';
        }
    },

    update() {
        if (this.inventoryOpen) return;
        if (this.state !== 'raid') return; 
        this.tick++;
        this.player.update();
        this.enemies.forEach(e => e.update());
        
        let t = toIso(this.player.x, this.player.y, 0);
        this.cam.x += (t.x - this.cam.x) * 0.1;
        this.cam.y += (t.y - this.cam.y) * 0.1;

        for(let i=this.bullets.length-1; i>=0; i--) {
            let b = this.bullets[i]; b.update();
            let hit = false;
            if(b.life > 0) {
                let targets = b.owner.isPlayer ? this.enemies : [this.player];
                for(let t of targets) {
                    if(t.active && dist(b, t) < 20) {
                        t.takeDamage(20); hit = true; break;
                    }
                }
            }
            if(b.life <= 0 || hit) this.bullets.splice(i, 1);
        }
        let barS = $('bar-stam'); if(barS) barS.style.width = this.player.stamina + '%';
        let closest = this.map.loot.find(l => dist(this.player, l) < 80);
        let prm = $('prompt');
        if (prm) closest ? prm.classList.remove('hidden') : prm.classList.add('hidden');

        const ex = this.extractZone;
        const d = dist(this.player, { x: ex.x, y: ex.y });
        if (d < ex.radius) {
            ex.timer++;
            if (ex.timer >= ex.need) {
                this.onExtractSuccess();
            }
        } else {
            ex.timer = 0;
        }
    },

    draw() {
        this.ctx.fillStyle = '#050505'; this.ctx.fillRect(0,0,this.cw,this.ch);
        this.ctx.save(); this.ctx.translate(-this.cam.x + this.cw/2, -this.cam.y + this.ch/2);
        
        let p1=toIso(0,0), p2=toIso(2000,0), p3=toIso(2000,2000), p4=toIso(0,2000);
        this.ctx.fillStyle = '#1c1917'; this.ctx.beginPath(); this.ctx.moveTo(p1.x,p1.y); this.ctx.lineTo(p2.x,p2.y); this.ctx.lineTo(p3.x,p3.y); this.ctx.lineTo(p4.x,p4.y); this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255,255,255,0.03)'; this.ctx.beginPath();
        for(let i=0; i<=2000; i+=100) {
            let s=toIso(i,0), e=toIso(i,2000); this.ctx.moveTo(s.x,s.y); this.ctx.lineTo(e.x,e.y);
            s=toIso(0,i), e=toIso(2000,i); this.ctx.moveTo(s.x,s.y); this.ctx.lineTo(e.x,e.y);
        }
        this.ctx.stroke(); this.ctx.restore();

        this.map.buildings.forEach(b => { b.draw(this.ctx, this.cam, 'floor'); b.draw(this.ctx, this.cam, 'walls'); });
        let objs = [this.player, ...this.map.loot, ...this.enemies.filter(e=>e.active)];
        objs.sort((a,b) => (a.x+a.y) - (b.x+b.y));
        objs.forEach(o => o.draw(this.ctx, this.cam));
        this.bullets.forEach(b => b.draw(this.ctx, this.cam));
        this.map.buildings.forEach(b => b.draw(this.ctx, this.cam, 'roof'));
    },
    loop() { Game.update(); Game.draw(); requestAnimationFrame(() => Game.loop()); },

    enterBase(firstTime = false) {
        this.state = 'base';
        this.inventoryOpen = true;
        this.activeLoot = { grid: Stash }; // sağ panel Stash olacaq

        // Sağlamlığı resetlə
        if (this.player) {
            this.player.body = { ...this.player.maxBody };
            this.player.bleeds = [];
            this.player.stamina = 100;
            this.player.active = true;
            this.updateHealthUI();
        }

        // Inventarı göstər
        $('inventory-screen').style.display = 'flex';
        $('section-loot').style.display = 'flex';
        const title = $('section-loot').querySelector('.grid-title');
        if (title) title.innerText = 'STASH';

        InvUI.render();
    },

    startRaid() {
        this.state = 'raid';
        this.inventoryOpen = false;
        this.activeLoot = null;

        // Inventarı gizlət
        $('inventory-screen').style.display = 'none';

        // Player start mövqeyi
        this.player.x = 300;
        this.player.y = 300;

        // Yeni düşmən və loot yarad (sadə reset)
        this.map.loot = [];
        this.enemies = [];
        for (let i = 0; i < 6; i++)
            this.map.loot.push(new LootContainer(Math.random() * 1500 + 200, Math.random() * 1500 + 200));
        for (let i = 0; i < 4; i++)
            this.enemies.push(new Character(Math.random() * 1500 + 200, Math.random() * 1500 + 200, false));
    },
    onExtractSuccess() {
        // Bütün itemləri stash-ə daşı
        this.transferAllToStash();

        // Sadə bildiriş (sonra HUD edərik)
        alert('EXTRACT OLUNDUN! Loot bazaya göndərildi.');

        // BASE-ə qaytar
        this.enterBase(false);
    },
    moveItemToGrid(grid, item) {
        for (let y = 0; y <= grid.h - item.h; y++) {
            for (let x = 0; x <= grid.w - item.w; x++) {
                if (grid.canPlace(x, y, item.w, item.h)) {
                    item.x = x;
                    item.y = y;
                    grid.items.push(item);
                    return true;
                }
            }
        }
        return false; // yer tapılmadı
    },

    transferAllToStash() {
        const stash = Stash;
        const p = this.player;

        // Ciblər + çanta
        ['pockets', 'backpack'].forEach(gName => {
            const g = p.grids[gName];
            if (!g) return;
            g.items.forEach(item => this.moveItemToGrid(stash, item));
            g.items = [];
        });

        // Gear slotları
        ['head', 'armor', 'primary', 'backpack'].forEach(slot => {
            const item = p.gear[slot];
            if (item) {
                this.moveItemToGrid(stash, item);
                p.gear[slot] = null;
            }
        });

        this.updateWeaponUI();
    },
    onPlayerDeath() {
        // Raydda üstündə olan hər şeyi itirirsən (Tarkov kimi)
        this.player.grids.pockets.items = [];
        if (this.player.grids.backpack) this.player.grids.backpack.items = [];
        this.player.gear = { head: null, armor: null, primary: null, backpack: null };

        alert('ÖLDÜN. Gear getdi, amma STASH qalır. Yeni build hazırla.');

        this.enterBase(false);
    }
};

const InvUI = {
    dragData: null, ghostEl: null,
    
    handleRightClick(e) {
        e.preventDefault();
        const target = e.target.closest('.inv-item');
        if (!target) { $('context-menu').style.display='none'; return; }
        
        const uid = parseFloat(target.dataset.uid);
        const gridId = target.dataset.gridId;
        const sourceGrid = gridId.startsWith('gear-') ? null : (Game.player.grids[gridId] || (Game.activeLoot ? Game.activeLoot.grid : null));
        let item;
        if(gridId.startsWith('gear-')) { let slot = gridId.replace('gear-', ''); item = Game.player.gear[slot]; } 
        else { item = sourceGrid.items.find(i => i.uid === uid); }

        if(!item) return;
        const menu = $('context-menu'); menu.innerHTML = ''; menu.style.display = 'block'; menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
        const addOpt = (txt, cb) => { let d = document.createElement('div'); d.className='ctx-item'; d.innerText=txt; d.onclick = () => { cb(); menu.style.display='none'; InvUI.render(); }; menu.appendChild(d); };

        if(gridId === 'loot') {
            addOpt('GÖTÜR', () => {
                if(Game.player.addItemToGrid('pockets', item.id) || Game.player.addItemToGrid('backpack', item.id)) {
                    sourceGrid.items = sourceGrid.items.filter(i => i.uid !== uid);
                } else alert("Yer yoxdur!");
            });
        }

        if(item.type === 'med' || item.type === 'food') {
            addOpt('İSTİFADƏ ET', () => {
                let success = Game.player.useMed(item);
                if(success && sourceGrid) sourceGrid.items = sourceGrid.items.filter(i => i.uid !== uid);
            });
        }
        
        if(gridId.startsWith('gear-')) {
            addOpt('ÇIXAR', () => {
                let slot = gridId.replace('gear-', '');
                if(Game.player.addItemToGrid('pockets', item.id) || Game.player.addItemToGrid('backpack', item.id)) { Game.player.gear[slot] = null; } else alert("Yer yoxdur!");
            });
        } else if (['primary','head','armor','backpack'].includes(item.type)) {
             addOpt('TAX', () => {
                 let slot = item.type;
                 if(!Game.player.gear[slot]) { Game.player.gear[slot] = item; sourceGrid.items = sourceGrid.items.filter(i => i.uid !== uid); } else alert("Slot doludur!");
             });
        }
        addOpt('AT', () => {
            if(sourceGrid) sourceGrid.items = sourceGrid.items.filter(i => i.uid !== uid);
            if(gridId.startsWith('gear-')) Game.player.gear[gridId.replace('gear-', '')] = null;
        });
        document.body.onclick = () => menu.style.display='none';
    },

    render() {
        ['head', 'armor', 'primary', 'backpack'].forEach(slot => {
            const el = $(`slot-${slot}`); el.innerHTML = ''; el.style.background = '#1c1c1e';
            const item = Game.player.gear[slot];
            el.innerHTML = `<div class="w-full h-full absolute top-0 left-0 inv-item opacity-0" data-grid-id="gear-${slot}" data-uid="${item ? item.uid : 0}"></div>`;
            if (item) {
                const img = document.createElement('div'); img.className = 'w-full h-full flex items-center justify-center text-4xl pointer-events-none';
                img.innerText = item.icon; el.appendChild(img); el.style.background = '#27272a';
            } else { let t = document.createElement('div'); t.innerText=slot.toUpperCase(); t.className="pointer-events-none"; el.appendChild(t); }
        });
        InvUI.renderGrid('grid-pockets', Game.player.grids.pockets);
        if (Game.player.gear.backpack) {
            $('section-backpack').style.display = 'flex';
            if (!Game.player.grids.backpack) Game.player.grids.backpack = new Grid('backpack', 4, 4);
            InvUI.renderGrid('grid-backpack', Game.player.grids.backpack);
        } else $('section-backpack').style.display = 'none';

        if (Game.state === 'base') {
            $('section-loot').style.display = 'flex';
            const title = $('section-loot').querySelector('.grid-title');
            if (title) title.innerText = 'STASH';
            InvUI.renderGrid('grid-loot', Stash);
        } else if (Game.activeLoot) {
            $('section-loot').style.display = 'flex';
            const title = $('section-loot').querySelector('.grid-title');
            if (title) title.innerText = 'QƏNİMƏT';
            InvUI.renderGrid('grid-loot', Game.activeLoot.grid);
        } else {
            $('section-loot').style.display = 'none';
        }
        
        Game.updateWeaponUI();
    },
    renderGrid(domId, gridObj) {
        const el = $(domId); el.innerHTML = ''; el.dataset.gridId = gridObj.id;
        gridObj.items.forEach(item => {
            const div = document.createElement('div'); div.className = 'inv-item';
            div.style.left = (item.x * CELL) + 'px'; div.style.top = (item.y * CELL) + 'px';
            div.style.width = (item.w * CELL) + 'px'; div.style.height = (item.h * CELL) + 'px';
            div.innerHTML = `<span style="font-size:2rem">${item.icon}</span>`;
            div.dataset.uid = item.uid; div.dataset.gridId = gridObj.id; el.appendChild(div);
        });
    },
    handleDragStart(e) {
        const target = e.target.closest('.inv-item'); if (!target) return;
        const uid = parseFloat(target.dataset.uid);
        const gridId = target.dataset.gridId;
        if(gridId.startsWith('gear-')) return; 
        const sourceGrid = Game.player.grids[gridId] || (Game.activeLoot ? Game.activeLoot.grid : null);
        if(!sourceGrid) return;
        const item = sourceGrid.items.find(i => i.uid === uid);
        this.dragData = { item, sourceGrid };
        this.ghostEl = target.cloneNode(true); this.ghostEl.classList.add('dragging'); document.body.appendChild(this.ghostEl);
        target.style.opacity = '0.3'; this.handleDragMove(e);
    },
    handleDragMove(e) { if (!this.dragData) return; this.ghostEl.style.left = (e.clientX - 25) + 'px'; this.ghostEl.style.top = (e.clientY - 25) + 'px'; },
    handleDragEnd(e) {
        if (!this.dragData) return;
        const { item, sourceGrid } = this.dragData; this.ghostEl.remove();
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const gridEl = elUnder.closest('.item-grid');
        if (gridEl) {
            const targetGridId = gridEl.dataset.gridId;
            const targetGrid = Game.player.grids[targetGridId] || Game.activeLoot.grid;
            const rect = gridEl.getBoundingClientRect();
            const gx = Math.floor((e.clientX - rect.left) / CELL);
            const gy = Math.floor((e.clientY - rect.top) / CELL);
            if (targetGrid.canPlace(gx, gy, item.w, item.h, item.uid)) {
                sourceGrid.items = sourceGrid.items.filter(i => i.uid !== item.uid);
                item.x = gx; item.y = gy; targetGrid.items.push(item);
            }
        }
        this.dragData = null; this.render();
    }
};

Game.init();
