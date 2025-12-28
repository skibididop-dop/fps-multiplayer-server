<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FPS Map - Top Down View</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: #1a1a2e;
      color: white;
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      min-height: 100vh;
    }
    
    h1 {
      margin-bottom: 10px;
      font-size: 32px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }
    
    .subtitle {
      margin-bottom: 30px;
      opacity: 0.7;
      font-size: 14px;
    }
    
    .map-container {
      position: relative;
      width: 800px;
      height: 800px;
      background: #2a2a3e;
      border: 4px solid #555;
      box-shadow: 0 0 30px rgba(0,0,0,0.5);
    }
    
    .grid {
      position: absolute;
      inset: 0;
      background-image: 
        repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(255,255,255,0.05) 79px, rgba(255,255,255,0.05) 80px),
        repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(255,255,255,0.05) 79px, rgba(255,255,255,0.05) 80px);
    }
    
    .element {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      border: 2px solid;
      transform: translate(-50%, -50%);
    }
    
    .red-base {
      background: rgba(255, 68, 68, 0.3);
      border-color: #ff4444;
      width: 120px;
      height: 120px;
      left: 20%;
      top: 50%;
    }
    
    .blue-base {
      background: rgba(68, 68, 255, 0.3);
      border-color: #4444ff;
      width: 120px;
      height: 120px;
      left: 80%;
      top: 50%;
    }
    
    .center-tower {
      background: rgba(128, 128, 128, 0.4);
      border-color: #888;
      border-radius: 50%;
      width: 80px;
      height: 80px;
      left: 50%;
      top: 50%;
    }
    
    .cover {
      background: rgba(102, 102, 102, 0.6);
      border-color: #666;
      width: 30px;
      height: 30px;
    }
    
    .platform {
      background: rgba(74, 74, 74, 0.5);
      border-color: #4a4a4a;
      border-style: dashed;
      width: 64px;
      height: 32px;
      font-size: 8px;
    }
    
    .pillar {
      background: rgba(122, 122, 122, 0.5);
      border-color: #7a7a7a;
      border-radius: 50%;
      width: 16px;
      height: 16px;
    }
    
    .trench {
      background: rgba(85, 85, 85, 0.4);
      border-color: #555;
      border-style: dotted;
      height: 160px;
      width: 24px;
      font-size: 8px;
    }
    
    .wall {
      background: rgba(85, 85, 85, 0.8);
      border: none;
    }
    
    .wall.horizontal {
      width: 800px;
      height: 16px;
      left: 50%;
    }
    
    .wall.vertical {
      width: 16px;
      height: 800px;
      top: 50%;
    }
    
    .crate-cluster {
      background: rgba(102, 102, 102, 0.4);
      border-color: #666;
      border-style: solid;
      width: 40px;
      height: 40px;
      font-size: 8px;
    }
    
    .legend {
      margin-top: 30px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      width: 800px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    }
    
    .legend-box {
      width: 30px;
      height: 30px;
      border: 2px solid;
      flex-shrink: 0;
    }
    
    .stats {
      margin-top: 20px;
      padding: 20px;
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      width: 800px;
    }
    
    .stats h3 {
      margin-bottom: 10px;
    }
    
    .stats ul {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px;
    }
    
    .stats li {
      padding: 5px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>🗺️ FPS MULTIPLAYER MAP</h1>
  <div class="subtitle">Top-Down View (100x100 units)</div>
  
  <div class="map-container">
    <div class="grid"></div>
    
    <!-- Walls -->
    <div class="element wall horizontal" style="top: 1%;"></div>
    <div class="element wall horizontal" style="top: 99%;"></div>
    <div class="element wall vertical" style="left: 1%;"></div>
    <div class="element wall vertical" style="left: 99%;"></div>
    
    <!-- Bases -->
    <div class="element red-base">RED<br>BASE<br>SPAWN</div>
    <div class="element blue-base">BLUE<br>BASE<br>SPAWN</div>
    
    <!-- Center Tower -->
    <div class="element center-tower">CENTER<br>TOWER</div>
    
    <!-- Platforms -->
    <div class="element platform" style="left: 30%; top: 30%;">PLATFORM</div>
    <div class="element platform" style="left: 30%; top: 70%;">PLATFORM</div>
    <div class="element platform" style="left: 70%; top: 30%;">PLATFORM</div>
    <div class="element platform" style="left: 70%; top: 70%;">PLATFORM</div>
    
    <!-- Pillars -->
    <div class="element pillar" style="left: 35%; top: 20%;"></div>
    <div class="element pillar" style="left: 65%; top: 20%;"></div>
    <div class="element pillar" style="left: 35%; top: 80%;"></div>
    <div class="element pillar" style="left: 65%; top: 80%;"></div>
    <div class="element pillar" style="left: 40%; top: 50%;"></div>
    <div class="element pillar" style="left: 60%; top: 50%;"></div>
    
    <!-- Trenches -->
    <div class="element trench" style="left: 35%; top: 50%;">TRENCH</div>
    <div class="element trench" style="left: 65%; top: 50%;">TRENCH</div>
    
    <!-- Cover Positions -->
    <div class="element cover" style="left: 30%; top: 35%;"></div>
    <div class="element cover" style="left: 30%; top: 65%;"></div>
    <div class="element cover" style="left: 30%; top: 25%;"></div>
    <div class="element cover" style="left: 30%; top: 75%;"></div>
    
    <div class="element cover" style="left: 70%; top: 35%;"></div>
    <div class="element cover" style="left: 70%; top: 65%;"></div>
    <div class="element cover" style="left: 70%; top: 25%;"></div>
    <div class="element cover" style="left: 70%; top: 75%;"></div>
    
    <div class="element cover" style="left: 40%; top: 30%;"></div>
    <div class="element cover" style="left: 40%; top: 70%;"></div>
    <div class="element cover" style="left: 60%; top: 30%;"></div>
    <div class="element cover" style="left: 60%; top: 70%;"></div>
    
    <div class="element cover" style="left: 15%; top: 15%;"></div>
    <div class="element cover" style="left: 15%; top: 85%;"></div>
    <div class="element cover" style="left: 85%; top: 15%;"></div>
    <div class="element cover" style="left: 85%; top: 85%;"></div>
    
    <!-- Crate Clusters -->
    <div class="element crate-cluster" style="left: 38%; top: 42%;">CRATES</div>
    <div class="element crate-cluster" style="left: 38%; top: 58%;">CRATES</div>
    <div class="element crate-cluster" style="left: 62%; top: 42%;">CRATES</div>
    <div class="element crate-cluster" style="left: 62%; top: 58%;">CRATES</div>
  </div>
  
  <div class="legend">
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(255,68,68,0.3); border-color: #ff4444;"></div>
      <span>Red Base</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(68,68,255,0.3); border-color: #4444ff;"></div>
      <span>Blue Base</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(128,128,128,0.4); border-color: #888; border-radius: 50%;"></div>
      <span>Center Tower</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(102,102,102,0.6); border-color: #666;"></div>
      <span>Cover</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(74,74,74,0.5); border-color: #4a4a4a; border-style: dashed;"></div>
      <span>Platform (+2m)</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(85,85,85,0.4); border-color: #555; border-style: dotted;"></div>
      <span>Trench (-1m)</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(122,122,122,0.5); border-color: #7a7a7a; border-radius: 50%;"></div>
      <span>Pillar</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(102,102,102,0.4); border-color: #666;"></div>
      <span>Crates</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: rgba(85,85,85,0.8);"></div>
      <span>Boundary Wall</span>
    </div>
  </div>
  
  <div class="stats">
    <h3>📊 Map Statistics</h3>
    <ul>
      <li>🗺️ <strong>Map Size:</strong> 100x100 units</li>
      <li>🎯 <strong>Spawn Points:</strong> 2 (Red & Blue)</li>
      <li>🏰 <strong>Center Structure:</strong> 1 tower</li>
      <li>🛡️ <strong>Cover Points:</strong> 16 positions</li>
      <li>📦 <strong>Crate Clusters:</strong> 4 groups</li>
      <li>🏢 <strong>Platforms:</strong> 4 elevated</li>
      <li>🏛️ <strong>Pillars:</strong> 6 columns</li>
      <li>🏊 <strong>Trenches:</strong> 2 defensive</li>
      <li>🔫 <strong>Max Range:</strong> 50 units</li>
      <li>👥 <strong>Symmetrical:</strong> Yes (mirrored)</li>
    </ul>
  </div>
  
  <div class="stats" style="margin-top: 15px;">
    <h3>💡 Quick Tips</h3>
    <ul style="grid-template-columns: 1fr;">
      <li>🎯 <strong>Center Control:</strong> Tower = map control</li>
      <li>⬆️ <strong>Height Advantage:</strong> Platforms overlook center</li>
      <li>🛡️ <strong>Safe Retreat:</strong> Trenches provide cover</li>
      <li>↔️ <strong>Flank Routes:</strong> Use sides to surprise enemies</li>
      <li>🤝 <strong>Team Play:</strong> Cover multiple lanes together</li>
    </ul>
  </div>
</body>
</html>
