/* =======================
   GLOBAL STATE
======================= */
let scene, camera, renderer;
let socket;
let socketReady = false;
let playerId = null;
let myTeam = null;
let alive = false;
let isPointerLocked = false;

const keys = {};
const remotePlayers = {};
const bullets = [];
const particles = [];

/* =======================
   PLAYER
======================= */
const player = new THREE.Object3D();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const SPEED = 6;
const GRAVITY = 25;
const HEIGHT = 1.7;
const JUMP_FORCE = 8;

let weaponModel = null;
let onGround = true;

/* =======================
   SHOOTING
======================= */
let canShoot = true;
const SHOOT_COOLDOWN = 500;

/* =======================
   TIME
======================= */
let lastTime = performance.now();
let weaponSwayTime = 0;

/* =======================
   DOM ELEMENTS
======================= */
const hpEl = document.getElementById("hp");
const teamMenu = document.getElementById("teamMenu");
const redBtn = document.getElementById("redBtn");
const blueBtn = document.getElementById("blueBtn");
const crosshair = document.getElementById("crosshair");
const statusEl = document.getElementById("status");

/* =======================
   TEAMS
======================= */
const TEAMS = {
  RED: { color: 0xff4444, spawn: new THREE.Vector3(-40, 0, 0) },
  BLUE: { color: 0x4444ff, spawn: new THREE.Vector3(40, 0, 0) }
};

/* =======================
   SAFE SEND
======================= */
function safeSend(data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("Cannot send - socket not ready");
    return false;
  }
  try {
    socket.send(JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Send error:", e);
    return false;
  }
}

/* =======================
   INIT
======================= */
init();
animate();

function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);
  scene.fog = new THREE.Fog(0x202020, 10, 100);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.y = HEIGHT;

  // Player setup
  player.add(camera);
  scene.add(player);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Create weapon viewmodel
  createWeaponViewModel();

  // Create world
  createWorld();

  // Setup controls and UI
  setupInput();
  setupUI();

  // Connect to server
  setupSocket();

  // Handle window resize
  window.addEventListener("resize", handleResize);
  
  // Handle visibility change
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleVisibilityChange() {
  if (document.hidden) {
    // Clear keys when tab loses focus
    Object.keys(keys).forEach(key => keys[key] = false);
  }
}

/* =======================
   WORLD
======================= */
function createWorld() {
  // Floor
  const floorGeometry = new THREE.BoxGeometry(200, 1, 200);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Obstacles
  for (let i = 0; i < 10; i++) {
    const size = 2 + Math.random() * 2;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    box.position.set(
      (Math.random() - 0.5) * 80,
      size / 2,
      (Math.random() - 0.5) * 80
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
  }
}

/* =======================
   INPUT
======================= */
function setupInput() {
  // Keyboard
  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    
    // Jump
    if (e.code === "Space" && alive && onGround) {
      velocity.y = JUMP_FORCE;
      onGround = false;
    }
    
    // Prevent space from scrolling
    if (e.code === "Space") {
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", e => {
    keys[e.code] = false;
  });

  // Mouse
  window.addEventListener("mousedown", e => {
    if (!alive) return;
    
    if (e.button === 0) {
      // Left click - shoot
      if (isPointerLocked && canShoot) {
        shoot();
      }
    }
  });

  window.addEventListener("mousemove", e => {
    if (!isPointerLocked) return;

    const sensitivity = 0.002;
    player.rotation.y -= e.movementX * sensitivity;
    camera.rotation.x -= e.movementY * sensitivity;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  });

  // Pointer lock
  document.body.addEventListener("click", () => {
    if (myTeam && alive) {
      document.body.requestPointerLock();
    }
  });

  document.addEventListener("pointerlockchange", () => {
    isPointerLocked = document.pointerLockElement === document.body;
    if (!isPointerLocked) {
      // Clear movement keys when losing pointer lock
      Object.keys(keys).forEach(key => keys[key] = false);
    }
  });
}

/* =======================
   UI
======================= */
function setupUI() {
  redBtn.addEventListener("click", () => joinTeam("RED"));
  blueBtn.addEventListener("click", () => joinTeam("BLUE"));
}

function joinTeam(team) {
  if (!socketReady) {
    statusEl.textContent = "Not connected to server!";
    statusEl.style.color = "red";
    return;
  }

  myTeam = team;
  teamMenu.style.display = "none";
  crosshair.style.display = "block";

  if (weaponModel) {
    weaponModel.visible = true;
  }

  spawnPlayer();
  safeSend({ type: "join", team });
}

