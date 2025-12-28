const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const RESPAWN_TIME = 3000;
const DAMAGE = 25;
const SHOOT_RANGE = 50; // Maximum shooting range
const SHOOT_ANGLE = 0.3; // Aiming tolerance (radians)

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

// Normalize angle to -PI to PI range
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
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
      // Set spawn position
      p.x = msg.team === "RED" ? -40 : 40;
      p.z = 0;
      p.y = 0;
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
      let hitSomeone = false;
      
      for (const tid in players) {
        const t = players[tid];
        if (tid === id || !t.alive || t.team === p.team) continue;

        // Calculate distance
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > SHOOT_RANGE) continue;

        // Calculate angle to target
        const angleToTarget = Math.atan2(dx, dz);
        
        // Normalize both angles
        const shooterAngle = normalizeAngle(p.rot);
        const targetAngle = normalizeAngle(angleToTarget);
        
        // Calculate angle difference
        let angleDiff = Math.abs(targetAngle - shooterAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        // Check if target is within aiming cone
        if (angleDiff < SHOOT_ANGLE) {
          t.health -= DAMAGE;
          hitSomeone = true;

          // Broadcast hit event for visual feedback
          broadcast({
            type: "hit",
            shooter: id,
            target: tid,
            damage: DAMAGE
          });

          if (t.health <= 0) {
            t.alive = false;
            t.health = 0;

            // Broadcast kill event
            broadcast({
              type: "kill",
              killer: id,
              victim: tid
            });

            setTimeout(() => {
              t.health = 100;
              t.alive = true;
              t.x = t.team === "RED" ? -40 : 40;
              t.z = 0;
              t.y = 0;
            }, RESPAWN_TIME);
          }
        }
      }
      
      // Send shoot event even if no hit (for visual effects)
      broadcast({
        type: "shoot",
        shooter: id,
        hit: hitSomeone
      });
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

setInterval(() => {
  broadcast({ type: "state", players });
}, 50);
