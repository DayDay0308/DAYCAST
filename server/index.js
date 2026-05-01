const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');

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

// Serve web client
// Support both local and Railway deployment
const webClientPath = path.join(__dirname, '../web-client');
const localWebClient = path.join(__dirname, 'public');

app.use(express.static(webClientPath));
app.use(express.static(localWebClient));

// Fallback route
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../web-client/index.html');
  res.sendFile(indexPath);
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
      b.send(JSON.stringify({
        type: 'pin-refresh',
        pin: currentPIN
      }));
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
    const connectionData = `daycast://connect?ip=${LOCAL_IP}&pin=${currentPIN}&port=3000`;

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

  // Auto disconnect after 30 minutes
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

      // Phone authentication
      if (data.type === 'phone-auth') {
        if (data.pin === currentPIN) {
          phoneClient = ws;
          ws.role = 'phone';
          ws.send(JSON.stringify({
            type: 'auth-success',
            message: 'Phone authenticated!'
          }));
          console.log('📱 Phone connected!');
          browserClients.forEach(b => {
            if (b.readyState === WebSocket.OPEN) {
              b.send(JSON.stringify({ type: 'phone-online' }));
            }
          });
        } else {
          ws.send(JSON.stringify({
            type: 'auth-failed',
            message: 'Wrong PIN'
          }));
        }
      }

      // Browser authentication
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
          ws.send(JSON.stringify({
            type: 'auth-failed',
            message: 'Wrong PIN'
          }));
        }
      }

      // Stream frame from phone to browsers
      if (data.type === 'frame' && ws.role === 'phone') {
        browserClients.forEach(b => {
          if (b.readyState === WebSocket.OPEN) {
            b.send(JSON.stringify({
              type: 'frame',
              image: data.image
            }));
          }
        });
      }

      // Control command from browser to phone
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