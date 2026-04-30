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
let countdownInterval = null;

// ============ QR CODE ============

function loadQRCode() {
  const qrImage = document.getElementById('qr-image');
  const qrLoading = document.getElementById('qr-loading');
  const qrInfo = document.getElementById('qr-info');

  qrImage.style.display = 'none';
  qrLoading.style.display = 'block';
  qrLoading.textContent = '⏳ Generating QR...';
  if (countdownInterval) clearInterval(countdownInterval);

  fetch('/api/qrcode')
    .then(r => r.json())
    .then(data => {
      qrImage.src = data.qrcode;
      qrImage.style.display = 'block';
      qrLoading.style.display = 'none';
      qrInfo.textContent = `IP: ${data.ip} | PIN: ${data.pin}`;
      if (pinInput) pinInput.value = data.pin;
      if (data.timeLeft) startCountdown(data.timeLeft, qrInfo, data);
    })
    .catch(() => {
      qrLoading.textContent = '❌ Failed to load QR';
    });
}

// QR Countdown timer
function startCountdown(seconds, qrInfo, data) {
  if (countdownInterval) clearInterval(countdownInterval);
  let timeLeft = seconds;

  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      loadQRCode();
    } else {
      qrInfo.textContent = `IP: ${data.ip} | PIN: ${data.pin} | ⏱️ ${timeLeft}s`;
    }
  }, 1000);
}

// Load QR on startup
loadQRCode();

// ============ TAB SWITCHING ============

function switchTab(tab) {
  const qrSection = document.getElementById('qr-section');
  const pinSection = document.getElementById('pin-section');
  const tabQR = document.getElementById('tab-qr');
  const tabPin = document.getElementById('tab-pin');

  if (tab === 'qr') {
    qrSection.classList.remove('hidden');
    pinSection.classList.add('hidden');
    tabQR.classList.add('active');
    tabPin.classList.remove('active');
    loadQRCode();
  } else {
    pinSection.classList.remove('hidden');
    qrSection.classList.add('hidden');
    tabPin.classList.add('active');
    tabQR.classList.remove('active');

    fetch('/api/pin')
      .then(r => r.json())
      .then(data => { if (pinInput) pinInput.value = data.pin; })
      .catch(() => {});
  }
}

// ============ CONNECTION ============

function connectWithPin(pin) {
  if (!pin || pin.length !== 6) {
    if (errorMsg) errorMsg.textContent = 'Invalid PIN';
    return;
  }

  if (connectBtn) {
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
  }

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
        if (errorMsg) errorMsg.textContent = '❌ Wrong PIN. Try again.';
        if (connectBtn) {
          connectBtn.textContent = 'Connect';
          connectBtn.disabled = false;
        }
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

        frameCount++;
        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          phoneStatus.textContent = `🟢 Live — ${frameCount} fps`;
          frameCount = 0;
          lastFpsTime = now;
        }
      }

      // PIN refreshed — reload QR
      if (data.type === 'pin-refresh') {
        loadQRCode();
        console.log('🔄 QR Code refreshed');
      }

      // Session expired
      if (data.type === 'session-expired') {
        alert('⏰ Session expired after 30 minutes. Please reconnect.');
        castScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loadQRCode();
      }

    } catch (err) {
      console.error('Message error:', err);
    }
  };

  ws.onclose = () => {
    if (connectBtn) {
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = false;
    }
  };

  ws.onerror = () => {
    if (errorMsg) errorMsg.textContent = '❌ Connection failed. Is server running?';
    if (connectBtn) {
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = false;
    }
  };
}

// Manual connect button
if (connectBtn) {
  connectBtn.addEventListener('click', () => {
    const pin = pinInput.value.trim();
    connectWithPin(pin);
  });
}

// Disconnect button
if (disconnectBtn) {
  disconnectBtn.addEventListener('click', () => {
    if (ws) ws.close();
    castScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    if (pinInput) pinInput.value = '';
    if (connectBtn) connectBtn.disabled = false;
    loadQRCode();
  });
}

// ============ TOUCH CONTROL ============

function sendControl(action, x, y, x2 = 0, y2 = 0) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'control', action, x, y, x2, y2 }));
  }
}

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;

// Mouse events
streamImg.addEventListener('mousedown', (e) => {
  const rect = streamImg.getBoundingClientRect();
  touchStartX = (e.clientX - rect.left) / rect.width;
  touchStartY = (e.clientY - rect.top) / rect.height;
  touchStartTime = Date.now();
  isDragging = false;
});

streamImg.addEventListener('mousemove', (e) => {
  if (e.buttons === 1) isDragging = true;
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
});

// Touch events
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

// ============ FEEDBACK & KEYBOARD ============

function showControlFeedback(text) {
  const badge = document.getElementById('phone-status');
  const original = badge.textContent;
  badge.textContent = text;
  setTimeout(() => { badge.textContent = original; }, 800);
}

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