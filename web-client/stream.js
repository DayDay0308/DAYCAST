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

// Connect button
connectBtn.addEventListener('click', () => {
  const pin = pinInput.value.trim();

  if (pin.length !== 6) {
    errorMsg.textContent = 'Please enter a 6-digit PIN';
    return;
  }

  errorMsg.textContent = '';
  connectBtn.textContent = 'Connecting...';

  ws = new WebSocket('ws://localhost:8080');

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'browser-auth', pin }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'auth-success') {
      loginScreen.classList.add('hidden');
      castScreen.classList.remove('hidden');
    }

    if (data.type === 'auth-failed') {
      errorMsg.textContent = '❌ Wrong PIN. Try again.';
      connectBtn.textContent = 'Connect';
      ws.close();
    }

    if (data.type === 'phone-online') {
      phoneStatus.textContent = '🟢 Phone Connected';
      phoneStatus.classList.add('online');
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
    }

    if (data.type === 'control') {
      // Control events handled here in Phase 4
    }
  };

  ws.onclose = () => {
    connectBtn.textContent = 'Connect';
  };
};

// Disconnect button
disconnectBtn.addEventListener('click', () => {
  if (ws) ws.close();
  castScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  pinInput.value = '';
});