import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Monitor, PingLog, Settings, ServerEvent } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("uptime.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    interval INTEGER DEFAULT 60,
    lastChecked TEXT,
    uptime REAL DEFAULT 100,
    responseTime INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitorId INTEGER,
    status TEXT,
    responseTime INTEGER,
    timestamp TEXT,
    errorMessage TEXT,
    FOREIGN KEY(monitorId) REFERENCES monitors(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    telegramBotToken TEXT,
    telegramChatId TEXT,
    reportInterval INTEGER DEFAULT 3600
  );

  INSERT OR IGNORE INTO settings (id, telegramBotToken, telegramChatId, reportInterval) 
  VALUES (1, '', '', 3600);
`);

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    
    // Send initial state
    const monitors = db.prepare("SELECT * FROM monitors").all() as Monitor[];
    const logs = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 100").all() as PingLog[];
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Settings;
    
    ws.send(JSON.stringify({ type: 'INITIAL_STATE', monitors, logs, settings }));

    ws.on("close", () => clients.delete(ws));
  });

  const broadcast = (event: ServerEvent) => {
    const data = JSON.stringify(event);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  // Telegram Service
  const sendTelegramMessage = async (message: string) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Settings;
    if (!settings.telegramBotToken || !settings.telegramChatId) return;

    try {
      await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
    } catch (err) {
      console.error("Telegram error:", err);
    }
  };

  // Monitoring Logic
  const pingMonitor = async (monitor: Monitor) => {
    const start = Date.now();
    let status: 'up' | 'down' = 'up';
    let errorMessage = '';
    let responseTime = 0;

    try {
      const res = await fetch(monitor.url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      responseTime = Date.now() - start;
      if (!res.ok) {
        status = 'down';
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      status = 'down';
      errorMessage = err.message;
      responseTime = Date.now() - start;
    }

    // Update DB
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO logs (monitorId, status, responseTime, timestamp, errorMessage) VALUES (?, ?, ?, ?, ?)")
      .run(monitor.id, status, responseTime, timestamp, errorMessage);

    // Calculate Uptime (simplified: last 100 checks)
    const recentLogs = db.prepare("SELECT status FROM logs WHERE monitorId = ? ORDER BY id DESC LIMIT 100").all(monitor.id) as { status: string }[];
    const upCount = recentLogs.filter(l => l.status === 'up').length;
    const uptime = (upCount / recentLogs.length) * 100;

    db.prepare("UPDATE monitors SET status = ?, lastChecked = ?, responseTime = ?, uptime = ? WHERE id = ?")
      .run(status, timestamp, responseTime, uptime, monitor.id);

    const updatedMonitor = db.prepare("SELECT * FROM monitors WHERE id = ?").get(monitor.id) as Monitor;
    const newLog = db.prepare("SELECT * FROM logs WHERE id = last_insert_rowid()").get() as PingLog;

    broadcast({ type: 'MONITOR_UPDATED', monitor: updatedMonitor });
    broadcast({ type: 'NEW_LOG', log: newLog });

    // Alerting
    if (monitor.status !== status && monitor.status !== 'pending') {
      const emoji = status === 'up' ? '✅' : '❌';
      const msg = `${emoji} <b>Monitor Alert</b>\nName: ${monitor.name}\nURL: ${monitor.url}\nStatus: ${status.toUpperCase()}\n${errorMessage ? `Error: ${errorMessage}` : ''}`;
      sendTelegramMessage(msg);
    }
  };

  // Main Loop
  setInterval(async () => {
    const monitors = db.prepare("SELECT * FROM monitors").all() as Monitor[];
    for (const monitor of monitors) {
      const lastChecked = monitor.lastChecked ? new Date(monitor.lastChecked).getTime() : 0;
      if (Date.now() - lastChecked >= monitor.interval * 1000) {
        pingMonitor(monitor);
      }
    }
  }, 5000);

  // Hourly Report
  setInterval(async () => {
    const monitors = db.prepare("SELECT * FROM monitors").all() as Monitor[];
    if (monitors.length === 0) return;

    let report = "📊 <b>Hourly Uptime Report</b>\n\n";
    monitors.forEach(m => {
      const statusEmoji = m.status === 'up' ? '🟢' : '🔴';
      report += `${statusEmoji} <b>${m.name}</b>\nUptime: ${m.uptime.toFixed(2)}%\nResponse: ${m.responseTime}ms\n\n`;
    });
    sendTelegramMessage(report);
  }, 3600000);

  // API Routes
  app.post("/api/monitors", (req, res) => {
    const { url, name, interval } = req.body;
    const result = db.prepare("INSERT INTO monitors (url, name, interval) VALUES (?, ?, ?)").run(url, name, interval || 60);
    const monitor = db.prepare("SELECT * FROM monitors WHERE id = ?").get(result.lastInsertRowid) as Monitor;
    broadcast({ type: 'MONITOR_UPDATED', monitor });
    res.json(monitor);
  });

  app.delete("/api/monitors/:id", (req, res) => {
    db.prepare("DELETE FROM logs WHERE monitorId = ?").run(req.params.id);
    db.prepare("DELETE FROM monitors WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/settings", (req, res) => {
    const { telegramBotToken, telegramChatId, reportInterval } = req.body;
    db.prepare("UPDATE settings SET telegramBotToken = ?, telegramChatId = ?, reportInterval = ? WHERE id = 1")
      .run(telegramBotToken, telegramChatId, reportInterval || 3600);
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Settings;
    broadcast({ type: 'SETTINGS_UPDATED', settings });
    res.json(settings);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

startServer();
