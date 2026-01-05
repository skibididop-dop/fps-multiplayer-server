const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 8080;
const RESPAWN_TIME = 3000;
const DAMAGE = 25;
const SHOOT_RANGE = 50;
const SHOOT_ANGLE = 0.5; // ~29 degrees
const TICK_RATE = 50; // ms between state broadcasts
const MAX_SPEED = 10; // units per second
const MESSAGE_RATE_LIMIT = 100; // max messages per second per client
const MAX_MESSAGE_SIZE = 1024; // bytes

const wss = new WebSocket.Server({
  port: PORT,
  host: "0.0.0.0",
  verifyClient: (info) => {
    // Basic origin check
    const origin = info.origin || info.req.headers.origin;
    // In production, add your allowed origins here
    // For now, allow all for development
    return true;
  }
});

console.log(`✅ FPS server running on ws://0.0.0.0:${PORT}`);

const players = {};
const respawnTimers = {};
const clientMessageCount = new Map(); // For rate limiting

function uid() {
  return crypto.randomUUID();
}

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN && c.id !== excludeId) {
      c.send(msg);
    }
  });
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// Rate limiting helper
function checkRateLimit(clientId) {
  const now = Date.now();
  const data = clientMessageCount.get(clientId) || { count: 0, windowStart: now };
  
  // Reset window if 1 second has passed
  if (now - data.windowStart > 1000) {
    data.count = 0;
    data.windowStart = now;
  }
  
  data.count++;
  clientMessageCount.set(clientId, data);
  
  return data.count <= MESSAGE_RATE_LIMIT;
}

// Validate message
function validateMessage(msg, maxSize) {
  const msgStr = JSON.stringify(msg);
  if (msgStr.length > maxSize) {
    return { valid: false, error: "Message too large" };
  }
  return { valid: true };
}

function cleanupPlayer(id) {
  const player = players[id];
  const team = player?.team;
  
  // Clear any pending respawn timer
  if (respawnTimers[id]) {
    clearTimeout(respawnTimers[id]);
    delete respawnTimers[id];
  }
  
  // Remove player
  delete players[id];
  
  // Broadcast player left
  broadcast({ type: "player_left", id });
  
  // Broadcast system message if player was on a team
  if (team) {
    broadcast({
      type: "system",
      message: `A player from ${team} team left the game`
    });
  }
  
  console.log(`❌ Player ${id} disconnected. ${Object.keys(players).length} players online.`);
}

