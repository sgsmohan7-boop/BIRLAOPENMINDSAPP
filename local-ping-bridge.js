/**
 * CCTV WATCHDOG - STANDALONE ON-PREMISE LOCAL PING BRIDGE
 * Run using: node local-ping-bridge.js
 */
const http = require("http");
const net = require("net");
const { exec } = require("child_process");

const PORT = 3555;
const HOST = "127.0.0.1";
const PORTS_TO_PROBE = [80, 554, 443, 8000, 37777];

function runSystemPing(ip, timeoutMs) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${Math.max(1, Math.round(timeoutMs / 1000))} ${ip}`;

    exec(cmd, (error, stdout) => {
      const output = (stdout || "").toLowerCase();
      resolve(output.includes("ttl="));
    });
  });
}

function probePort(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let completed = false;
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on("error", (err) => {
      if (!completed) {
        completed = true;
        socket.destroy();
        if (err.code === "ECONNREFUSED") {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });

    socket.on("timeout", () => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(false);
      }
    });
  });
}

function isValidIpv4(ip) {
  const clean = ip.trim();
  if (clean === "localhost" || clean === "127.0.0.1") return true;
  const parts = clean.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

async function pingLocalIp(ip, timeoutMs = 1200) {
  const cleanIp = ip.trim();
  if (!isValidIpv4(cleanIp)) {
    return { ip: cleanIp, status: "offline", latencyMs: undefined, error: "Invalid IPv4" };
  }
  const startTime = Date.now();

  const isIcmpOnline = await runSystemPing(cleanIp, timeoutMs);
  if (isIcmpOnline) {
    return { ip: cleanIp, status: "online", latencyMs: Date.now() - startTime };
  }

  const probes = PORTS_TO_PROBE.map((port) => probePort(cleanIp, port, timeoutMs));
  const results = await Promise.all(probes);
  const isTcpOnline = results.some((res) => res === true);

  return {
    ip: cleanIp,
    status: isTcpOnline ? "online" : "offline",
    latencyMs: Date.now() - startTime,
  };
}

const server = http.createServer(async (req, res) => {
  // CORS & Private Network Access (PNA) Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: "active", system: "CCTV Watchdog Local Bridge" }));
    return;
  }

  if (url.pathname === "/ping") {
    if (req.method === "GET") {
      const targetIp = url.searchParams.get("ip");
      if (!targetIp) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing ip parameter" }));
        return;
      }
      const result = await pingLocalIp(targetIp, 1200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ip: targetIp,
        status: result.status,
        latency: result.status === "online" ? (result.latencyMs || 18) : null,
        latencyMs: result.latencyMs
      }));
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body);
          if (!payload.ip) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing Target IP" }));
            return;
          }
          const result = await pingLocalIp(payload.ip, payload.timeoutMs || 1200);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ip: payload.ip,
            status: result.status,
            latency: result.status === "online" ? (result.latencyMs || 18) : null,
            latencyMs: result.latencyMs
          }));
        } catch {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Error" }));
        }
      });
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`🔒 CCTV Watchdog Local Bridge running on http://${HOST}:${PORT}`);
});
