const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Get local IP address automatically
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

// Serve from public folder (Railway) or web-client (local)
const publicPath = path.join(__dirname, 'public');
const webClientPath = path.join(__dirname, '../web-client');

app.use(express.static(publicPath));
app.use(express.static(webClientPath));

app.get('/', (req, res) => {
  const railwayIndex = path.join(__dirname, 'public/index.html');
  const localIndex = path.join(__dirname, '../web-client/index.html');
  if (fs.existsSync(railwayIndex)) {
    res.sendFile(railwayIndex);
  } else {
    res.sendFile(localIndex);
  }
});

// Smart connect page
app.get('/connect', (req, res) => {
  const pin = req.query.pin || '';
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAYCAST — Connecting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: white;
      font-family: 'Segoe UI', sans-serif;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: #111;
      border: 1px solid #222;
      border-radius: 24px;
      padding: 40px 32px;
      width: 100%;
      max-width: 380px;
    }
    .logo { font-size: 3rem; margin-bottom: 12px; }
    h1 {
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: 4px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .status {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 32px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 12px;
      text-decoration: none;
      text-align: center;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
    .btn-secondary {
      background: #1a1a1a;
      border: 1px solid #333;
      color: #aaa;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      margin-bottom: 24px;
    }
    .badge-view { background: #1a1a1a; border: 1px solid #333; color: #aaa; }
    .badge-full { background: #1a2a1a; border: 1px solid #22c55e; color: #22c55e; }
    .divider { border: none; border-top: 1px solid #222; margin: 16px 0; }
    .install-hint { font-size: 0.8rem; color: #444; margin-top: 8px; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #222;
      border-top: 3px solid #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">📱</div>
    <h1>DAYCAST</h1>
    <div class="spinner" id="spinner"></div>
    <p class="status" id="status">Checking for DAYCAST app...</p>

    <!-- App installed section -->
    <div id="app-section" style="display:none">
      <span class="badge badge-full">✅ Full Control Mode</span>
      <p style="color:#666; font-size:0.85rem; margin-bottom:24px;">
        DAYCAST app detected! You have full screen control.
      </p>
      <a class="btn btn-primary" id="open-app-btn" href="#">
        🚀 Open DAYCAST App
      </a>
      <a class="btn btn-secondary" href="/?pin=${pin}">
        🌐 Open in Browser Instead
      </a>
    </div>

    <!-- No app section -->
    <div id="browser-section" style="display:none">
      <span class="badge badge-view">👁️ View Only Mode</span>
      <p style="color:#666; font-size:0.85rem; margin-bottom:24px;">
        Install the DAYCAST app for full touch control.
      </p>
      <a class="btn btn-primary" href="/?pin=${pin}">
        👁️ Continue Viewing
      </a>
      <hr class="divider">
      <a class="btn btn-secondary" href="https://github.com/DayDay0308/DAYCAST" target="_blank">
        📥 Get DAYCAST App
      </a>
      <p class="install-hint">Install app for tap, swipe & full control</p>
    </div>
  </div>

  <script>
    const pin = '${pin}';
    const host = window.location.hostname;
    const deepLink = 'daycast://connect?ip=' + host + '&pin=' + pin + '&port=443';

    document.getElementById('open-app-btn').href = deepLink;

    let appOpened = false;

    // Try to open app via hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLink;
    document.body.appendChild(iframe);

    // Detect if app opened
    window.addEventListener('blur', () => {
      appOpened = true;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) appOpened = true;
    });

    // Check after 1.5 seconds
    setTimeout(() => {
      document.getElementById('spinner').style.display = 'none';

      if (appOpened) {
        document.getElementById('status').textContent = '✅ DAYCAST app opened!';
        document.getElementById('app-section').style.display = 'block';
      } else {
        document.getElementById('status').textContent = '📱 App not found — switching to browser mode';
        document.getElementById('browser-section').style.display = 'block';

        // Auto redirect to browser after 2 seconds
        setTimeout(() => {
          window.location.href = '/?pin=' + pin;
        }, 2000);
      }
    }, 1500);
  </script>
</body>
</html>
  `);
});

// Connected clients
let phoneClient = null;
let browserClients = [];

// Generate 6 digit PIN
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let currentPIN = generatePIN();
let pinExpiry = Date.now() + 60000;

console.log(`\n🔐 ========================`);
console.log(`   DAYCAST SERVER RUNNING`);
console.log(`   IP:  ${LOCAL_IP}`);
console.log(`   PIN: ${currentPIN}`);
console.log(`🔐 ========================\n`);

// Auto regenerate PIN every 60 seconds
setInterval(() => {
  currentPIN = generatePIN();
  pinExpiry = Date.now() + 60000;
  console.log(`🔄 PIN refreshed: ${currentPIN}`);
  browserClients.forEach(b => {
    if (b.readyState === WebSocket.OPEN) {
      b.send(JSON.stringify({ type: 'pin-refresh', pin: currentPIN }));
    }
  });
}, 60000);

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    phoneConnected: phoneClient !== null,
    browserCount: browserClients.length,
    ip: LOCAL_IP,
    pin: currentPIN
  });
});

app.get('/api/pin', (req, res) => {
  res.json({ pin: currentPIN, ip: LOCAL_IP });
});

// QR Code endpoint
app.get('/api/qrcode', async (req, res) => {
  try {
    const timeLeft = Math.max(0, Math.floor((pinExpiry - Date.now()) / 1000));
    const isCloud = process.env.RAILWAY_ENVIRONMENT !== undefined;
    const serverUrl = isCloud
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || LOCAL_IP}`
      : `http://${LOCAL_IP}:3000`;
    const connectionData = `${serverUrl}/connect?pin=${currentPIN}`;

    const qrDataUrl = await QRCode.toDataURL(connectionData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#6366F1',
        light: '#0a0a0a'
      }
    });
    res.json({ qrcode: qrDataUrl, ip: LOCAL_IP, pin: currentPIN, timeLeft });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// WebSocket handler
wss.on('connection', (ws) => {
  console.log('🔌 New connection');

  const sessionTimeout = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'session-expired',
        message: 'Session expired after 30 minutes'
      }));
      ws.close();
      console.log('⏰ Session expired');
    }
  }, 30 * 60 * 1000);

  ws.on('message', (message, isBinary) => {
    try {
      if (isBinary) {
        if (ws.role === 'phone') {
          browserClients.forEach(b => {
            if (b.readyState === WebSocket.OPEN) {
              b.send(message, { binary: true });
            }
          });
        }
        return;
      }

      const data = JSON.parse(message.toString());

      if (data.type === 'phone-auth') {
        if (data.pin === currentPIN) {
          phoneClient = ws;
          ws.role = 'phone';
          ws.send(JSON.stringify({ type: 'auth-success', message: 'Phone authenticated!' }));
          console.log('📱 Phone connected!');
          browserClients.forEach(b => {
            if (b.readyState === WebSocket.OPEN) {
              b.send(JSON.stringify({ type: 'phone-online' }));
            }
          });
        } else {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Wrong PIN' }));
        }
      }

      if (data.type === 'browser-auth') {
        if (data.pin === currentPIN) {
          browserClients.push(ws);
          ws.role = 'browser';
          ws.send(JSON.stringify({
            type: 'auth-success',
            message: 'Browser authenticated!',
            phoneOnline: phoneClient !== null
          }));
          console.log('🌐 Browser connected!');
          if (phoneClient !== null) {
            ws.send(JSON.stringify({ type: 'phone-online' }));
          }
        } else {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Wrong PIN' }));
        }
      }

      if (data.type === 'frame' && ws.role === 'phone') {
        browserClients.forEach(b => {
          if (b.readyState === WebSocket.OPEN) {
            b.send(JSON.stringify({ type: 'frame', image: data.image }));
          }
        });
      }

      if (data.type === 'control' && ws.role === 'browser') {
        if (phoneClient && phoneClient.readyState === WebSocket.OPEN) {
          phoneClient.send(JSON.stringify(data));
          console.log(`🖱️ Control: ${data.action}`);
        }
      }

    } catch (err) {
      console.error('❌ Message error:', err.message);
    }
  });

  ws.on('close', () => {
    clearTimeout(sessionTimeout);
    if (ws.role === 'phone') {
      phoneClient = null;
      console.log('📱 Phone disconnected');
      browserClients.forEach(b => {
        if (b.readyState === WebSocket.OPEN) {
          b.send(JSON.stringify({ type: 'phone-offline' }));
        }
      });
    }
    if (ws.role === 'browser') {
      browserClients = browserClients.filter(b => b !== ws);
      console.log('🌐 Browser disconnected');
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DAYCAST running at http://localhost:${PORT}`);
  console.log(`🚀 Network access: http://${LOCAL_IP}:${PORT}`);
});