wss.on("connection", ws => {
  const id = uid();
  ws.id = id;

  players[id] = {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    health: 100,
    team: null,
    alive: false, // Start as not alive until team is joined
    lastMoveTime: Date.now(), // For movement validation
    lastX: 0,
    lastZ: 0
  };

  console.log(`✅ Player ${id} connected. ${Object.keys(players).length} players online.`);

  // Send init with player's ID
  ws.send(JSON.stringify({ type: "init", id }));

  // Send current game state to new player
  ws.send(JSON.stringify({ type: "state", players }));

  ws.on("message", raw => {
    // Rate limiting check
    if (!checkRateLimit(id)) {
      console.warn(`⚠️ Rate limit exceeded for ${id}`);
      return;
    }
    
    // Message size check
    if (raw.length > MAX_MESSAGE_SIZE) {
      console.warn(`⚠️ Message too large from ${id}: ${raw.length} bytes`);
      return;
    }
    
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.error(`Invalid JSON from ${id}:`, e);
      return;
    }

    const p = players[id];
    if (!p) return;

    // JOIN TEAM
    if (msg.type === "join") {
      if (!msg.team || (msg.team !== "RED" && msg.team !== "BLUE")) {
        console.error(`Invalid team from ${id}:`, msg.team);
        return;
      }

      p.team = msg.team;
      p.health = 100;
      p.alive = true;
      p.x = msg.team === "RED" ? -40 : 40;
      p.z = 0;
      p.y = 0;
      p.lastX = p.x;
      p.lastZ = p.z;
      p.lastMoveTime = Date.now();

      console.log(`Player ${id} joined ${msg.team} team`);
      
      // Broadcast system message
      broadcast({
        type: "system",
        message: `A player joined ${msg.team} team`
      });
      
      broadcast({ type: "player_joined", id, team: msg.team });
    }

    // MOVE
    if (msg.type === "move") {
      if (!p.alive) return;
      
      // Validate movement data
      if (typeof msg.player?.x !== 'number' || 
          typeof msg.player?.y !== 'number' || 
          typeof msg.player?.z !== 'number' ||
          typeof msg.player?.rot !== 'number') {
        return;
      }
      
      // Validate ranges
      if (!isFinite(msg.player.x) || !isFinite(msg.player.y) || 
          !isFinite(msg.player.z) || !isFinite(msg.player.rot)) {
        return;
      }

      // Time-aware movement validation
      const now = Date.now();
      const deltaTime = (now - p.lastMoveTime) / 1000; // seconds
      
      if (deltaTime > 0) {
        const dx = msg.player.x - p.lastX;
        const dz = msg.player.z - p.lastZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const speed = dist / deltaTime; // units per second
        
        if (speed > MAX_SPEED) {
          console.warn(`⚠️ Player ${id} moving too fast: ${speed.toFixed(2)} units/s (max: ${MAX_SPEED})`);
          return;
        }
        
        // Update tracking
        p.lastMoveTime = now;
        p.lastX = msg.player.x;
        p.lastZ = msg.player.z;
      }

      p.x = msg.player.x;
      p.y = msg.player.y;
      p.z = msg.player.z;
      p.rot = msg.player.rot;

      if (msg.player.camRot !== undefined) {
        p.camRot = msg.player.camRot;
      }
    }

    // SHOOT
    if (msg.type === "shoot") {
      if (!p.alive || !p.team) return;

      let hitSomeone = false;
      let hitTargets = [];

      for (const tid in players) {
        const t = players[tid];
        
        // Skip invalid targets
        if (tid === id || !t.alive || !t.team || t.team === p.team) continue;

        // Calculate distance
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > SHOOT_RANGE) continue;

        // Calculate angle to target
        // Convention: rotation is measured from +Z axis (forward)
        // In Three.js coordinate system: +X = right, +Z = forward (away from camera in default view)
        // Math.atan2(dx, dz) gives angle from +Z axis, which matches player.rotation.y
        const angleToTarget = Math.atan2(dx, dz);
        const shooterAngle = normalizeAngle(p.rot);
        const targetAngle = normalizeAngle(angleToTarget);

        // Calculate angle difference
        let angleDiff = Math.abs(targetAngle - shooterAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        // Check if target is within aiming cone
        if (angleDiff < SHOOT_ANGLE) {
          t.health -= DAMAGE;
          hitSomeone = true;
          hitTargets.push(tid);

          // Broadcast hit event
          broadcast({
            type: "hit",
            shooter: id,
            target: tid,
            damage: DAMAGE,
            targetHealth: t.health
          });

          // Check for kill
          if (t.health <= 0) {
            t.alive = false;
            t.health = 0;

            console.log(`💀 Player ${tid} (${t.team}) eliminated by ${id} (${p.team})`);

            // Broadcast kill event
            broadcast({
              type: "kill",
              killer: id,
              victim: tid
            });

            // Clear any existing respawn timer
            if (respawnTimers[tid]) {
              clearTimeout(respawnTimers[tid]);
            }

            // Set respawn timer
            respawnTimers[tid] = setTimeout(() => {
              const player = players[tid];
              if (player && player.team) {
                player.health = 100;
                player.alive = true;
                player.x = player.team === "RED" ? -40 : 40;
                player.z = 0;
                player.y = 0;
                player.lastX = player.x;
                player.lastZ = player.z;
                player.lastMoveTime = Date.now();

                console.log(`♻️ Player ${tid} respawned`);
                
                broadcast({
                  type: "respawn",
                  id: tid
                });
              }
              delete respawnTimers[tid];
            }, RESPAWN_TIME);
          }
        }
      }

      // Broadcast shoot event
      broadcast({
        type: "shoot",
        shooter: id,
        hit: hitSomeone
      });
    }
    
    // CHAT MESSAGE
    if (msg.type === "chat") {
      if (!p.team || !msg.message) return;
      
      // Validate message type
      if (typeof msg.message !== 'string') return;
      
      // Sanitize message (basic)
      const message = msg.message.substring(0, 100).trim();
      if (!message) return;
      
      // Filter out potentially harmful characters
      const sanitized = message.replace(/[<>]/g, '');
      
      console.log(`💬 [${p.team}] Player ${id}: ${sanitized}`);
      
      // Broadcast to all players
      broadcast({
        type: "chat",
        team: p.team,
        message: sanitized
      });
    }
  });

  ws.on("close", () => {
    cleanupPlayer(id);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${id}:`, error.message);
    cleanupPlayer(id);
  });
});

// Broadcast game state regularly
setInterval(() => {
  if (Object.keys(players).length > 0) {
    broadcast({ type: "state", players });
  }
}, TICK_RATE);

// Handle server shutdown gracefully
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  
  // Clear all respawn timers
  Object.values(respawnTimers).forEach(timer => clearTimeout(timer));
  
  // Close all connections
  wss.clients.forEach(client => {
    client.close();
  });
  
  wss.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

console.log("🎮 Server ready for connections!");
