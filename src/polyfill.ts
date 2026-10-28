try {
  window.localStorage.getItem('test');
} catch (e) {
  const memoryStorage = {
    _data: {} as Record<string, string>,
    setItem: function(id: string, val: string) { return this._data[id] = String(val); },
    getItem: function(id: string) { return Object.prototype.hasOwnProperty.call(this._data, id) ? this._data[id] : null; },
    removeItem: function(id: string) { return delete this._data[id]; },
    clear: function() { this._data = {}; }
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, writable: true, configurable: true });
  } catch(err) {}
}

try {
  window.sessionStorage.getItem('test');
} catch (e) {
  const memorySessionStorage = {
    _data: {} as Record<string, string>,
    setItem: function(id: string, val: string) { return this._data[id] = String(val); },
    getItem: function(id: string) { return Object.prototype.hasOwnProperty.call(this._data, id) ? this._data[id] : null; },
    removeItem: function(id: string) { return delete this._data[id]; },
    clear: function() { this._data = {}; }
  };
  try {
    Object.defineProperty(window, 'sessionStorage', { value: memorySessionStorage, writable: true, configurable: true });
  } catch(err) {}
}

// Global protection against quota exhaustion crashes, uncaught rejections, and console log spam
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || "");
    if (
      msg.includes("resource-exhausted") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("quota metric") ||
      msg.includes("Free daily write units") ||
      msg.includes("maximum backoff delay") ||
      reason?.code === "resource-exhausted"
    ) {
      event.preventDefault();
      try {
        sessionStorage.setItem("sgs_firestore_quota_exhausted", String(Date.now()));
        localStorage.setItem("sgs_firestore_quota_exhausted", String(Date.now()));
        window.dispatchEvent(new CustomEvent("firestore-quota-exhausted"));
      } catch {}
    }
  });

  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    const text = args.map(a => typeof a === "string" ? a : (a?.message || "")).join(" ");
    if (
      text.includes("resource-exhausted") ||
      text.includes("Quota limit exceeded") ||
      text.includes("maximum backoff delay") ||
      text.includes("Free daily write units")
    ) {
      try {
        sessionStorage.setItem("sgs_firestore_quota_exhausted", String(Date.now()));
        localStorage.setItem("sgs_firestore_quota_exhausted", String(Date.now()));
        window.dispatchEvent(new CustomEvent("firestore-quota-exhausted"));
      } catch {}
      return;
    }
    originalConsoleError.apply(console, args);
  };
}