/* =======================
   SPAWN
======================= */
function spawnPlayer() {
  if (!myTeam || !TEAMS[myTeam]) {
    console.error("Cannot spawn - invalid team:", myTeam);
    return;
  }

  const spawnPos = TEAMS[myTeam].spawn;
  player.position.copy(spawnPos);
  velocity.set(0, 0, 0);
  alive = true;
  onGround = true;
  
  console.log(`Spawned at ${myTeam} base`);
}

/* =======================
   WEAPON VIEWMODEL
======================= */
function createWeaponViewModel() {
  weaponModel = new THREE.Group();

  // Gun body
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.15, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  weaponModel.add(gunBody);

  // Gun barrel
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.05, -0.35);
  weaponModel.add(gunBarrel);

  // Handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.15, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
  );
  handle.position.set(0, -0.15, 0.05);
  weaponModel.add(handle);

  // Magazine
  const magazine = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  magazine.position.set(0, -0.15, -0.05);
  weaponModel.add(magazine);

  // Position weapon in view
  weaponModel.position.set(0.3, -0.3, -0.5);
  weaponModel.rotation.y = -0.1;
  weaponModel.visible = false;

  camera.add(weaponModel);
}

/* =======================
   SHOOTING
======================= */
function shoot() {
  if (!alive || !canShoot) return;

  createBulletTracer();
  createMuzzleFlash();
  safeSend({ type: "shoot" });
  flashCrosshair();
  animateWeaponShoot();

  canShoot = false;
  setTimeout(() => {
    canShoot = true;
  }, SHOOT_COOLDOWN);
}

function animateWeaponShoot() {
  if (!weaponModel) return;

  const originalZ = weaponModel.position.z;
  const originalX = weaponModel.rotation.x;

  weaponModel.position.z += 0.1;
  weaponModel.rotation.x -= 0.1;

  setTimeout(() => {
    weaponModel.position.z = originalZ;
    weaponModel.rotation.x = originalX;
  }, 100);
}

function flashCrosshair() {
  crosshair.style.transform = "translate(-50%, -50%) scale(1.3)";
  crosshair.style.borderColor = "red";

  setTimeout(() => {
    crosshair.style.transform = "translate(-50%, -50%) scale(1)";
    crosshair.style.borderColor = "white";
  }, 100);
}

/* =======================
   BULLET TRACER
======================= */
function createBulletTracer() {
  const start = new THREE.Vector3();
  camera.getWorldPosition(start);

  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));

  const end = start.clone().add(direction.multiplyScalar(50));

  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff00,
    linewidth: 2
  });

  const tracer = new THREE.Line(geometry, material);
  scene.add(tracer);
  bullets.push(tracer);

  setTimeout(() => {
    scene.remove(tracer);
    geometry.dispose();
    material.dispose();
    const index = bullets.indexOf(tracer);
    if (index > -1) bullets.splice(index, 1);
  }, 50);
}

/* =======================
   MUZZLE FLASH
======================= */
function createMuzzleFlash() {
  if (!weaponModel) return;

  const flash = new THREE.PointLight(0xffaa00, 2, 5);
  const flashPos = new THREE.Vector3(0, 0, -0.5);

  weaponModel.localToWorld(flashPos);
  flash.position.copy(flashPos);

  scene.add(flash);

  setTimeout(() => {
    scene.remove(flash);
  }, 50);
}

function createRemoteMuzzleFlash(position) {
  const flash = new THREE.PointLight(0xffaa00, 2, 5);
  flash.position.copy(position);
  flash.position.y += 1.2;
  scene.add(flash);

  setTimeout(() => {
    scene.remove(flash);
  }, 50);
}

/* =======================
   HIT PARTICLES
======================= */
function createHitParticles(position, isKill = false) {
  const particleCount = isKill ? 20 : 10;
  const color = isKill ? 0xff0000 : 0xffff00;

  for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color });
    const particle = new THREE.Mesh(geometry, material);

    particle.position.copy(position);

    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      Math.random() * 5,
      (Math.random() - 0.5) * 5
    );
    particle.userData.createdAt = performance.now();
    particle.userData.lifetime = 1000;
    particle.userData.geometry = geometry;
    particle.userData.material = material;

    scene.add(particle);
    particles.push(particle);
  }
}

