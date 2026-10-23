/**
 * CCTV WATCHDOG HUB - FRONTEND NETWORK PING & SWEEP UTILITY
 */

export interface HealthCheckResult {
  status: "online" | "offline";
  latency?: number;
  source?: "bridge" | "local-server" | "cloud-proxy" | "sandbox-registry";
}

export interface CctvCamera {
  id: string;
  sNo: number;
  ipAddress: string;
  cameraName: string;
  roomNumber: string;
  classNameField?: string;
  floor?: string;
  cameraType?: string;
  dvrNvr?: string;
  status: "online" | "offline";
  building?: string;
  networkZone?: string;
  lastPingTime?: string;
  latency?: number;
}

export const isValidIpv4 = (ip: string): boolean => {
  const clean = ip.trim();
  if (clean === "localhost" || clean === "127.0.0.1") return true;
  const parts = clean.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

export async function isLocalBridgeActive(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    const res = await fetch("http://127.0.0.1:3555/health", {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.status === "active";
    }
  } catch {
    // Bridge inactive
  }
  return false;
}

async function browserDirectLanProbe(ip: string, timeoutMs = 800): Promise<{ isAlive: boolean; latencyMs?: number }> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    await fetch(`http://${ip}/`, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal
    });
    clearTimeout(timer);
    const elapsed = Date.now() - startTime;
    return { isAlive: true, latencyMs: Math.max(1, elapsed) };
  } catch {
    // Any error (Mixed Content block, AbortError timeout, or Failed to fetch) means device is NOT responding -> OFFLINE
    return { isAlive: false };
  }
}

export async function checkCameraHttpHealth(
  ip: string, 
  timeoutMs = 1500
): Promise<HealthCheckResult> {
  const targetIp = ip.trim();
  if (!targetIp || !isValidIpv4(targetIp)) {
    return { status: "offline", source: "sandbox-registry" };
  }

  if (targetIp === "127.0.0.1" || targetIp === "localhost") {
    return { status: "online", latency: 1, source: "sandbox-registry" };
  }

  const startTime = Date.now();

  // Mode 1: Try Local Loopback Bridge (Port 3555) on user's PC
  try {
    const bridgeCtrl = new AbortController();
    const bridgeTimer = setTimeout(() => bridgeCtrl.abort(), timeoutMs + 200);
    const bridgeRes = await fetch(`http://127.0.0.1:3555/ping?ip=${encodeURIComponent(targetIp)}`, {
      method: "GET",
      signal: bridgeCtrl.signal
    });
    clearTimeout(bridgeTimer);
    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      return {
        status: data.status === "online" ? "online" : "offline",
        latency: data.latency ?? data.latencyMs ?? (data.status === "online" ? Math.max(1, Date.now() - startTime) : undefined),
        source: "bridge"
      };
    }
  } catch {
    // Bridge not active
  }

  // Mode 2: Try Backend /api/ping (works when app is running on localhost:3000)
  try {
    const proxyCtrl = new AbortController();
    const proxyTimer = setTimeout(() => proxyCtrl.abort(), timeoutMs + 300);
    const proxyRes = await fetch("/api/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: targetIp, timeoutMs }),
      signal: proxyCtrl.signal
    });
    clearTimeout(proxyTimer);

    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      const isLocalHost = typeof window !== "undefined" && 
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      if (isLocalHost || !proxyData.isCloudSandbox) {
        return {
          status: proxyData.status === "online" ? "online" : "offline",
          latency: proxyData.status === "online" ? Math.max(1, Date.now() - startTime) : undefined,
          source: isLocalHost ? "local-server" : "cloud-proxy"
        };
      }
    }
  } catch (proxyErr) {
    console.warn("Backend /api/ping check bypassed:", proxyErr);
  }

  // Real physical response: host did not reply to ICMP ping or local probe
  return {
    status: "offline",
    latency: undefined,
    source: "sandbox-registry"
  };
}

// Bulk Parallel Ping Sweep Engine (500+ Cameras in parallel)
export async function executePingSweep(
  camerasList: CctvCamera[],
  onProgress?: (log: string) => void
): Promise<CctvCamera[]> {
  const BATCH_SIZE = 25; // Concurrency limit to prevent network congestion
  const updatedCameras: CctvCamera[] = [];

  for (let i = 0; i < camerasList.length; i += BATCH_SIZE) {
    const chunk = camerasList.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      chunk.map(async (cam) => {
        const pingResult = await checkCameraHttpHealth(cam.ipAddress, 1200);
        const updated: CctvCamera = {
          ...cam,
          status: pingResult.status,
          latency: pingResult.latency,
          lastPingTime: new Date().toLocaleTimeString(),
        };
        if (onProgress) {
          const srcTag = pingResult.source ? ` [${pingResult.source.toUpperCase()}]` : "";
          onProgress(`[PING] ${cam.ipAddress} (${cam.cameraName})${srcTag} -> ${pingResult.status.toUpperCase()}`);
        }
        return updated;
      })
    );

    updatedCameras.push(...results);
  }

  return updatedCameras;
}
