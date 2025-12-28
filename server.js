const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const RESPAWN_TIME = 3000;
const DAMAGE = 25;

const wss = new WebSocket.Server({
  port: PORT,
  host: "0.0.0.0"
});

console.log(`✅ FPS server running on ws://0.0.0.0:${PORT}`);

const players = {};

function uid() {
  return crypto.randomUUID();
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  const id = uid();
  ws.id = id;

  players[id] = {
    x: 0, y: 0, z: 0,
    rot: 0,
    health: 100,
    team: null,
    alive: true
  };

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = players[id];
    if (!p) return;

    // JOIN TEAM
    if (msg.type === "join") {
      p.team = msg.team;
      p.health = 100;
      p.alive = true;
    }

    // MOVE
    if (msg.type === "move" && p.alive) {
      p.x = msg.player.x;
      p.y = msg.player.y;
      p.z = msg.player.z;
      p.rot = msg.player.rot;
    }

    // SHOOT
    if (msg.type === "shoot" && p.alive) {
      for (const tid in players) {
        const t = players[tid];
        if (!t.alive || t.team === p.team) continue;

        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist > 10) continue;

        const angle = Math.atan2(dx, dz);
        const diff = Math.abs(angle - p.rot);
        if (diff < 0.4) {
          t.health -= DAMAGE;

          if (t.health <= 0) {
            t.alive = false;
            t.health = 0;

            setTimeout(() => {
              t.health = 100;
              t.alive = true;
              t.x = t.team === "RED" ? -40 : 40;
              t.z = 0;
            }, RESPAWN_TIME);
          }
        }
      }
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

setInterval(() => {
  broadcast({ type: "state", players });
}, 50);
