const loginScreen = document.getElementById('login-screen');
const castScreen = document.getElementById('cast-screen');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const pinInput = document.getElementById('pin-input');
const errorMsg = document.getElementById('error-msg');
const phoneStatus = document.getElementById('phone-status');
const streamImg = document.getElementById('stream-img');
const placeholder = document.getElementById('placeholder');

let ws = null;
let frameCount = 0;
let lastFpsTime = Date.now();

// Auto fill PIN from server
fetch('/api/pin')
  .then(r => r.json())
  .then(data => {
    pinInput.value = data.pin;
  })
  .catch(() => {});

// Connect button
connectBtn.addEventListener('click', () => {
  const pin = pinInput.value.trim();

  if (pin.length !== 6) {
    errorMsg.textContent = 'Please enter a 6-digit PIN';
    return;
  }

  errorMsg.textContent = '';
  connectBtn.textContent = 'Connecting...';
  connectBtn.disabled = true;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'browser-auth', pin }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'auth-success') {
        loginScreen.classList.add('hidden');
        castScreen.classList.remove('hidden');
        if (data.phoneOnline) {
          phoneStatus.textContent = '🟢 Phone Connected';
          phoneStatus.classList.add('online');
        }
      }

      if (data.type === 'auth-failed') {
        errorMsg.textContent = '❌ Wrong PIN. Try again.';
        connectBtn.textContent = 'Connect';
        connectBtn.disabled = false;
        ws.close();
      }

      if (data.type === 'phone-online') {
        phoneStatus.textContent = '🟢 Phone Connected';
        phoneStatus.classList.add('online');
        placeholder.style.display = 'none';
      }

      if (data.type === 'phone-offline') {
        phoneStatus.textContent = '🔴 Phone Disconnected';
        phoneStatus.classList.remove('online');
        streamImg.style.display = 'none';
        placeholder.style.display = 'flex';
      }

      if (data.type === 'frame') {
        streamImg.src = data.image;
        streamImg.style.display = 'block';
        placeholder.style.display = 'none';

        // FPS counter
        frameCount++;
        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          phoneStatus.textContent = `🟢 Live — ${frameCount} fps`;
          frameCount = 0;
          lastFpsTime = now;
        }
      }

    } catch (err) {
      console.error('Message error:', err);
    }
  };

  ws.onclose = () => {
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
  };

  ws.onerror = () => {
    errorMsg.textContent = '❌ Connection failed. Is server running?';
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
  };
});

// Disconnect button
disconnectBtn.addEventListener('click', () => {
  if (ws) ws.close();
  castScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  pinInput.value = '';
  connectBtn.disabled = false;
});

// Send touch control to phone
function sendControl(action, x, y) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'control', action, x, y }));
  }
}

// Click on stream = tap on phone
streamImg.addEventListener('click', (e) => {
  const rect = streamImg.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  sendControl('tap', x, y);
});