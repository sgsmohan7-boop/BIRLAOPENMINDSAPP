import React, { useState, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { Truck, Map as MapIcon, Route as RouteIcon, Navigation, Signal, AlertTriangle, Plus, X, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { saveDocument, syncCollection, isFirebaseConfigured, isFirestoreQuotaExhausted } from "../utils/firebase";
import BusRouteManager from "./BusRouteManager";
import TrafficAlertsPanel from "./TrafficAlertsPanel";

const API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.Google_maps_platform_key ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).Google_maps_platform_key ||
  'AIzaSyBTrMUwQ5igCTHC5LTR9XQp8YSFlH2Acsw';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface Bus {
  id: string;
  busNumber: string;
  driverName: string;
  status: "Moving" | "Idling" | "Offline";
  speed: number;
  routeName: string;
  progress: number;
  eta: string;
  lat: number;
  lng: number;
  heading: number;
  lastUpdated: string;
}

const INITIAL_BUSES: Bus[] = [
  { id: "B1", busNumber: "BI-01", driverName: "Ramesh K.", status: "Moving", speed: 45, routeName: "Route A - City Center", progress: 65, eta: "15 mins", lat: 17.385, lng: 78.486, heading: 45, lastUpdated: new Date().toISOString() },
  { id: "B2", busNumber: "BI-02", driverName: "Suresh P.", status: "Idling", speed: 0, routeName: "Route B - North Hills", progress: 30, eta: "45 mins", lat: 17.412, lng: 78.450, heading: 120, lastUpdated: new Date().toISOString() },
  { id: "B3", busNumber: "BI-03", driverName: "Mahesh V.", status: "Moving", speed: 38, routeName: "Route C - East View", progress: 85, eta: "5 mins", lat: 17.399, lng: 78.498, heading: 180, lastUpdated: new Date().toISOString() },
  { id: "B4", busNumber: "BI-04", driverName: "Venkatesh S.", status: "Offline", speed: 0, routeName: "Route D - West End", progress: 0, eta: "N/A", lat: 17.435, lng: 78.405, heading: 0, lastUpdated: new Date().toISOString() },
];

const MOCK_ALERTS = [
  { id: 1, type: "Speeding", bus: "BI-01", msg: "Exceeded 60km/h on Main Highway", time: "2 mins ago" },
  { id: 2, type: "Geofence Exit", bus: "BI-02", msg: "Exited primary school zone", time: "15 mins ago" },
  { id: 3, type: "Route Deviation", bus: "BI-03", msg: "Took unauthorized detour near Station Rd", time: "45 mins ago" },
];

function MarkerWithInfo({ bus, onSelect }: { bus: Bus, onSelect: () => void }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker 
        ref={markerRef} 
        position={{lat: bus.lat, lng: bus.lng}} 
        onClick={() => { setOpen(true); onSelect(); }}
        title={`Bus ${bus.busNumber}`}
      >
        <div style={{ transform: `rotate(${bus.heading}deg)` }}>
          <Pin 
            background={bus.status === "Moving" ? "#10B981" : bus.status === "Idling" ? "#F59E0B" : "#EF4444"} 
            glyphColor="#fff" 
            borderColor="rgba(0,0,0,0.5)"
          >
             {/* We can use an icon in the Pin content realistically if needed, but Pin is default */}
          </Pin>
        </div>
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)} style={{ padding: 0 }}>
          <div className="text-slate-900 font-sans p-1 min-w-[200px]">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
              <div className={`p-1.5 rounded bg-${bus.status === "Moving" ? "emerald" : bus.status === "Idling" ? "amber" : "red"}-100`}>
                <Truck size={14} className={`text-${bus.status === "Moving" ? "emerald" : bus.status === "Idling" ? "amber" : "red"}-600`} />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">Bus {bus.busNumber}</h4>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">{bus.driverName}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Route:</span>
                <span className="font-semibold">{bus.routeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Speed:</span>
                <span className="font-mono font-semibold">{bus.speed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ETA:</span>
                <span className="font-semibold text-emerald-600">{bus.eta}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${bus.status === "Moving" ? "text-emerald-500" : bus.status === "Idling" ? "text-amber-500" : "text-red-500"}`}>{bus.status}</span>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function TransportDashboard() {
  const [buses, setBuses] = useState<Bus[]>(INITIAL_BUSES);
  const [selectedTab, setSelectedTab] = useState<"fleet" | "routes" | "alerts" | "traffic">("fleet");
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [isAddingBus, setIsAddingBus] = useState(false);
  const [newBus, setNewBus] = useState({ busNumber: "", driverName: "" });
  const [mapAuthError, setMapAuthError] = useState(false);

  useEffect(() => {
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setMapAuthError(true);
      if (typeof prevAuthFailure === "function") {
        try { prevAuthFailure(); } catch (e) {}
      }
    };
    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
    };
  }, []);

  const handleAddBus = () => {
    if (!newBus.busNumber || !newBus.driverName) return;
    
    const bus: Bus = {
      id: `B${Date.now()}`,
      busNumber: newBus.busNumber,
      driverName: newBus.driverName,
      status: "Offline",
      speed: 0,
      routeName: "Unassigned",
      progress: 0,
      eta: "N/A",
      lat: 17.385,
      lng: 78.486,
      heading: 0,
      lastUpdated: new Date().toISOString()
    };
    
    if (isFirebaseConfigured()) {
        saveDocument("transport_fleet", bus.id, bus);
    } else {
        setBuses(prev => [...prev, bus]);
    }
    
    setNewBus({ busNumber: "", driverName: "" });
    setIsAddingBus(false);
  };

  // Simulate Firebase real-time updates for buses
  useEffect(() => {
    let unsubscribe = () => {};
    let isMasterNode = false;

    if (isFirebaseConfigured()) {
      unsubscribe = syncCollection<Bus>("transport_fleet", (items) => {
        if (items && items.length > 0) {
          setBuses(items);
        } else {
          setBuses(INITIAL_BUSES);
        }
      }, INITIAL_BUSES);
    }

    // Only random simulate moving if offline
    // In a real app this simulator logic would live on backend GPS devices.
    // We disable this interval from wiping out real drivers if Firebase is configured.
    const interval = setInterval(() => {
      if (!isFirebaseConfigured()) {
        setBuses(prev => {
          return prev.map(bus => {
            if (bus.status === "Moving") {
              // Simulate real tracking with directional movement instead of jitter
              const directionLat = bus.heading > 90 && bus.heading < 270 ? -1 : 1;
              const directionLng = bus.heading > 180 ? -1 : 1;
              
              const newLat = bus.lat + (directionLat * 0.0005);
              const newLng = bus.lng + (directionLng * 0.0005);
              
              // Keep heading loosely pointed in their trajectory
              const newHeading = (bus.heading + (Math.random() - 0.5) * 10 + 360) % 360;

              return {
                ...bus,
                lat: newLat,
                lng: newLng,
                heading: newHeading,
                speed: Math.floor(Math.random() * 15) + 35, // 35 - 50 range
                lastUpdated: new Date().toISOString()
              };
            }
            return { ...bus, lastUpdated: new Date().toISOString() };
          });
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (!hasValidKey) {
    return (
      <div className="flex bg-slate-100 dark:bg-slate-950 flex-col items-center justify-center p-8 h-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl max-w-lg w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border-4 border-amber-50">
            <MapIcon size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold dark:text-white">Google Maps Setup Required</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-balance">
              The real-time fleet tracker requires a valid Google Maps Platform API key.
            </p>
          </div>
          <div className="text-left text-sm space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="font-semibold dark:text-slate-300">Quick Configuration:</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>Open <strong>Settings</strong> (⚙️ gear icon, top-right panel)</li>
              <li>Select <strong>Secrets</strong></li>
              <li>Add key: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-xs select-all">GOOGLE_MAPS_PLATFORM_KEY</code></li>
            </ol>
            <p className="text-xs italic mt-2 opacity-80">System will self-refresh upon adding.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#0B0F19] text-slate-300 font-sans overflow-hidden">
      
      {/* 1. Sidebar Management Panel */}
      <div className="w-80 border-r border-slate-800 bg-[#111827] flex flex-col shrink-0 relative z-20 shadow-2xl">
        <div className="p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400 shrink-0">
                <Navigation size={20} />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wider text-slate-100 uppercase">Fleet Command</h1>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1">
                  <Signal size={10} className="text-emerald-500 animate-pulse" /> Live Tracking
                </p>
              </div>
            </div>
            <button onClick={() => setIsAddingBus(true)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Add Bus">
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center text-xs font-bold border-b border-slate-800 bg-slate-900/20">
          <button 
            onClick={() => setSelectedTab('fleet')}
            className={`flex-1 py-3 border-b-2 transition-all ${selectedTab === 'fleet' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
          >
            Active Fleet
          </button>
          <button 
            onClick={() => setSelectedTab('alerts')}
            className={`flex-1 py-3 border-b-2 transition-all ${selectedTab === 'alerts' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
          >
            Alerts <span className="hidden sm:inline bg-amber-500 text-slate-900 ml-1 px-1.5 py-0.5 rounded-full text-[9px]">{MOCK_ALERTS.length}</span>
          </button>
          <button 
            onClick={() => setSelectedTab('traffic')}
            className={`flex-1 py-3 border-b-2 transition-all ${selectedTab === 'traffic' ? 'border-rose-500 text-rose-400 bg-rose-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
          >
            Traffic
          </button>
          <button 
            onClick={() => setSelectedTab('routes')}
            className={`flex-1 py-3 border-b-2 transition-all ${selectedTab === 'routes' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
          >
            Routes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isAddingBus && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-3 mb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Add New Bus</h3>
                <button onClick={() => setIsAddingBus(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
              </div>
              <input
                type="text"
                placeholder="Bus Number (e.g., BI-05)"
                value={newBus.busNumber}
                onChange={e => setNewBus(p => ({ ...p, busNumber: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
              />
              <input
                type="text"
                placeholder="Driver Name"
                value={newBus.driverName}
                onChange={e => setNewBus(p => ({ ...p, driverName: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
              />
              <button 
                onClick={handleAddBus}
                disabled={!newBus.busNumber || !newBus.driverName}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold text-xs"
              >
                SAVE BUS
              </button>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            {selectedTab === "fleet" && (
              <motion.div key="fleet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {buses.map(bus => (
                  <div 
                    key={bus.id} 
                    onClick={() => setSelectedBusId(bus.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedBusId === bus.id ? "bg-indigo-500/10 border-indigo-500/50" : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={14} className={bus.status === "Moving" ? "text-emerald-400" : bus.status === "Idling" ? "text-amber-400" : "text-red-400"} />
                        <span className="font-black text-sm text-slate-100">{bus.busNumber}</span>
                      </div>
                      <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${
                        bus.status === "Moving" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : 
                        bus.status === "Idling" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : 
                        "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}>{bus.status}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <p className="flex justify-between"><span className="text-slate-500">Driver:</span> <strong className="text-slate-300">{bus.driverName}</strong></p>
                      <p className="flex justify-between"><span className="text-slate-500">Route:</span> <span className="truncate ml-2">{bus.routeName}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">Speed:</span> <span className="font-mono">{bus.speed} km/h</span></p>
                      
                      {/* Progress Bar */}
                      {bus.status !== "Offline" && (
                        <div className="mt-3 pt-2 border-t border-slate-700/50">
                          <div className="flex justify-between text-[10px] uppercase font-bold mb-1">
                            <span>Progress</span>
                            <span className="text-emerald-400">ETA: {bus.eta}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-500" 
                              initial={{ width: 0 }}
                              animate={{ width: `${bus.progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {selectedTab === "alerts" && (
              <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {MOCK_ALERTS.map(alert => (
                  <div key={alert.id} className="p-3 bg-slate-800/40 border border-slate-700 rounded-xl relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                    <div className="flex items-start gap-3 pl-2">
                      <div className="mt-0.5 p-1.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                        <AlertTriangle size={14} />
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{alert.bus}</span>
                          <span className="text-[9px] text-slate-500 font-medium">{alert.time}</span>
                        </div>
                        <p className="font-semibold text-amber-400 uppercase text-[10px] tracking-wider">{alert.type}</p>
                        <p className="text-slate-400 leading-snug">{alert.msg}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {selectedTab === "routes" && (
              <motion.div key="routes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BusRouteManager />
              </motion.div>
            )}

            {selectedTab === "traffic" && (
              <motion.div key="traffic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TrafficAlertsPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. Main Map View */}
      <div className="flex-1 relative bg-slate-900 border-l border-slate-800">
        {mapAuthError ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden select-none">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none" />

            {/* Radar / GPS simulation circles */}
            <div className="absolute w-[500px] h-[500px] rounded-full border border-indigo-500/10 pointer-events-none" />
            <div className="absolute w-[300px] h-[300px] rounded-full border border-indigo-500/15 pointer-events-none" />
            <div className="absolute w-[100px] h-[100px] rounded-full border border-indigo-500/20 pointer-events-none" />

            {/* Simulated Campus / Hyderabad Route Roads */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
              <path d="M 100 200 Q 300 150 500 350 T 800 400" fill="none" stroke="#334155" strokeWidth="4" strokeDasharray="6 4" />
              <path d="M 250 80 Q 400 300 450 550" fill="none" stroke="#334155" strokeWidth="3" />
              <path d="M 50 450 L 750 250" fill="none" stroke="#1e293b" strokeWidth="2" />
            </svg>

            {/* Interactive simulated bus markers positioned by coordinates */}
            {buses.map((bus, idx) => {
              // Convert lat/lng (around 17.38-17.43, 78.40-78.50) into percentage offset
              const leftPct = Math.min(Math.max(((bus.lng - 78.40) / 0.12) * 80 + 10, 10), 90);
              const topPct = Math.min(Math.max(((17.45 - bus.lat) / 0.08) * 80 + 10, 10), 90);
              const isSelected = selectedBusId === bus.id;

              return (
                <div
                  key={bus.id}
                  onClick={() => setSelectedBusId(bus.id)}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 transition-all duration-700 group`}
                >
                  <div className={`relative flex flex-col items-center`}>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white mb-1 shadow-md whitespace-nowrap ${
                      bus.status === "Moving" ? "bg-emerald-600" : bus.status === "Idling" ? "bg-amber-600" : "bg-red-600"
                    }`}>
                      {bus.busNumber}
                    </div>
                    <div className={`p-2.5 rounded-full border-2 transition-transform ${
                      isSelected ? "scale-125 ring-4 ring-indigo-500/50" : "group-hover:scale-110"
                    } ${
                      bus.status === "Moving" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                      bus.status === "Idling" ? "bg-amber-500/20 border-amber-500 text-amber-400" :
                      "bg-red-500/20 border-red-500 text-red-400"
                    }`}>
                      <Truck size={16} style={{ transform: `rotate(${bus.heading}deg)` }} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Billing Notice Banner */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-xl w-[90%] bg-slate-900/95 border border-amber-500/30 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4 z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Google Maps Billing Notice</p>
                  <p className="text-[11px] text-slate-400">
                    Live GPS telemetry and telemetry fleet radar are active. Enable billing on your Google Cloud Console project to load external Google satellite tiles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMapAuthError(false)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
              >
                Retry Tiles
              </button>
            </div>
          </div>
        ) : (
          <APIProvider 
            apiKey={API_KEY} 
            version="weekly"
            onLoad={() => setMapAuthError(false)}
            onError={() => setMapAuthError(true)}
          >
            <Map
              defaultCenter={{ lat: 17.385044, lng: 78.486671 }} // Hyderabad center
              defaultZoom={12}
              mapId="TRANSPORT_GPS_DASHBOARD_ID_BI"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              disableDefaultUI={false}
              mapTypeControl={true}
              streetViewControl={false}
            >
              {buses.filter(b => b.status !== "Offline").map(bus => (
                <MarkerWithInfo key={bus.id} bus={bus} onSelect={() => setSelectedBusId(bus.id)} />
              ))}
            </Map>
          </APIProvider>
        )}
        
        {/* Overlay Overlay Info Panels */}
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700 p-3 rounded-xl shadow-2xl flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 block shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="font-bold text-slate-300">Moving ({buses.filter(b => b.status==='Moving').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 block shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="font-bold text-slate-300">Idling ({buses.filter(b => b.status==='Idling').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 block shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="font-bold text-slate-300">Offline ({buses.filter(b => b.status==='Offline').length})</span>
          </div>
        </div>

      </div>
    </div>
  );
}
