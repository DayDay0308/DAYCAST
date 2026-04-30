const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve web client
app.use(express.static(path.join(__dirname, '../web-client')));

// Store connected devices
let phoneClient = null;
let browserClients = [];

// Generate a 6 digit PIN for auth
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let currentPIN = generatePIN();
console.log(`🔐 Your DAYCAST PIN is: ${currentPIN}`);

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('✅ New connection established');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Phone connecting
      if (data.type === 'phone-auth') {
        if (data.pin === currentPIN) {
          phoneClient = ws;
          ws.role = 'phone';
          ws.send(JSON.stringify({ type: 'auth-success', message: 'Phone connected!' }));
          console.log('📱 Phone connected successfully');

          // Notify all browsers phone is online
          browserClients.forEach(b => {
            b.send(JSON.stringify({ type: 'phone-online' }));
          });
        } else {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Wrong PIN' }));
          console.log('❌ Wrong PIN attempt');
        }
      }

      // Browser connecting
      if (data.type === 'browser-auth') {
        if (data.pin === currentPIN) {
          browserClients.push(ws);
          ws.role = 'browser';
          ws.send(JSON.stringify({ type: 'auth-success', message: 'Browser connected!' }));
          console.log('🌐 Browser connected successfully');
        } else {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Wrong PIN' }));
        }
      }

      // Stream frame from phone to all browsers
      if (data.type === 'frame' && ws.role === 'phone') {
        browserClients.forEach(b => {
          if (b.readyState === WebSocket.OPEN) {
            b.send(message);
          }
        });
      }

      // Control command from browser to phone
      if (data.type === 'control' && ws.role === 'browser') {
        if (phoneClient && phoneClient.readyState === WebSocket.OPEN) {
          phoneClient.send(message);
        }
      }

    } catch (err) {
      console.error('❌ Message error:', err);
    }
  });

  ws.on('close', () => {
    if (ws.role === 'phone') {
      phoneClient = null;
      console.log('📱 Phone disconnected');
      browserClients.forEach(b => {
        b.send(JSON.stringify({ type: 'phone-offline' }));
      });
    }
    if (ws.role === 'browser') {
      browserClients = browserClients.filter(b => b !== ws);
      console.log('🌐 Browser disconnected');
    }
  });
});

// Health check route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    phoneConnected: phoneClient !== null,
    browserCount: browserClients.length
  });
});

server.listen(8080, () => {
  console.log('🚀 DAYCAST server running at http://localhost:8080');
  console.log(`🔐 PIN: ${currentPIN}`);
});