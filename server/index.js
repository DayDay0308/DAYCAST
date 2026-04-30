const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve web client
app.use(express.static(path.join(__dirname, '../web-client')));

// Connected clients
let phoneClient = null;
let browserClients = [];

// Generate 6 digit PIN
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let currentPIN = generatePIN();
console.log(`\n🔐 ========================`);
console.log(`   DAYCAST SERVER RUNNING`);
console.log(`   PIN: ${currentPIN}`);
console.log(`🔐 ========================\n`);

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    phoneConnected: phoneClient !== null,
    browserCount: browserClients.length,
    pin: currentPIN // Remove this in production!
  });
});

app.get('/api/pin', (req, res) => {
  res.json({ pin: currentPIN });
});

// WebSocket handler
wss.on('connection', (ws) => {
  console.log('🔌 New connection');

  ws.on('message', (message, isBinary) => {
    try {
      // Handle binary data (raw frames)
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

          // Notify browsers
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
          console.log('❌ Wrong PIN from phone');
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
          console.log('❌ Wrong PIN from browser');
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
          console.log(`🖱️ Control: ${data.action} at (${data.x}, ${data.y})`);
        }
      }

    } catch (err) {
      console.error('❌ Message error:', err.message);
    }
  });

  ws.on('close', () => {
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
server.listen(PORT, () => {
  console.log(`🚀 DAYCAST running at http://localhost:${PORT}`);
});