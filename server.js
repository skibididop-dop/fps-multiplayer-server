// ===============================
// FPS MULTIPLAYER SERVER (FINAL)
// ===============================

const WebSocket = require("ws");
const crypto = require("crypto");

// -------------------------------
// CONFIG
// -------------------------------
const PORT = process.env.PORT || 8080;

// -------------------------------
// SERVER
// -------------------------------
const wss = new WebSocket.Server({
  port: PORT,
  host: "0.0.0.0"
});

console.log(`✅ FPS server running on ws://0.0.0.0:${PORT}`);

// -------------------------------
// GAME STATE
// -------------------------------
const players = {};

// -------------------------------
// HELPERS
// -------------------------------
function uid() {
  return crypto.randomUUID();
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// -------------------------------
// CONNECTION
// -------------------------------
wss.on("connection", ws => {
  const id = uid();
  ws.id = id;

  console.log("🟢 Player connected:", id);

  // Create EMPTY player (no team yet)
  players[id] = {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    health: 100,
    score: 0,
    team: null
  };

  // Send init packet
  ws.send(JSON.stringify({
    type: "init",
    id
  }));

  // ---------------------------
  // MESSAGE HANDLER
  // ---------------------------
  ws.on("message", data => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    const p = players[id];
    if (!p) return;

    // -------- JOIN TEAM --------
    if (msg.type === "join") {
      if (msg.team !== "RED" && msg.team !== "BLUE") return;

      p.team = msg.team;
      p.health = 100;

      console.log(`🔵 ${id} joined ${msg.team}`);
    }

    // -------- MOVE --------
    if (msg.type === "move") {
      if (!p.team) return; // ignore until team selected

      p.x = msg.player.x;
      p.y = msg.player.y;
      p.z = msg.player.z;
      p.rot = msg.player.rot;
    }
  });

  // ---------------------------
  // DISCONNECT
  // ---------------------------
  ws.on("close", () => {
    console.log("🔴 Player disconnected:", id);
    delete players[id];
  });
});

// -------------------------------
// GAME LOOP (STATE BROADCAST)
// -------------------------------
setInterval(() => {
  broadcast({
    type: "state",
    players
  });
}, 50); // 20 updates/sec

