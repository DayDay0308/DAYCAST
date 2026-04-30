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

// Send control to phone
function sendControl(action, x, y, x2 = 0, y2 = 0) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'control', action, x, y, x2, y2 }));
  }
}

// Track touch/mouse for swipe detection
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;

// ============ MOUSE EVENTS (Laptop) ============

streamImg.addEventListener('mousedown', (e) => {
  const rect = streamImg.getBoundingClientRect();
  touchStartX = (e.clientX - rect.left) / rect.width;
  touchStartY = (e.clientY - rect.top) / rect.height;
  touchStartTime = Date.now();
  isDragging = false;
});

streamImg.addEventListener('mousemove', (e) => {
  if (e.buttons === 1) {
    isDragging = true;
  }
});

streamImg.addEventListener('mouseup', (e) => {
  const rect = streamImg.getBoundingClientRect();
  const endX = (e.clientX - rect.left) / rect.width;
  const endY = (e.clientY - rect.top) / rect.height;
  const duration = Date.now() - touchStartTime;

  const distX = Math.abs(endX - touchStartX);
  const distY = Math.abs(endY - touchStartY);
  const moved = distX > 0.05 || distY > 0.05;

  if (moved && isDragging) {
    console.log(`🔄 Swipe: (${touchStartX.toFixed(2)}, ${touchStartY.toFixed(2)}) → (${endX.toFixed(2)}, ${endY.toFixed(2)})`);
    sendControl('swipe', touchStartX, touchStartY, endX, endY);
    showControlFeedback('↔️ Swipe');
  } else if (duration > 600) {
    console.log(`👆 Long press at (${touchStartX.toFixed(2)}, ${touchStartY.toFixed(2)})`);
    sendControl('longpress', touchStartX, touchStartY);
    showControlFeedback('👆 Long Press');
  } else {
    console.log(`👆 Tap at (${touchStartX.toFixed(2)}, ${touchStartY.toFixed(2)})`);
    sendControl('tap', touchStartX, touchStartY);
    showControlFeedback('👆 Tap');
  }

  isDragging = false;
});

// ============ TOUCH EVENTS (Mobile/Tablet) ============

streamImg.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = streamImg.getBoundingClientRect();
  touchStartX = (touch.clientX - rect.left) / rect.width;
  touchStartY = (touch.clientY - rect.top) / rect.height;
  touchStartTime = Date.now();
  isDragging = false;
}, { passive: false });

streamImg.addEventListener('touchmove', (e) => {
  e.preventDefault();
  isDragging = true;
}, { passive: false });

streamImg.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const rect = streamImg.getBoundingClientRect();
  const endX = (touch.clientX - rect.left) / rect.width;
  const endY = (touch.clientY - rect.top) / rect.height;
  const duration = Date.now() - touchStartTime;

  const distX = Math.abs(endX - touchStartX);
  const distY = Math.abs(endY - touchStartY);
  const moved = distX > 0.05 || distY > 0.05;

  if (moved && isDragging) {
    console.log(`🔄 Touch Swipe: (${touchStartX.toFixed(2)}, ${touchStartY.toFixed(2)}) → (${endX.toFixed(2)}, ${endY.toFixed(2)})`);
    sendControl('swipe', touchStartX, touchStartY, endX, endY);
    showControlFeedback('↔️ Swipe');
  } else if (duration > 600) {
    sendControl('longpress', touchStartX, touchStartY);
    showControlFeedback('👆 Long Press');
  } else {
    sendControl('tap', touchStartX, touchStartY);
    showControlFeedback('👆 Tap');
  }

  isDragging = false;
}, { passive: false });

// ============ VISUAL FEEDBACK ============

function showControlFeedback(text) {
  const badge = document.getElementById('phone-status');
  const original = badge.textContent;
  badge.textContent = text;
  setTimeout(() => { badge.textContent = original; }, 800);
}

// ============ KEYBOARD SHORTCUTS ============

document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'Escape':
      sendControl('tap', 0.05, 0.97);
      showControlFeedback('⬅️ Back');
      break;
    case 'Home':
      sendControl('tap', 0.5, 0.97);
      showControlFeedback('🏠 Home');
      break;
  }
});