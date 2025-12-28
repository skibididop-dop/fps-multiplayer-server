const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
console.log("✅ FPS server running on ws://localhost:8080");

const players = {};
const flags = {
  RED: { x: -40, y: 1, z: 0, holder: null },
  BLUE: { x: 40, y: 1, z: 0, holder: null }
};

let nextId = 1;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(msg);
  });
}

wss.on("connection", ws => {
  const id = String(nextId++);
  players[id] = {
    id,
    x: 0, y: 0, z: 0,
    rot: 0,
    team: null,
    health: 100,
    score: 0
  };

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "join") {
      players[id].team = data.team;
      return;
    }

    if (data.type === "move") {
      Object.assign(players[id], data.player);
      return;
    }

    if (data.type === "shoot") {
      handleShoot(id, data);
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

function handleShoot(shooterId, data) {
  const shooter = players[shooterId];
  if (!shooter) return;

  for (const id in players) {
    const p = players[id];
    if (p.team === shooter.team || p.health <= 0) continue;

    const dx = p.x - shooter.x;
    const dz = p.z - shooter.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist < 5) {
      p.health -= 25;
      if (p.health <= 0) {
        shooter.score += 1;
        p.health = 100;
        p.x = p.team === "RED" ? -40 : 40;
        p.z = 0;
      }
    }
  }
}

setInterval(() => {
  broadcast({
    type: "state",
    players,
    flags
  });
}, 50);