function updateParticles(dt) {
  const now = performance.now();

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    const age = now - particle.userData.createdAt;

    if (age > particle.userData.lifetime) {
      scene.remove(particle);
      particle.userData.geometry.dispose();
      particle.userData.material.dispose();
      particles.splice(i, 1);
      continue;
    }

    particle.position.add(
      particle.userData.velocity.clone().multiplyScalar(dt)
    );
    particle.userData.velocity.y -= 9.8 * dt;

    const life = 1 - age / particle.userData.lifetime;
    particle.material.opacity = life;
    particle.material.transparent = true;
    particle.scale.setScalar(life);
  }
}

/* =======================
   FEEDBACK
======================= */
function flashDamage() {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(255, 0, 0, 0.3);
    pointer-events: none;
    z-index: 100;
  `;
  document.body.appendChild(flash);

  setTimeout(() => {
    flash.style.opacity = "0";
    flash.style.transition = "opacity 0.3s";
    setTimeout(() => flash.remove(), 300);
  }, 100);
}

function showHitMarker() {
  const marker = document.createElement("div");
  marker.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    pointer-events: none;
    z-index: 101;
  `;
  marker.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40">
      <line x1="10" y1="10" x2="15" y2="15" stroke="white" stroke-width="3"/>
      <line x1="30" y1="10" x2="25" y2="15" stroke="white" stroke-width="3"/>
      <line x1="10" y1="30" x2="15" y2="25" stroke="white" stroke-width="3"/>
      <line x1="30" y1="30" x2="25" y2="25" stroke="white" stroke-width="3"/>
    </svg>
  `;
  document.body.appendChild(marker);

  setTimeout(() => {
    marker.style.opacity = "0";
    marker.style.transition = "opacity 0.2s";
    setTimeout(() => marker.remove(), 200);
  }, 100);
}

function showKillNotification() {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 32px;
    font-weight: bold;
    text-shadow: 2px 2px 4px black;
    pointer-events: none;
    z-index: 101;
  `;
  notification.textContent = "ELIMINATED";
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.5s";
    setTimeout(() => notification.remove(), 500);
  }, 1000);
}

/* =======================
   PLAYER MODEL
======================= */
function createPlayerModel(teamColor) {
  const playerGroup = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.8, 0.3),
    new THREE.MeshStandardMaterial({ color: teamColor })
  );
  body.position.y = 0.9;
  playerGroup.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffdbac })
  );
  head.position.y = 1.5;
  playerGroup.add(head);

  // Left Arm
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: teamColor })
  );
  leftArm.position.set(-0.45, 0.9, 0);
  playerGroup.add(leftArm);

  // Right Arm
  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: teamColor })
  );
  rightArm.position.set(0.45, 0.9, 0);
  playerGroup.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.7, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
  );
  leftLeg.position.set(-0.15, 0.35, 0);
  playerGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.7, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
  );
  rightLeg.position.set(0.15, 0.35, 0);
  playerGroup.add(rightLeg);

  // Weapon
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  weapon.position.set(0.35, 0.85, 0.4);
  playerGroup.add(weapon);

  return playerGroup;
}

/* =======================
   REMOTE PLAYERS
======================= */
function updateRemotePlayer(id, p) {
  if (!p.team || !TEAMS[p.team]) return;

  if (!remotePlayers[id]) {
    const playerModel = createPlayerModel(TEAMS[p.team].color);
    scene.add(playerModel);
    remotePlayers[id] = playerModel;
  }

  remotePlayers[id].visible = p.alive;
  if (p.alive) {
    remotePlayers[id].position.set(p.x, p.y, p.z);
    remotePlayers[id].rotation.y = p.rot;
  }
}

function cleanupRemotePlayer(id) {
  if (remotePlayers[id]) {
    scene.remove(remotePlayers[id]);
    remotePlayers[id].traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    delete remotePlayers[id];
  }
}

