# 📱 DAYCAST
> Mirror and control your Android phone from any browser over WiFi

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node.js-v24-green)
![Python](https://img.shields.io/badge/python-3.14-blue)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Windows-lightgrey)

## 🚀 What is DAYCAST?
DAYCAST lets you mirror and fully control your Android phone
from any browser on your laptop — no extra app needed on PC.
Just open your browser, enter your PIN, and you're in.

## ✨ Features
- 📺 Mirror Android screen live in browser
- 🖱️ Full touch & gesture control from laptop
- 🔐 Secure 6-digit PIN authentication
- 📶 Works over WiFi (same network)
- 🌍 Internet support coming in v2.0
- ⚡ Low latency WebSocket streaming

## 🛠️ Tech Stack
| Layer | Technology |
|-------|-----------|
| Android App | Kotlin + MediaProjection API |
| Server | Node.js + Express + WebSocket |
| Browser UI | HTML + CSS + JavaScript |
| Auth | PIN Code (JWT coming in v2.0) |
| Bridge | Python + ADB |

## 📁 Project Structure
\`\`\`
DAYCAST/
├── android-app/     # Kotlin Android app
├── server/          # Node.js WebSocket server
├── web-client/      # Browser UI (HTML/CSS/JS)
├── docs/            # Documentation
└── assets/          # Screenshots & demos
\`\`\`

## 🗺️ Roadmap
- [x] Phase 1 — Project setup + Server + Browser UI
- [ ] Phase 2 — Android app (screen capture)
- [ ] Phase 3 — Live streaming to browser
- [ ] Phase 4 — Touch & gesture control
- [ ] Phase 5 — Internet support + cloud deployment
- [ ] Phase 6 — Email auth + Google OAuth

## 👤 Author
**DayDay0308** — [github.com/DayDay0308](https://github.com/DayDay0308)
