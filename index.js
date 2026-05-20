/* =========================================================
   PROFESSIONAL WHATSAPP SERVER (ULTIMATE RENDER SAFE)
   =========================================================

   FEATURES:
   - One-time pairing
   - Persistent session
   - Refresh safe UI
   - Render compatible
   - LINE-BY-LINE sending
   - Prefix support
   - Exact delay timing
   - Persistent frontend logs
   - Restart button
   - Auto reconnect
   - Pair crash auto repair
   - Ghost socket prevention
   - Multi-start protection
   - Memory leak prevention
   - Render RAM optimization
   - Stable reconnect logic
   - Session persistence

========================================================= */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import pino from "pino";

import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason
} from "@whiskeysockets/baileys";

/* ================= SAFETY ================= */

process.on("unhandledRejection", err => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

/* ================= SERVER ================= */

const app = express();

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

/* ================= SESSION ================= */

const SESSION_PATH =
  process.env.SESSION_PATH || "./session";

if (!fs.existsSync(SESSION_PATH)) {

  fs.mkdirSync(SESSION_PATH, {
    recursive: true
  });

}

/* ================= GLOBAL ================= */

let sock = null;

let connectedNumber = "";

let isConnected = false;

let isReconnecting = false;

let restartLock = false;

let stopSending = false;

let sendingActive = false;

let currentLoop = null;

let liveLogs = [];

/* ================= LOGGER ================= */

function pushLog(text) {

  console.log(text);

  liveLogs.push(text);

  if (liveLogs.length > 300) {
    liveLogs.shift();
  }

  io.emit("log", text);
}

/* ================= FULL RESTART ================= */

async function fullRestart(reason = "Manual restart") {

  if (restartLock) {
    return;
  }

  restartLock = true;

  pushLog(`Restarting server: ${reason}`);

  try {

    stopSending = true;

    sendingActive = false;

    if (currentLoop) {
      clearTimeout(currentLoop);
      currentLoop = null;
    }

    if (sock) {

      try {
        sock.ws.close();
      } catch {}

      try {
        sock.end();
      } catch {}

      sock = null;
    }

    isConnected = false;

    isReconnecting = false;

    io.emit("status", "Restarting");

    setTimeout(async () => {

      try {

        await startWhatsApp();

      } catch (e) {

        pushLog(
          "Restart startup failed: " +
          e.message
        );
      }

      restartLock = false;

    }, 5000);

  } catch (err) {

    restartLock = false;

    pushLog(
      "Restart failed: " + err.message
    );
  }
}

/* ================= HTML ================= */

const html = `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8"/>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>WhatsApp Panel</title>

<style>

body{
  background:#0f172a;
  color:white;
  font-family:Segoe UI;
  display:flex;
  justify-content:center;
  padding:20px;
}

.card{
  background:#111827;
  width:100%;
  max-width:700px;
  border-radius:20px;
  padding:20px;
}

input,button{
  width:100%;
  padding:12px;
  margin-top:10px;
  border:none;
  border-radius:10px;
  box-sizing:border-box;
}

input{
  background:#1f2937;
  color:white;
}

button{
  background:#22c55e;
  color:black;
  font-weight:bold;
  cursor:pointer;
}

.stop{
  background:#ef4444;
  color:white;
}

.restart{
  background:#3b82f6;
  color:white;
}

#logs{
  background:black;
  color:#22c55e;
  height:250px;
  overflow:auto;
  padding:10px;
  margin-top:15px;
  border-radius:10px;
  font-family:monospace;
}

.grp{
  background:#1f2937;
  padding:10px;
  margin-top:5px;
  border-radius:10px;
  cursor:pointer;
}

</style>

</head>

<body>

<div class="card">

<h2>WhatsApp Bot Panel</h2>

<div id="status">
Status: Loading...
</div>

<input
  id="phone"
  placeholder="Phone Number (91xxxxxxxxxx)"
/>

<button onclick="pair()">
GET PAIR CODE
</button>

<div id="pairBox"></div>

<h3>Groups</h3>

<div id="groups">
Login required
</div>

<input
  id="target"
  placeholder="Target JID"
/>

<input
  id="prefix"
  placeholder="Prefix / Name"
/>

<input
  id="delay"
  placeholder="Delay in seconds (minimum 10)"
/>

<input
  type="file"
  id="file"
  accept=".txt"
/>

<button onclick="startSend()">
START
</button>

<button
  class="stop"
  onclick="stopSend()"
>
STOP
</button>

<button
  class="restart"
  onclick="restartServer()"
>
RESTART SERVER
</button>

<div id="logs"></div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket = io();

let msgs = "";

socket.on("session", data => {

  if(data.connected){

    status.innerText =
      "Status: Connected";

    pairBox.innerText =
      "Linked: " + data.number;
  }

});

function addLog(text){

  logs.innerHTML +=
    "<div>> " + text + "</div>";

  logs.scrollTop =
    logs.scrollHeight;
}

function pair(){

  const num =
    phone.value.trim();

  if(!num){

    alert("Enter phone number");

    return;
  }

  socket.emit("pair", num);
}

function stopSend(){

  socket.emit("stop");
}

function restartServer(){

  socket.emit("restart");
}

function startSend(){

  socket.emit("start", {

    target:
      target.value.trim(),

    prefix:
      prefix.value.trim(),

    delay:
      delay.value.trim(),

    msgs
  });
}

socket.on("status", s => {

  status.innerText =
    "Status: " + s;
});

socket.on("code", c => {

  pairBox.innerText =
    "Pair Code: " + c;
});

socket.on("log", m => {

  addLog(m);
});

socket.on("groups", arr => {

  groups.innerHTML = "";

  arr.forEach(g => {

    const div =
      document.createElement("div");

    div.className = "grp";

    div.innerText = g.subject;

    div.onclick = () => {

      target.value = g.id;
    };

    groups.appendChild(div);
  });

});

file.onchange = e => {

  const fileObj =
    e.target.files[0];

  if(!fileObj) return;

  const reader =
    new FileReader();

  reader.onload = () => {

    msgs = reader.result || "";

    addLog(
      "Text file loaded successfully"
    );
  };

  reader.readAsText(fileObj);
};

</script>

</body>
</html>
`;

app.get("/", (req, res) => {
  res.send(html);
});

/* ================= WHATSAPP ================= */

async function startWhatsApp() {

  try {

    if (sock) {

      try {
        sock.ws.close();
      } catch {}

      try {
        sock.end();
      } catch {}

      sock = null;
    }

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(
      SESSION_PATH
    );

    const {
      version
    } = await fetchLatestBaileysVersion();

    sock = makeWASocket({

      auth: state,

      version,

      browser:
        Browsers.ubuntu("Chrome"),

      logger:
        pino({
          level: "silent"
        }),

      markOnlineOnConnect: false,

      syncFullHistory: false,

      generateHighQualityLinkPreview: false,

      defaultQueryTimeoutMs: 60000,

      connectTimeoutMs: 60000,

      keepAliveIntervalMs: 10000
    });

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    sock.ev.on(
      "connection.update",
      async update => {

        const {
          connection,
          lastDisconnect
        } = update;

        if (connection === "open") {

          isConnected = true;

          isReconnecting = false;

          connectedNumber =
            sock?.user?.id || "";

          pushLog(
            "WhatsApp Connected"
          );

          io.emit(
            "status",
            "Connected"
          );

          try {

            const groups =
              await sock.groupFetchAllParticipating();

            const list =
              Object.entries(groups).map(
                ([id, g]) => ({
                  id,
                  subject:
                    g.subject || "Unnamed"
                })
              );

            io.emit(
              "groups",
              list
            );

            pushLog(
              `Loaded ${list.length} groups`
            );

          } catch (e) {

            pushLog(
              "Group fetch failed: " +
              e.message
            );
          }
        }

        if (connection === "close") {

          isConnected = false;

          io.emit(
            "status",
            "Disconnected"
          );

          pushLog(
            "Connection closed"
          );

          const code =
            lastDisconnect?.error
              ?.output?.statusCode;

          const shouldReconnect =
            code !== DisconnectReason.loggedOut;

          if (
            shouldReconnect &&
            !isReconnecting
          ) {

            isReconnecting = true;

            io.emit(
              "status",
              "Reconnecting"
            );

            pushLog(
              "Reconnecting in 5 seconds..."
            );

            setTimeout(async () => {

              await fullRestart(
                "Auto reconnect"
              );

            }, 5000);
          }
        }

      }
    );

  } catch (err) {

    pushLog(
      "START ERROR: " +
      err.message
    );

    setTimeout(async () => {

      await fullRestart(
        "Startup failure"
      );

    }, 5000);
  }
}

startWhatsApp();

/* ================= SOCKET ================= */

io.on("connection", socket => {

  socket.emit("session", {
    connected: isConnected,
    number: connectedNumber
  });

  liveLogs.forEach(log => {
    socket.emit("log", log);
  });

  socket.emit(
    "status",

    isConnected
      ? "Connected"
      : isReconnecting
      ? "Reconnecting"
      : "Disconnected"
  );

  /* ================= RESTART ================= */

  socket.on("restart", async () => {

    pushLog(
      "Manual restart requested"
    );

    await fullRestart(
      "Panel restart button"
    );

  });

  /* ================= PAIR ================= */

  socket.on("pair", async raw => {

    try {

      if (!sock) {

        pushLog(
          "Socket not ready"
        );

        return;
      }

      if (isConnected) {

        pushLog(
          "Already connected"
        );

        return;
      }

      const phone =
        String(raw || "")
        .replace(/\D/g, "");

      if (!phone) {

        pushLog(
          "Invalid phone number"
        );

        return;
      }

      pushLog(
        "Preparing pairing..."
      );

      await new Promise(resolve =>
        setTimeout(resolve, 4000)
      );

      const code =
        await sock.requestPairingCode(
          phone
        );

      socket.emit(
        "code",
        code
      );

      pushLog(
        "Pair code generated successfully"
      );

    } catch (err) {

      pushLog(
        "Pair failed: " +
        (err?.message || err)
      );

      if (
        String(err)
          .toLowerCase()
          .includes("closed")
      ) {

        pushLog(
          "Repairing socket..."
        );

        await fullRestart(
          "Pairing crash"
        );
      }
    }

  });

  /* ================= START SEND ================= */

  socket.on("start", async cfg => {

    try {

      if (!sock || !isConnected) {

        pushLog(
          "WhatsApp not connected"
        );

        return;
      }

      if (sendingActive) {

        pushLog(
          "Already sending messages"
        );

        return;
      }

      if (
        !cfg.target ||
        !cfg.target.includes("@")
      ) {

        pushLog(
          "Invalid target JID"
        );

        return;
      }

      const rawText =
        String(cfg.msgs || "");

      const lines = rawText
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

      if (!lines.length) {

        pushLog(
          "No valid lines found"
        );

        return;
      }

      stopSending = false;

      sendingActive = true;

      const delayMs =
        Math.max(
          10,
          parseInt(cfg.delay) || 10
        ) * 1000;

      pushLog(
        `Loaded ${lines.length} lines | Delay ${delayMs / 1000}s`
      );

      let index = 0;

      async function sendNext() {

        if (
          stopSending ||
          !sendingActive
        ) {

          sendingActive = false;

          pushLog(
            "Stopped successfully"
          );

          return;
        }

        try {

          const line =
            lines[index];

          const text =
            cfg.prefix
              ? `*${cfg.prefix}* ${line}`
              : line;

          await sock.sendMessage(
            cfg.target,
            { text }
          );

          pushLog(
            `Sent line ${index + 1}/${lines.length}`
          );

          index =
            (index + 1) %
            lines.length;

          currentLoop =
            setTimeout(
              sendNext,
              delayMs
            );

        } catch (err) {

          pushLog(
            "Send failed: " +
            err.message
          );

          currentLoop =
            setTimeout(
              sendNext,
              delayMs
            );
        }
      }

      sendNext();

    } catch (err) {

      sendingActive = false;

      pushLog(
        "Start failed: " +
        err.message
      );
    }

  });

  /* ================= STOP ================= */

  socket.on("stop", () => {

    stopSending = true;

    sendingActive = false;

    if (currentLoop) {

      clearTimeout(currentLoop);

      currentLoop = null;
    }

    pushLog(
      "Stopping sender..."
    );

  });

});

/* ================= START SERVER ================= */

server.listen(PORT, () => {

  console.log(
    "Server running on port " +
    PORT
  );

});