/* =======================
   SOCKET
======================= */
function setupSocket() {
  statusEl.textContent = "Connecting...";
  statusEl.style.color = "yellow";

  const wsUrl =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? `ws://${window.location.hostname}:8080`
      : "wss://fps-multiplayer-server.onrender.com";

  console.log("Connecting to:", wsUrl);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("✅ Connected to server");
    socketReady = true;
    statusEl.textContent = "Connected";
    statusEl.style.color = "lime";
  };

  socket.onmessage = e => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch (err) {
      console.error("Invalid message:", err);
      return;
    }

    if (msg.type === "init") {
      playerId = msg.id;
      console.log("Player ID:", playerId);
    }

    if (msg.type === "state") {
      for (const id in msg.players) {
        const p = msg.players[id];

        if (id === playerId) {
          hpEl.textContent = p.health;

          if (p.alive && !alive) {
            spawnPlayer();
          }

          alive = p.alive;

          if (!p.alive) {
            player.position.y = -100;
            crosshair.style.display = "none";
            if (weaponModel) weaponModel.visible = false;
          } else {
            crosshair.style.display = "block";
            if (weaponModel) weaponModel.visible = true;
          }
        } else {
          updateRemotePlayer(id, p);
        }
      }

      // Clean up disconnected players
      for (const id in remotePlayers) {
        if (!msg.players[id]) {
          cleanupRemotePlayer(id);
        }
      }
    }

    if (msg.type === "hit") {
      if (msg.target === playerId) {
        flashDamage();
      }
      if (msg.shooter === playerId) {
        showHitMarker();
      }

      const target = remotePlayers[msg.target];
      if (target) {
        createHitParticles(target.position.clone());
      }
    }

    if (msg.type === "kill") {
      if (msg.killer === playerId) {
        showKillNotification();
      }

      const victim = remotePlayers[msg.victim];
      if (victim) {
        createHitParticles(victim.position.clone(), true);
      }
    }

    if (msg.type === "shoot") {
      if (msg.shooter !== playerId && remotePlayers[msg.shooter]) {
        createRemoteMuzzleFlash(remotePlayers[msg.shooter].position);
      }
    }

    if (msg.type === "player_left") {
      cleanupRemotePlayer(msg.id);
    }
  };

  socket.onclose = () => {
    socketReady = false;
    statusEl.textContent = "Disconnected";
    statusEl.style.color = "red";
    console.log("❌ Disconnected from server");

    // Try reconnect after 3 seconds
    setTimeout(setupSocket, 3000);
  };

  socket.onerror = err => {
    console.error("WebSocket error:", err);
    statusEl.textContent = "Connection Error";
    statusEl.style.color = "red";
  };
}

/* =======================
   MOVEMENT
======================= */
function move(dt) {
  if (!alive) return;

  direction.set(0, 0, 0);
  if (keys.KeyW) direction.z -= 1;
  if (keys.KeyS) direction.z += 1;
  if (keys.KeyA) direction.x -= 1;
  if (keys.KeyD) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
  }

  velocity.x = direction.x * SPEED;
  velocity.z = direction.z * SPEED;
  velocity.y -= GRAVITY * dt;

  player.position.addScaledVector(velocity, dt);

  // Ground collision
  if (player.position.y < 0) {
    player.position.y = 0;
    velocity.y = 0;
    onGround = true;
  }

  // Send position to server
  if (socketReady) {
    safeSend({
      type: "move",
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rot: player.rotation.y,
        camRot: camera.rotation.x
      }
    });
  }
}

/* =======================
   WEAPON SWAY
======================= */
function updateWeaponSway(dt) {
  if (!weaponModel || !weaponModel.visible) return;

  weaponSwayTime += dt;

  const swayAmount = 0.002;
  const swaySpeed = 1.5;

  weaponModel.rotation.x =
    Math.sin(weaponSwayTime * swaySpeed) * swayAmount;
  weaponModel.rotation.y =
    -0.1 + Math.cos(weaponSwayTime * swaySpeed * 0.7) * swayAmount;

  if (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD) {
    const bobAmount = 0.015;
    const bobSpeed = 10;
    weaponModel.position.y =
      -0.3 + Math.sin(weaponSwayTime * bobSpeed) * bobAmount;
  } else {
    weaponModel.position.y = -0.3;
  }
}

/* =======================
   ANIMATION LOOP
======================= */
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to prevent large jumps
  lastTime = now;

  move(dt);
  updateWeaponSway(dt);
  updateParticles(dt);
  renderer.render(scene, camera);
}

/* =======================
   CLEANUP ON UNLOAD
======================= */
window.addEventListener("beforeunload", () => {
  if (socket) {
    socket.close();
  }
});