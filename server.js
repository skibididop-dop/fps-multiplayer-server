const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const RESPAWN_TIME = 3000;
const DAMAGE = 25;
const SHOOT_RANGE = 50; // Maximum shooting range
const SHOOT_ANGLE = 0.5; // Aiming tolerance (radians) - increased for easier hits

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
      
      // Also update camera rotation if provided
      if (msg.player.camRot !== undefined) {
        p.camRot = msg.player.camRot;
      }
    }

    // SHOOT
    if (msg.type === "shoot" && p.alive) {
      let hitSomeone = false;
      let hitTargets = [];
      
      console.log(`\n🔫 Player ${id} (${p.team}) shooting from (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) at angle ${p.rot.toFixed(2)}`);
      
      for (const tid in players) {
        const t = players[tid];
        if (tid === id || !t.alive || !t.team || t.team === p.team) continue;

        // Calculate distance
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        console.log(`  Checking target ${tid} (${t.team}): pos=(${t.x.toFixed(2)}, ${t.z.toFixed(2)}), dist=${dist.toFixed(2)}`);
        
        if (dist > SHOOT_RANGE) {
          console.log(`    ❌ Too far: ${dist.toFixed(2)} > ${SHOOT_RANGE}`);
          continue;
        }

        // Calculate angle to target
        const angleToTarget = Math.atan2(dx, dz);
        
        // Normalize both angles
        const shooterAngle = normalizeAngle(p.rot);
        const targetAngle = normalizeAngle(angleToTarget);
        
        // Calculate angle difference
        let angleDiff = Math.abs(targetAngle - shooterAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        console.log(`    Angles: shooter=${shooterAngle.toFixed(3)}, target=${targetAngle.toFixed(3)}, diff=${angleDiff.toFixed(3)} (threshold=${SHOOT_ANGLE})`);
        
        // Check if target is within aiming cone
        if (angleDiff < SHOOT_ANGLE) {
          t.health -= DAMAGE;
          hitSomeone = true;
          hitTargets.push(tid);
          console.log(`    ✅ HIT! Target ${tid} health: ${t.health}/${100}`);

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
            console.log(`    💀 Player ${tid} eliminated by ${id}`);

            // Broadcast kill event
            broadcast({
              type: "kill",
              killer: id,
              victim: tid
            });

            setTimeout(() => {
              if (players[tid]) {
                t.health = 100;
                t.alive = true;
                t.x = t.team === "RED" ? -40 : 40;
                t.z = 0;
                t.y = 0;
                console.log(`    ♻️ Player ${tid} respawned`);
              }
            }, RESPAWN_TIME);
          }
        } else {
          console.log(`    ❌ Angle too large: ${angleDiff.toFixed(3)} >= ${SHOOT_ANGLE}`);
        }
      }
      
      if (hitSomeone) {
        console.log(`  ✅ Shot hit ${hitTargets.length} target(s): ${hitTargets.join(', ')}`);
      } else {
        console.log(`  ❌ Shot missed all targets`);
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
