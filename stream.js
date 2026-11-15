// Stream mode: every few minutes the page turns into a cozy "live stream" where the
// hedgehog (with headset) plays a rotation of original mini games, with chat,
// a webcam box and the submission countdown pinned at the top.
//
// Uses globals from index.html: busy, free, still, FLAGS, bossPending, CONFIG, on, havenName.
(() => {
  const W = 320, H = 180;
  const PAL = {
    butter: "#ffe382", yellow: "#ffd059", orangeMid: "#fc8616", orange: "#fa681b",
    orangeDeep: "#ed5615", green: "#b8c220", greenDeep: "#97a01a", teal: "#2cbf90",
    brown: "#b8774a", brownLight: "#dda47d", dark: "#3a1a08", red: "#e8262b",
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // ---------- shared sprites ----------
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function circle(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // little side-view hedgehog, ~16px wide, (x, y) = centre
  function hogSprite(ctx, x, y, face = 1, t = 0, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(face * scale, scale);
    const step = Math.sin(t * 18) > 0 ? 1 : 0;
    rect(ctx, -5, 5 - step, 3, 3, "#7a2e0e");
    rect(ctx, 2, 5 - (1 - step), 3, 3, "#7a2e0e");
    ctx.fillStyle = "#b8381a";
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI * .95;
      const r = i % 2 ? 6 : 9;
      ctx.lineTo(Math.cos(a) * r - 1, Math.sin(a) * r + 1);
    }
    ctx.lineTo(4, 5);
    ctx.lineTo(-7, 5);
    ctx.fill();
    circle(ctx, 2, 1, 5.5, "#f7a98a");
    rect(ctx, 4, -2, 2, 2, PAL.dark);
    rect(ctx, 7, 1, 2, 2, "#7a2e0e");
    rect(ctx, 2, 2, 2, 1, "#f06a5a");
    ctx.restore();
  }

  // ---------- game 1: Hedge Quest (top-down adventure) ----------
  function hedgeQuest(emit) {
    const T = 16, COLS = 20, ROWS = 10, TOP = 20;
    let grid, slimes, gems, scroll = 0, rooms = 1;
    const hero = { x: 24, y: TOP + 4.5 * T, dir: [1, 0], swing: 0, hp: 3, inv: 0, gems: 0, stuck: 0, wander: null, t: 0 };

    function makeRoom() {
      grid = [];
      for (let r = 0; r < ROWS; r++) {
        grid.push([]);
        for (let c = 0; c < COLS; c++) {
          const edge = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
          const door = (c === 0 || c === COLS - 1) && (r === 4 || r === 5);
          // pillars only on even cells, so there's always a way round them
          const pillar = !edge && r % 2 === 0 && c % 2 === 0 && c > 2 && c < COLS - 3 && Math.random() < .45;
          grid[r].push(door ? 0 : edge ? 1 : pillar ? (Math.random() < .5 ? 1 : 2) : Math.random() < .06 ? 3 : 0);
        }
      }
      slimes = Array.from({ length: 3 + Math.min(rooms, 4) }, () => {
        let c, r;
        do { c = 4 + Math.floor(Math.random() * 14); r = 1 + Math.floor(Math.random() * 8); } while (grid[r][c] === 1 || grid[r][c] === 2);
        return { x: c * T + 8, y: TOP + r * T + 8, dir: [0, 0], turn: 0, t: Math.random() * 6, hue: pick(["#2cbf90", "#8a6bd6", "#4ab0e0"]) };
      });
      gems = [];
    }

    const solidAt = (x, y) => {
      const c = Math.floor(x / T), r = Math.floor((y - TOP) / T);
      if (r < 0 || r >= ROWS) return true;
      if (c < 0 || c >= COLS) return !(r === 4 || r === 5);
      return grid[r][c] === 1 || grid[r][c] === 2;
    };
    const boxFree = (x, y, h = 5) => !solidAt(x - h, y - h) && !solidAt(x + h, y - h) && !solidAt(x - h, y + h) && !solidAt(x + h, y + h);

    function move(e, dx, dy) {
      let moved = false;
      if (dx && boxFree(e.x + dx, e.y)) { e.x += dx; moved = true; }
      if (dy && boxFree(e.x, e.y + dy)) { e.y += dy; moved = true; }
      return moved;
    }

    makeRoom();
    return {
      title: "HEDGE QUEST", tag: "any% no sword glitches",
      update(dt) {
        hero.t += dt;
        if (scroll > 0) { scroll = Math.max(0, scroll - dt * 2.2); return; }
        hero.swing = Math.max(0, hero.swing - dt);
        hero.inv = Math.max(0, hero.inv - dt);

        // pick a target: nearest slime, then gems, then the exit door
        const targets = slimes.length ? slimes : gems.length ? gems : [{ x: W + 10, y: TOP + 5 * T }];
        let target = targets[0], best = Infinity;
        for (const s of targets) {
          const d = Math.hypot(s.x - hero.x, s.y - hero.y);
          if (d < best) { best = d; target = s; }
        }
        const dx = target.x - hero.x, dy = target.y - hero.y;
        const speed = 60 * dt;
        if (hero.wander && hero.wander.time > 0) {
          hero.wander.time -= dt;
          move(hero, hero.wander.dx * speed, hero.wander.dy * speed);
        } else if (!(slimes.length && best < 17)) {
          const sx = Math.sign(dx) * Math.min(speed, Math.abs(dx)), sy = Math.sign(dy) * Math.min(speed, Math.abs(dy));
          const moved = Math.abs(dx) > Math.abs(dy) ? move(hero, sx, 0) || move(hero, 0, sy) : move(hero, 0, sy) || move(hero, sx, 0);
          hero.stuck = moved ? 0 : hero.stuck + dt;
          if (hero.stuck > .25) {
            hero.wander = { time: .5, ...pick([{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }]) };
            hero.stuck = 0;
          }
        }
        if (Math.abs(dx) + Math.abs(dy) > 1) hero.dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];

        // sword
        if (slimes.length && best < 20 && hero.swing === 0) {
          hero.swing = .28;
          slimes = slimes.filter(s => {
            const hit = Math.hypot(s.x - hero.x, s.y - hero.y) < 24;
            if (hit) { gems.push({ x: s.x, y: s.y, t: 0 }); emit("kill"); }
            return !hit;
          });
        }
        gems = gems.filter(g => {
          g.t += dt;
          if (Math.hypot(g.x - hero.x, g.y - hero.y) < 10) { hero.gems++; emit("coin"); return false; }
          return true;
        });

        for (const s of slimes) {
          s.t += dt;
          s.turn -= dt;
          if (s.turn <= 0) { s.dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]); s.turn = rand(.8, 1.8); }
          move(s, s.dir[0] * 22 * dt, s.dir[1] * 22 * dt);
          if (hero.inv === 0 && Math.hypot(s.x - hero.x, s.y - hero.y) < 10) {
            hero.inv = 1.2;
            hero.hp--;
            emit("hurt");
            if (hero.hp <= 0) { hero.hp = 3; emit("dead"); }
          }
        }

        if (hero.x > W - 4) {
          rooms++;
          hero.x = 10;
          hero.hp = 3;
          makeRoom();
          scroll = 1;
          emit("level");
        }
      },
      draw(ctx) {
        const shift = scroll * W;
        ctx.save();
        ctx.translate(Math.round(shift), 0);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const x = c * T, y = TOP + r * T;
            rect(ctx, x, y, T, T, (r + c) % 2 ? "#79c943" : "#6fbf3a");
            const v = grid[r][c];
            if (v === 3) { rect(ctx, x + 5, y + 6, 2, 2, "#ffe382"); rect(ctx, x + 10, y + 10, 2, 2, "#ff8fb0"); }
            if (v === 1) { rect(ctx, x + 6, y + 10, 4, 6, "#7a4a24"); circle(ctx, x + 8, y + 7, 7, "#2f7d32"); circle(ctx, x + 6, y + 5, 3, "#3f9a3e"); }
            if (v === 2) { circle(ctx, x + 8, y + 9, 6, "#8f8f8f"); circle(ctx, x + 6, y + 7, 2.5, "#b5b5b5"); }
          }
        }
        for (const g of gems) {
          const bob = Math.sin(g.t * 6) * 1.5;
          ctx.fillStyle = PAL.teal;
          ctx.beginPath();
          ctx.moveTo(g.x, g.y - 5 + bob); ctx.lineTo(g.x + 4, g.y + bob); ctx.lineTo(g.x, g.y + 5 + bob); ctx.lineTo(g.x - 4, g.y + bob);
          ctx.fill();
          rect(ctx, g.x - 1, g.y - 3 + bob, 1, 2, "#fff");
        }
        for (const s of slimes) {
          const squish = Math.sin(s.t * 8) * 1.2;
          ctx.fillStyle = s.hue;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 2, 6 + squish, 5 - squish, 0, Math.PI, 0);
          ctx.lineTo(s.x + 6 + squish, s.y + 4);
          ctx.lineTo(s.x - 6 - squish, s.y + 4);
          ctx.fill();
          rect(ctx, s.x - 3, s.y - 1, 2, 2, "#fff");
          rect(ctx, s.x + 1, s.y - 1, 2, 2, "#fff");
        }
        if (!(hero.inv > 0 && Math.floor(hero.inv * 12) % 2)) {
          hogSprite(ctx, hero.x, hero.y - 2, hero.dir[0] < 0 ? -1 : 1, hero.t);
        }
        if (hero.swing > 0) {
          const a = Math.atan2(hero.dir[1], hero.dir[0]);
          const sweep = (1 - hero.swing / .28) * 2.2 - 1.1;
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(hero.x + Math.cos(a + sweep) * 5, hero.y + Math.sin(a + sweep) * 5);
          ctx.lineTo(hero.x + Math.cos(a + sweep) * 17, hero.y + Math.sin(a + sweep) * 17);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,227,130,.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hero.x, hero.y, 15, a - 1.1, a + sweep);
          ctx.stroke();
        }
        ctx.restore();

        rect(ctx, 0, 0, W, TOP, "#1d2b12");
        for (let i = 0; i < 3; i++) {
          const x = 8 + i * 12, c = i < hero.hp ? "#ff4d5e" : "#55303a";
          rect(ctx, x, 6, 3, 3, c); rect(ctx, x + 4, 6, 3, 3, c); rect(ctx, x, 8, 7, 3, c); rect(ctx, x + 2, 11, 3, 2, c);
        }
        ctx.fillStyle = PAL.teal;
        ctx.font = "bold 10px monospace";
        ctx.fillText(`◆ ${hero.gems}`, 50, 14);
        ctx.fillStyle = PAL.butter;
        ctx.fillText(`AREA ${rooms}`, 260, 14);
      },
    };
  }

  // ---------- game 2: Spike Dash (side-scrolling platformer) ----------
  function spikeDash(emit) {
    const GROUND = 148;
    let ground = [], platforms = [], acorns = [], beetles = [], lastX = 0;
    const hero = { x: 40, y: GROUND - 8, vy: 0, onGround: true, inv: 0, acorns: 0, t: 0, safeX: 40 };
    let cam = 0, spin = 0;

    function generate(until) {
      while (lastX < until) {
        const gap = lastX > 200 && Math.random() < .45 ? rand(22, 42) : 0;
        const x = lastX + gap, w = rand(70, 150);
        ground.push({ x, w });
        if (w > 100 && Math.random() < .6) beetles.push({ x: x + w * .6, minX: x + 8, maxX: x + w - 8, vx: -18, alive: true, squash: 0 });
        if (Math.random() < .5) {
          const p = { x: x + rand(10, w - 50), y: rand(98, 112), w: 40 };
          platforms.push(p);
          for (let i = 0; i < 3; i++) acorns.push({ x: p.x + 8 + i * 12, y: p.y - 8, taken: false });
        } else {
          for (let i = 0; i < 3; i++) acorns.push({ x: x + 20 + i * 14, y: GROUND - 10, taken: false });
        }
        lastX = x + w;
      }
      ground = ground.filter(g => g.x + g.w > cam - 40);
      platforms = platforms.filter(p => p.x + p.w > cam - 40);
      acorns = acorns.filter(a => a.x > cam - 40);
      beetles = beetles.filter(b => b.x > cam - 40);
    }

    const groundUnder = x => ground.find(g => x >= g.x && x <= g.x + g.w);
    let skipJump = false;

    generate(W * 2);
    return {
      title: "SPIKE DASH", tag: "world 1 blind run",
      update(dt) {
        hero.t += dt;
        hero.inv = Math.max(0, hero.inv - dt);
        generate(cam + W * 2);
        const prevBottom = hero.y + 8;
        hero.x += 78 * dt;
        hero.vy += 720 * dt;
        hero.y += hero.vy * dt;
        if (!hero.onGround) spin += dt * 14;

        // landing on ground / one-way platforms
        hero.onGround = false;
        const g = groundUnder(hero.x);
        if (g && hero.vy >= 0 && prevBottom <= GROUND + 2 && hero.y + 8 >= GROUND) {
          hero.y = GROUND - 8; hero.vy = 0; hero.onGround = true; hero.safeX = hero.x; spin = 0;
        }
        for (const p of platforms) {
          if (hero.vy >= 0 && hero.x > p.x - 3 && hero.x < p.x + p.w + 3 && prevBottom <= p.y + 2 && hero.y + 8 >= p.y) {
            hero.y = p.y - 8; hero.vy = 0; hero.onGround = true; spin = 0;
          }
        }

        // AI: jump at edges, over/onto beetles, up to acorn platforms
        if (hero.onGround) {
          const edgeAhead = !groundUnder(hero.x + 16) && hero.y + 8 >= GROUND - 1;
          const beetleAhead = beetles.some(b => b.alive && b.x - hero.x > 0 && b.x - hero.x < 34);
          const platAhead = platforms.some(p => p.x - hero.x > 6 && p.x - hero.x < 26 && acorns.some(a => !a.taken && a.x > p.x && a.x < p.x + p.w));
          if (edgeAhead && !skipJump) {
            // now and then he fumbles a jump, for drama
            if (Math.random() < .08) skipJump = true;
            else { hero.vy = -265; hero.onGround = false; }
          } else if (beetleAhead || platAhead) {
            hero.vy = -265; hero.onGround = false;
          }
        }
        if (hero.onGround && groundUnder(hero.x + 16)) skipJump = false;

        for (const b of beetles) {
          if (!b.alive) { b.squash += dt; continue; }
          b.x += b.vx * dt;
          if (b.x < b.minX || b.x > b.maxX) b.vx *= -1;
          if (Math.abs(b.x - hero.x) < 10 && Math.abs(GROUND - 5 - hero.y) < 12) {
            if (hero.vy > 0 && hero.y < GROUND - 9) { b.alive = false; hero.vy = -200; emit("kill"); }
            else if (hero.inv === 0) { hero.inv = 1; emit("hurt"); }
          }
        }
        beetles = beetles.filter(b => b.alive || b.squash < .6);
        for (const a of acorns) {
          if (!a.taken && Math.abs(a.x - hero.x) < 9 && Math.abs(a.y - hero.y) < 11) { a.taken = true; hero.acorns++; emit("coin"); }
        }

        if (hero.y > H + 30) {
          emit("dead");
          const next = ground.find(gr => gr.x > hero.safeX) || ground[ground.length - 1];
          hero.x = next.x + 10; hero.y = GROUND - 40; hero.vy = 0; skipJump = false;
        }
        cam += (hero.x - 90 - cam) * Math.min(1, dt * 6);
      },
      draw(ctx) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#ffb35c"); sky.addColorStop(1, "#ffe7a8");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        circle(ctx, 250, 45, 18, "#fff2c0");
        for (const [k, color, y, amp] of [[.2, "#e7a05a", 110, 26], [.5, "#b8c220", 128, 18]]) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y - Math.abs(Math.sin((x + cam * k) / 40)) * amp);
          ctx.lineTo(W, H);
          ctx.fill();
        }
        ctx.save();
        ctx.translate(-Math.round(cam), 0);
        for (const g of ground) {
          rect(ctx, g.x, GROUND, g.w, H - GROUND, "#b8774a");
          rect(ctx, g.x, GROUND, g.w, 5, "#8fbf2a");
          for (let x = g.x + 6; x < g.x + g.w - 4; x += 14) rect(ctx, x, GROUND + 12, 4, 3, "#9d6036");
        }
        for (const p of platforms) {
          rect(ctx, p.x, p.y, p.w, 7, "#dda47d");
          rect(ctx, p.x, p.y, p.w, 2, "#fff0d0");
          rect(ctx, p.x + 2, p.y + 7, 4, 2, "#9d6036"); rect(ctx, p.x + p.w - 6, p.y + 7, 4, 2, "#9d6036");
        }
        for (const a of acorns) {
          if (a.taken) continue;
          const bob = Math.sin(hero.t * 5 + a.x) * 1.5;
          circle(ctx, a.x, a.y + 2 + bob, 4, "#c9824f");
          rect(ctx, a.x - 4, a.y - 3 + bob, 8, 3, "#7a4a24");
          rect(ctx, a.x, a.y - 5 + bob, 1, 2, "#7a4a24");
        }
        for (const b of beetles) {
          const y = GROUND - 5;
          if (!b.alive) { rect(ctx, b.x - 6, GROUND - 2, 12, 2, "#7a1a1a"); continue; }
          ctx.fillStyle = "#c0262d";
          ctx.beginPath(); ctx.ellipse(b.x, y, 7, 5, 0, Math.PI, 0); ctx.fill();
          rect(ctx, b.x - 7, y, 14, 3, "#3a1a08");
          rect(ctx, b.x - 1, y - 5, 1, 5, "#3a1a08");
          rect(ctx, b.x + (b.vx < 0 ? -9 : 6), y - 1, 3, 3, "#3a1a08");
        }
        if (!(hero.inv > 0 && Math.floor(hero.inv * 12) % 2)) {
          ctx.save();
          ctx.translate(Math.round(hero.x), Math.round(hero.y));
          ctx.rotate(spin);
          hogSprite(ctx, 0, 0, 1, hero.onGround ? hero.t : 0);
          ctx.restore();
        }
        ctx.restore();
        ctx.fillStyle = PAL.dark;
        ctx.font = "bold 10px monospace";
        ctx.fillText(`ACORNS ${hero.acorns}`, 8, 14);
        ctx.fillText(`${Math.floor(hero.x / 10)}m`, 270, 14);
      },
    };
  }

  // ---------- game 3: Crust Raiders (space shooter) ----------
  function crustRaiders(emit) {
    const stars = Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(10, 40) }));
    const ship = { x: W / 2, y: 162, cool: 0, inv: 0, lives: 3, score: 0, t: 0 };
    let shots = [], drops = [], bits = [], enemies = [], form = { x: 0, dir: 1, y: 0 }, wave = 0, waveText = 0;

    function newWave() {
      wave++;
      waveText = 1.6;
      form = { x: 0, dir: 1, y: 0 };
      enemies = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
        enemies.push({ col: c, row: r, x: 0, y: 0, dive: null });
      }
    }

    const slot = e => ({ x: 70 + e.col * 28 + form.x, y: 28 + e.row * 18 + form.y });
    newWave();

    return {
      title: "CRUST RAIDERS", tag: "high score attempt",
      update(dt) {
        ship.t += dt;
        waveText = Math.max(0, waveText - dt);
        for (const s of stars) { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
        const speed = 22 + wave * 6;
        form.x += form.dir * speed * dt;
        if (form.x > 40 || form.x < -40) { form.dir *= -1; form.y = Math.min(form.y + 5, 40); }

        for (const e of enemies) {
          const home = slot(e);
          if (e.dive) {
            e.dive.t += dt;
            e.x = e.dive.x0 + Math.sin(e.dive.t * 3) * 50;
            e.y = home.y + e.dive.t * 70;
            if (e.y > H + 10) e.dive = null;
          } else {
            e.x = home.x; e.y = home.y;
            if (Math.random() < dt * .02) e.dive = { t: 0, x0: home.x };
          }
        }
        // bottom enemies drop pepperoni
        if (enemies.length && Math.random() < dt * (.9 + wave * .25)) {
          const e = pick(enemies);
          drops.push({ x: e.x, y: e.y + 6 });
        }
        drops.forEach(d => { d.y += 80 * dt; });
        drops = drops.filter(d => d.y < H + 5);

        // AI: dodge nearby pepperoni, otherwise line up under the lowest enemy and fire
        const danger = drops.find(d => d.y > ship.y - 45 && d.y < ship.y + 4 && Math.abs(d.x - ship.x) < 12)
          || enemies.find(e => e.dive && e.y > ship.y - 60 && e.y < ship.y + 6 && Math.abs(e.x - ship.x) < 20);
        const target = enemies.reduce((a, e) => (!a || e.y > a.y + 4 || (Math.abs(e.y - a.y) <= 4 && Math.abs(e.x - ship.x) < Math.abs(a.x - ship.x)) ? e : a), null);
        let goal = ship.x;
        if (danger) goal = ship.x + (danger.x > ship.x ? -34 : 34);
        else if (target) goal = target.x;
        ship.x += clamp(goal - ship.x, -130 * dt, 130 * dt);
        ship.x = clamp(ship.x, 10, W - 10);
        ship.cool -= dt;
        if (target && ship.cool <= 0 && Math.abs(target.x - ship.x) < 9) { shots.push({ x: ship.x, y: ship.y - 8 }); ship.cool = .3; }

        shots.forEach(s => { s.y -= 190 * dt; });
        shots = shots.filter(s => {
          if (s.y < -5) return false;
          const hit = enemies.find(e => Math.abs(e.x - s.x) < 7 && Math.abs(e.y - s.y) < 7);
          if (!hit) return true;
          enemies = enemies.filter(e => e !== hit);
          ship.score += 100;
          for (let i = 0; i < 10; i++) bits.push({ x: hit.x, y: hit.y, vx: rand(-60, 60), vy: rand(-60, 60), life: rand(.3, .6), c: pick([PAL.yellow, PAL.orange, "#fff"]) });
          emit("kill");
          return false;
        });
        bits.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; });
        bits = bits.filter(b => b.life > 0);

        ship.inv = Math.max(0, ship.inv - dt);
        if (ship.inv === 0) {
          const hitBy = drops.find(d => Math.abs(d.x - ship.x) < 7 && Math.abs(d.y - ship.y) < 7)
            || enemies.find(e => e.dive && Math.abs(e.x - ship.x) < 9 && Math.abs(e.y - ship.y) < 9);
          if (hitBy) {
            ship.inv = 1.5;
            ship.lives--;
            emit("hurt");
            if (ship.lives <= 0) { ship.lives = 3; emit("dead"); }
          }
        }
        if (!enemies.length) { emit("level"); newWave(); }
      },
      draw(ctx) {
        rect(ctx, 0, 0, W, H, "#1a0f2e");
        for (const s of stars) rect(ctx, s.x, s.y, s.s > 30 ? 2 : 1, s.s > 30 ? 2 : 1, s.s > 30 ? "#fff" : "#9c8cc9");
        for (const e of enemies) {
          ctx.fillStyle = PAL.yellow;
          ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 5); ctx.lineTo(e.x + 6, e.y - 5); ctx.lineTo(e.x, e.y + 7); ctx.fill();
          rect(ctx, e.x - 7, e.y - 7, 14, 3, PAL.brown);
          rect(ctx, e.x - 3, e.y - 3, 2, 2, PAL.orangeDeep);
          rect(ctx, e.x + 1, e.y, 2, 2, PAL.orangeDeep);
        }
        for (const d of drops) circle(ctx, d.x, d.y, 2.5, "#ff5a4e");
        for (const s of shots) rect(ctx, s.x - 1, s.y - 4, 2, 6, PAL.teal);
        for (const b of bits) rect(ctx, b.x, b.y, 2, 2, b.c);
        if (!(ship.inv > 0 && Math.floor(ship.inv * 12) % 2)) {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.moveTo(ship.x, ship.y - 10); ctx.lineTo(ship.x + 8, ship.y + 6); ctx.lineTo(ship.x - 8, ship.y + 6); ctx.fill();
          rect(ctx, ship.x - 8, ship.y + 4, 4, 4, PAL.orange); rect(ctx, ship.x + 4, ship.y + 4, 4, 4, PAL.orange);
          rect(ctx, ship.x - 2, ship.y + 6, 4, 3 + Math.round(Math.random() * 3), PAL.yellow);
          circle(ctx, ship.x, ship.y - 1, 3, "#f7a98a");
        }
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`SCORE ${String(ship.score).padStart(5, "0")}`, 8, 12);
        ctx.fillText("♥".repeat(ship.lives), 280, 12);
        if (waveText > 0) {
          ctx.fillStyle = PAL.butter;
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`WAVE ${wave}`, W / 2, 100);
          ctx.textAlign = "left";
        }
      },
    };
  }

  // ---------- game 4: Beat Hog (rhythm) ----------
  function beatHog(emit) {
    const LANES = [116, 146, 176, 206], HIT = 150, SPEED = 125, BEAT = 60 / 128;
    const COLORS = [PAL.orange, PAL.yellow, PAL.teal, "#ff8fb0"];
    let notes = [], t = 0, nextBeat = .5, combo = 0, best = 0, score = 0, judge = null, flashes = [0, 0, 0, 0], pulse = 0;
    return {
      title: "BEAT HOG", tag: "expert difficulty",
      update(dt) {
        t += dt;
        pulse = Math.max(0, pulse - dt * 3);
        if (t >= nextBeat) {
          nextBeat += Math.random() < .25 ? BEAT / 2 : BEAT;
          pulse = 1;
          const lanes = Math.random() < .2 ? [0, 1, 2, 3].sort(() => Math.random() - .5).slice(0, 2) : [Math.floor(Math.random() * 4)];
          // decide now how well he'll hit it: mostly perfect, sometimes good, rarely a miss
          for (const lane of lanes) {
            const roll = Math.random();
            notes.push({ lane, y: -8, result: roll < .82 ? "PERFECT" : roll < .95 ? "GOOD" : "MISS", off: rand(-5, 5) });
          }
        }
        for (let i = 0; i < 4; i++) flashes[i] = Math.max(0, flashes[i] - dt * 4);
        notes.forEach(n => { n.y += SPEED * dt; });
        notes = notes.filter(n => {
          const at = n.result === "PERFECT" ? HIT : HIT + n.off;
          if (n.result !== "MISS" && n.y >= at) {
            flashes[n.lane] = 1;
            combo++;
            best = Math.max(best, combo);
            score += n.result === "PERFECT" ? 300 : 100;
            judge = { text: n.result, t: .5 };
            if (combo % 25 === 0) emit("level");
            else if (Math.random() < .08) emit("coin");
            return false;
          }
          if (n.y > HIT + 18) {
            combo = 0;
            judge = { text: "MISS", t: .5 };
            emit("hurt");
            return false;
          }
          return true;
        });
        if (judge) { judge.t -= dt; if (judge.t <= 0) judge = null; }
      },
      draw(ctx) {
        rect(ctx, 0, 0, W, H, "#2a1236");
        for (let i = 0; i < 6; i++) {
          ctx.strokeStyle = `rgba(250,104,27,${.15 + pulse * .25 - i * .02})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(W / 2, H / 2, 20 + i * 26 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
        }
        rect(ctx, 100, 0, 122, H, "rgba(0,0,0,.45)");
        LANES.forEach((x, i) => {
          rect(ctx, x - 12, 0, 24, H, flashes[i] ? `rgba(255,227,130,${flashes[i] * .35})` : "rgba(255,255,255,.04)");
          ctx.strokeStyle = COLORS[i];
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, HIT, 9 + flashes[i] * 3, 0, Math.PI * 2); ctx.stroke();
        });
        for (const n of notes) {
          circle(ctx, LANES[n.lane], n.y, 8, COLORS[n.lane]);
          circle(ctx, LANES[n.lane], n.y, 4, "#fff");
        }
        // dancing hog on the left
        const bounce = Math.abs(Math.sin(t * Math.PI / BEAT)) * 6;
        hogSprite(ctx, 50, 120 - bounce, 1, 0, 3);
        hogSprite(ctx, 270, 120 - bounce, -1, 0, 3);
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(`SCORE ${score}`, 8, 14);
        ctx.fillText(`BEST x${best}`, 252, 14);
        ctx.textAlign = "center";
        if (combo > 2) {
          ctx.fillStyle = PAL.butter;
          ctx.font = "bold 16px monospace";
          ctx.fillText(`${combo} COMBO`, W / 2, 60);
        }
        if (judge) {
          ctx.fillStyle = judge.text === "MISS" ? "#ff5a4e" : judge.text === "GOOD" ? PAL.teal : PAL.yellow;
          ctx.font = "bold 14px monospace";
          ctx.fillText(judge.text, W / 2, 110 - (.5 - judge.t) * 20);
        }
        ctx.textAlign = "left";
      },
    };
  }

  // ---------- game 5: Noodle (snake) ----------
  function noodle(emit) {
    const C = 10, COLS = 32, ROWS = 16, TOP = 20;
    let body, dir, food, timer = 0, score = 0, best = 0, dead = 0;
    const key = (x, y) => y * COLS + x;
    function reset() {
      body = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
      dir = { x: 1, y: 0 };
      score = 0;
      placeFood();
    }
    function placeFood() {
      const taken = new Set(body.map(b => key(b.x, b.y)));
      do food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; while (taken.has(key(food.x, food.y)));
    }
    const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

    // breadth-first search from the head to the food, avoiding the body (tail will move)
    function firstStep() {
      const head = body[0];
      const blocked = new Set(body.slice(0, -1).map(b => key(b.x, b.y)));
      const prev = new Map([[key(head.x, head.y), null]]);
      const queue = [head];
      while (queue.length) {
        const cur = queue.shift();
        if (cur.x === food.x && cur.y === food.y) {
          let k = key(cur.x, cur.y), step = cur;
          while (prev.get(k) && !(prev.get(k).x === head.x && prev.get(k).y === head.y)) { step = prev.get(k); k = key(step.x, step.y); }
          return { x: step.x - head.x, y: step.y - head.y };
        }
        for (const d of DIRS) {
          const nx = cur.x + d.x, ny = cur.y + d.y, k = key(nx, ny);
          if (!inside(nx, ny) || blocked.has(k) || prev.has(k)) continue;
          prev.set(k, cur);
          queue.push({ x: nx, y: ny });
        }
      }
      // no path: take any safe step
      return DIRS.find(d => inside(head.x + d.x, head.y + d.y) && !blocked.has(key(head.x + d.x, head.y + d.y))) || null;
    }

    reset();
    return {
      title: "NOODLE", tag: "going for 100",
      update(dt) {
        if (dead > 0) { dead -= dt; if (dead <= 0) reset(); return; }
        timer += dt;
        while (timer > 1 / 14) {
          timer -= 1 / 14;
          const step = firstStep();
          if (!step) { dead = 1.2; emit("dead"); return; }
          dir = step;
          const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
          body.unshift(head);
          if (head.x === food.x && head.y === food.y) {
            score++;
            best = Math.max(best, score);
            emit(score % 10 === 0 ? "level" : "coin");
            if (body.length > 120) { dead = 1.2; emit("level"); return; }
            placeFood();
          } else body.pop();
        }
      },
      draw(ctx) {
        rect(ctx, 0, 0, W, H, "#16240f");
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if ((x + y) % 2) rect(ctx, x * C, TOP + y * C, C, C, "#1c2e13");
        }
        circle(ctx, food.x * C + 5, TOP + food.y * C + 6, 3.5, "#c9824f");
        rect(ctx, food.x * C + 1, TOP + food.y * C + 1, 8, 3, "#7a4a24");
        body.forEach((b, i) => {
          const c = i === 0 ? PAL.butter : i % 2 ? PAL.green : PAL.greenDeep;
          rect(ctx, b.x * C + 1, TOP + b.y * C + 1, C - 2, C - 2, dead > 0 && Math.floor(dead * 10) % 2 ? "#ff5a4e" : c);
        });
        const h = body[0];
        rect(ctx, h.x * C + 3 + dir.x * 2, TOP + h.y * C + 3 + dir.y * 2, 2, 2, PAL.dark);
        rect(ctx, 0, 0, W, TOP, "#0d1608");
        ctx.fillStyle = PAL.butter;
        ctx.font = "bold 10px monospace";
        ctx.fillText(`LENGTH ${body.length}`, 8, 14);
        ctx.fillText(`BEST ${best}`, 256, 14);
      },
    };
  }

  const GAMES = [hedgeQuest, spikeDash, crustRaiders, beatHog, noodle];

  // ---------- page furniture ----------
  const css = `
  .stream {
    position: fixed; inset: 0; z-index: 6;
    display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); gap: 12px;
    padding: 14px 16px;
    background: radial-gradient(ellipse at 30% 20%, #4a2410, #1e0d05 70%);
    color: #fff; font-family: var(--font-body);
    visibility: hidden;
  }
  .stream.on { visibility: visible; }
  .stream-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .stream-live { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .live-badge {
    padding: 4px 10px 5px; background: var(--alert-red); border-radius: 6px;
    font-family: var(--font-display); font-size: 20px; letter-spacing: .04em;
    animation: live-pulse 1.6s ease-in-out infinite;
  }
  .viewers { display: flex; align-items: center; gap: 6px; font-size: 17px; color: #ffd2bf; }
  .viewers svg { width: 18px; height: 18px; }
  .stream-clock {
    display: flex; align-items: baseline; gap: 10px;
    padding: 6px 22px 8px; background: var(--haven-butter); color: var(--haven-orange-deep);
    border: 4px solid #fff; border-radius: 999px; box-shadow: 0 6px 0 var(--haven-orange-mid);
    white-space: nowrap;
  }
  .stream-clock b { font-family: var(--font-display); font-weight: 400; font-size: clamp(30px, 4vw, 52px); line-height: 1; font-variant-numeric: tabular-nums; }
  .stream-clock span { font-size: clamp(13px, 1.4vw, 18px); }
  .stream-clock.hot { background: var(--alert-red); color: #fff; box-shadow: 0 6px 0 var(--alert-red-deep); }
  .stream-title { flex: 1; min-width: 0; text-align: right; font-size: clamp(14px, 1.5vw, 20px); color: var(--haven-butter); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stream-title em { font-style: normal; color: #ffd2bf; opacity: .8; }
  .stream-mid { display: grid; grid-template-columns: minmax(0, 1fr) clamp(220px, 22vw, 320px); gap: 12px; min-height: 0; }
  .stream-game {
    position: relative; min-height: 0; border-radius: 14px; overflow: hidden;
    background: #000; border: 4px solid var(--haven-orange-mid); box-shadow: 0 0 0 4px #fff, 0 12px 30px rgba(0,0,0,.5);
  }
  .stream-game canvas { display: block; width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .stream-card {
    position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 6px;
    background: rgba(30, 13, 5, .9); opacity: 0; pointer-events: none;
  }
  .stream-card small { font-size: clamp(14px, 1.6vw, 22px); color: #ffd2bf; }
  .stream-card strong { font-family: var(--font-display); font-weight: 400; font-size: clamp(40px, 7vw, 96px); line-height: 1; color: var(--haven-butter); text-shadow: 0 5px 0 var(--haven-orange-deep); }
  .cam {
    position: absolute; left: 12px; bottom: 12px; width: clamp(120px, 19%, 240px); aspect-ratio: 4 / 3;
    border-radius: 12px; overflow: hidden;
    background: linear-gradient(#ffcf9a, #f3a76b 70%, #b8774a 70%);
    border: 4px solid var(--haven-butter); box-shadow: 0 0 0 3px #fff, 0 10px 20px rgba(0,0,0,.45);
  }
  .cam::before {
    content: ""; position: absolute; left: 6%; right: 6%; top: 10%; height: 4px;
    background: radial-gradient(circle, #fff6c4 2px, transparent 3px) 0 0 / 18px 4px repeat-x;
    filter: drop-shadow(0 0 4px #ffe382);
  }
  .cam-label { position: absolute; left: 6px; top: 4px; z-index: 2; font-size: 11px; color: #fff; text-shadow: 0 1px 2px #000; }
  .cam-hog { position: absolute; left: 8%; right: 8%; bottom: -6%; transform-origin: 50% 100%; }
  .cam-hog img, .cam-hog svg { display: block; width: 100%; }
  .cam-hog svg { position: absolute; inset: 0; height: 100%; overflow: visible; }
  .cam-emote {
    position: absolute; right: 6%; top: 12%; z-index: 2; padding: 3px 9px 4px; background: #fff; color: var(--haven-orange-deep);
    border: 2px solid var(--haven-orange-mid); border-radius: 12px; font-family: var(--font-display); font-size: clamp(13px, 1.3vw, 18px);
    white-space: nowrap; opacity: 0;
  }
  .chat { display: flex; flex-direction: column; min-height: 0; border-radius: 14px; background: rgba(0,0,0,.35); border: 3px solid rgba(255,227,130,.35); overflow: hidden; }
  .chat-head { padding: 8px 12px; font-family: var(--font-display); font-size: 18px; color: var(--haven-butter); border-bottom: 2px solid rgba(255,227,130,.2); }
  .chat-list { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; padding: 8px 12px; overflow: hidden; font-size: 15px; line-height: 1.3; }
  .chat-list p { margin: 0; overflow-wrap: anywhere; }
  .chat-list b { font-weight: 400; }
  .chat-list .bot { color: var(--haven-butter); }
  .stream-bottom { display: flex; gap: 12px; align-items: center; font-size: clamp(14px, 1.5vw, 19px); }
  .stream-bottom .pill { padding: 5px 14px 6px; border-radius: 999px; background: var(--haven-orange-bright); border: 3px solid #fff; white-space: nowrap; }
  .stream-bottom .ticker { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; color: #ffd2bf; }
  .stream-bottom .ticker span { display: inline-block; padding-left: 100%; animation: ticker 28s linear infinite; }
  @keyframes live-pulse { 50% { opacity: .65; } }
  @keyframes ticker { to { transform: translateX(-100%); } }
  @media (max-width: 760px) {
    .stream { gap: 8px; padding: 10px; }
    .stream-top { flex-wrap: wrap; justify-content: center; }
    .stream-clock { order: -1; width: 100%; justify-content: center; }
    .stream-title { text-align: left; }
    .stream-mid { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
    .stream-game { aspect-ratio: 16 / 9; }
    .cam { width: 30%; left: 6px; bottom: 6px; border-width: 3px; }
    .chat-list { font-size: 13px; }
    .stream-bottom .pill:last-child { display: none; }
  }`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

  // headset drawn over hedgehog.webp (422 x 308)
  const HEADSET = `
    <svg viewBox="0 0 422 308" aria-hidden="true">
      <path d="M100 196 C 92 20, 332 20, 324 196" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round"/>
      <path d="M100 196 C 92 20, 332 20, 324 196" fill="none" stroke="#3a1a08" stroke-width="20" stroke-linecap="round"/>
      <path d="M100 196 C 92 20, 332 20, 324 196" fill="none" stroke="#fa681b" stroke-width="8" stroke-linecap="round"/>
      <path d="M104 226 Q 112 268 186 250" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
      <path d="M104 226 Q 112 268 186 250" fill="none" stroke="#3a1a08" stroke-width="8" stroke-linecap="round"/>
      <circle cx="190" cy="249" r="13" fill="#3a1a08" stroke="#fff" stroke-width="5"/>
      <rect x="72" y="160" width="52" height="78" rx="20" fill="#3a1a08" stroke="#fff" stroke-width="6"/>
      <rect x="82" y="172" width="32" height="54" rx="12" fill="#fa681b"/>
      <rect x="300" y="160" width="52" height="78" rx="20" fill="#3a1a08" stroke="#fff" stroke-width="6"/>
      <rect x="310" y="172" width="32" height="54" rx="12" fill="#fa681b"/>
    </svg>`;

  // deadline from the setup screen, e.g. "21:00" -> "9pm", "21:30" -> "9:30pm"
  const [closeH, closeM] = CONFIG.deadline.split(":").map(Number);
  const closeLabel = `${closeH % 12 || 12}${closeM ? ":" + String(closeM).padStart(2, "0") : ""}${closeH < 12 ? "am" : "pm"}`;

  const root = document.createElement("div");
  root.className = "stream";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="stream-top">
      <div class="stream-live">
        <span class="live-badge">LIVE</span>
        <span class="viewers"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span class="count">1,204</span></span>
      </div>
      <div class="stream-clock"><b class="clock">00:00:00</b><span>until submission</span></div>
      <div class="stream-title">hedgehog plays <span class="game-name">...</span> <em class="game-tag"></em></div>
    </div>
    <div class="stream-mid">
      <div class="stream-game">
        <canvas width="${W}" height="${H}"></canvas>
        <div class="stream-card"><small class="card-small">next up</small><strong class="card-big">...</strong></div>
        <div class="cam">
          <span class="cam-label">hog_cam</span>
          <div class="cam-hog"><img src="assets/hedgehog.webp" alt="">${HEADSET}</div>
          <div class="cam-emote"></div>
        </div>
      </div>
      <div class="chat"><div class="chat-head">stream chat</div><div class="chat-list"></div></div>
    </div>
    <div class="stream-bottom">
      <span class="pill">!ship → hack.club/hv</span>
      <div class="ticker"><span>welcome to hog's cozy jam stream · remember to commit your work · drink water · submissions close at ${closeLabel} · be nice in chat ·</span></div>
      <span class="pill">Hack Club ${havenName()}</span>
    </div>`;
  document.body.appendChild(root);

  const $ = sel => root.querySelector(sel);
  const canvas = $("canvas"), ctx = canvas.getContext("2d");
  const card = $(".stream-card"), camHog = $(".cam-hog"), camEmote = $(".cam-emote"), chatList = $(".chat-list");
  const clockEl = $(".stream-clock"), clockText = $(".clock"), countEl = $(".count");

  // ---------- chat ----------
  const NAMES = ["pixel_pip", "acornfan", "bytebadger", "leafpile", "quill_bill", "mossy_mo", "toadstool42", "fern_gully",
    "cozycoder", "spikeyboi", "nutcracker99", "maple_dev", "pine_cone", "burrow_bean", "sproutling", "owl_at_3am", "cinnamoss"];
  const NAME_COLORS = [PAL.orange, PAL.yellow, PAL.teal, "#ff8fb0", "#9fd8ff", PAL.green, "#c9a6ff"];
  const CHATTER = ["hi chat", "W stream", "this hog is cracked", "how is he so good", "first time here, love this",
    "clip that", "ship it!!", "!ship", "who else is still coding rn", "my game has 0 bugs (lie)", "lets gooo", "so cozy in here",
    "GG", "commit your work chat", "hog for president", "is this any%?", "the headset tho", "back to my game in 5 min i swear"];
  const REACT = {
    kill: ["clean", "ez", "no mercy", "W", "sheesh"],
    coin: ["shiny!", "rich hog", "collect them all", "$$$"],
    hurt: ["ouch", "nooo", "he's fine", "unlucky"],
    dead: ["F", "F in chat", "restart arc", "it's ok bud"],
    level: ["LETS GOOO", "next level!!", "HUGE", "gg go next"],
  };
  const nameColor = {};
  function say(name, text, cls = "") {
    nameColor[name] ||= pick(NAME_COLORS);
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.innerHTML = `<b style="color:${nameColor[name]}">${name}</b>: `;
    p.append(text);
    chatList.appendChild(p);
    while (chatList.children.length > 40) chatList.firstElementChild.remove();
  }
  function minutesLeftLine() {
    const [h, m] = clockText.textContent.split(":").map(Number);
    const mins = h * 60 + m;
    return mins > 0 ? `${mins} minutes left!! go go go` : "submissions are closed, gg everyone";
  }

  // ---------- webcam reactions ----------
  function camReact(kind) {
    const happy = kind !== "hurt" && kind !== "dead";
    camHog.animate(happy
      ? [{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(-12%) rotate(-6deg)" }, { transform: "translateY(0) rotate(4deg)" }, { transform: "translateY(0) rotate(0)" }]
      : [{ transform: "rotate(0)" }, { transform: "rotate(-10deg) translateX(-4%)" }, { transform: "rotate(8deg)" }, { transform: "rotate(0)" }],
      { duration: happy ? 500 : 700, easing: "ease-out" });
    if (Math.random() < .5 || kind === "level" || kind === "dead") {
      camEmote.textContent = happy ? pick(kind === "level" ? ["LETS GO!!", "too easy", "chat did you see that"] : ["nice", "gg", "yesss", "easy"]) : pick(["nooo", "lag!!", "that was chat's fault", "bruh"]);
      camEmote.animate([
        { opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "scale(1.1)", offset: .15 },
        { opacity: 1, transform: "scale(1)", offset: .8 }, { opacity: 0, transform: "scale(1)" },
      ], { duration: 1500 });
    }
  }

  function emit(kind) {
    camReact(kind);
    const count = kind === "level" || kind === "dead" ? 3 : Math.random() < .5 ? 1 : 0;
    for (let i = 0; i < count; i++) setTimeout(() => say(pick(NAMES), pick(REACT[kind])), 150 + i * 260);
  }

  // ---------- running a session ----------
  let active = false, game = null, last = 0, gameIndex = Math.floor(Math.random() * GAMES.length);
  const mainCountdown = () => [...document.querySelectorAll("#submission .num")].map(n => n.textContent).join(":");

  function frame(now) {
    if (!active) return;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (game) { game.update(dt); game.draw(ctx); }
    requestAnimationFrame(frame);
  }

  function chatter() {
    if (!active) return;
    const roll = Math.random();
    if (roll < .07) say("haven_bot", "ship your game at hack.club/hv", "bot");
    else if (roll < .14) say(pick(NAMES), minutesLeftLine());
    else say(pick(NAMES), pick(CHATTER));
    setTimeout(chatter, rand(700, 1800));
  }

  function hud() {
    if (!active) return;
    clockText.textContent = mainCountdown();
    clockEl.classList.toggle("hot", Number(document.body.dataset.alert) >= 1);
    countEl.textContent = (Number(countEl.textContent.replace(/,/g, "")) + Math.round(rand(-6, 9))).toLocaleString("en-GB");
    setTimeout(hud, 500);
  }

  async function showCard(small, big, hold) {
    $(".card-small").textContent = small;
    $(".card-big").textContent = big;
    await card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" }).finished;
    await sleep(hold);
    await card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished;
  }

  async function session(rounds, perGame) {
    busy = true;
    active = true;
    chatList.textContent = "";
    root.classList.add("on");
    say("haven_bot", "hog is LIVE! say hi", "bot");
    last = performance.now();
    requestAnimationFrame(frame);
    hud();
    chatter();
    // old-TV switch on
    await root.animate([
      { transform: "scale(1, .004)", filter: "brightness(4)" },
      { transform: "scale(1, 1)", filter: "brightness(2)", offset: .6 },
      { transform: "scale(1, 1)", filter: "brightness(1)" },
    ], { duration: 650, easing: "ease-out" }).finished;

    for (let i = 0; i < rounds; i++) {
      // a due boss fight takes priority: wrap up early
      if (bossPending) break;
      const make = GAMES[gameIndex++ % GAMES.length];
      const next = make(emit);
      $(".game-name").textContent = next.title;
      $(".game-tag").textContent = `(${next.tag})`;
      await showCard(i ? "next up" : "now playing", next.title, 1100);
      game = next;
      say(pick(NAMES), pick([`${next.title.toLowerCase()} lets gooo`, "omg this game", "i love this one", "hog's favourite"]));
      await sleep(perGame);
    }

    await showCard("thanks for watching", "back to the jam!", 1200);
    await root.animate([
      { transform: "scale(1, 1)", filter: "brightness(1)" },
      { transform: "scale(1, .004)", filter: "brightness(4)", offset: .7 },
      { transform: "scale(0, .004)", filter: "brightness(4)" },
    ], { duration: 500, easing: "ease-in" }).finished;
    root.classList.remove("on");
    active = false;
    game = null;
    busy = false;
  }

  // normal screen for ~2.5 min, then a ~90s stream; skipped in the final 30 min so the urgency shows
  const preview = FLAGS.has("stream");
  (function streamLoop(delay) {
    setTimeout(async () => {
      if ((on("stream") || preview) && !still() && free() && Number(document.body.dataset.alert || 0) < 2) {
        await session(3, preview ? 12000 : 27000);
      }
      streamLoop(preview ? 4000 : 150000 + Math.random() * 30000);
    }, delay);
  })(preview ? 1500 : 90000);
})();
