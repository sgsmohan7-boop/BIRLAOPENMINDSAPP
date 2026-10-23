import React, { useState, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { LogOut, Bus as BusIcon, MapPin, BellRing, Route } from "lucide-react";
import { syncCollection } from "../utils/firebase";
import { motion, AnimatePresence } from "framer-motion";

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

// Distance calculation using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>("");
  const [myStop, setMyStop] = useState<{lat: number, lng: number} | null>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [hasNotified, setHasNotified] = useState(false);
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

  useEffect(() => {
    const unsub = syncCollection<Bus>("transport_fleet", (items) => {
      setBuses(items);
    }, []);
    return () => unsub();
  }, []);

  // Monitor Distance
  useEffect(() => {
    if (selectedBusId && myStop) {
      const activeBus = buses.find(b => b.id === selectedBusId);
      if (activeBus) {
        const dist = calculateDistance(activeBus.lat, activeBus.lng, myStop.lat, myStop.lng);
        setDistance(dist);

        if (dist <= 1.0 && !hasNotified) {
          // Bus entered 1km Geofence
          setShowAlert(true);
          setHasNotified(true);
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Bus Arrival Alert", {
              body: `Bus ${activeBus.busNumber} is within 1 km of your stop!`,
              icon: "/favicon.ico"
            });
          }
        } else if (dist > 1.0 && hasNotified) {
          // Bus left geofence, reset alert state to fire again if it loops
          setHasNotified(false);
        }
      }
    }
  }, [buses, selectedBusId, myStop, hasNotified]);

  const requestNotificationPermission = () => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  };

  const handleMapClick = (e: any) => {
    if (e.detail?.latLng) {
      setMyStop({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
      requestNotificationPermission();
    }
  };

  const activeBus = buses.find(b => b.id === selectedBusId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <div className="bg-indigo-600 p-4 border-b border-indigo-700 flex items-center justify-between text-white shadow-md z-10">
        <div className="flex items-center gap-2">
          <BusIcon className="text-amber-300" />
          <h1 className="font-bold">Student / Parent Portal</h1>
        </div>
        <button onClick={onLogout} className="text-indigo-200 hover:text-white flex items-center gap-1 text-sm bg-indigo-700/50 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Sidebar Controls */}
        <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shadow-xl z-10">
          <div>
            <h2 className="text-lg font-bold mb-2">Track Your Bus</h2>
            <p className="text-sm text-slate-500 mb-4">Select your child's bus and tap on the map to set your pickup stop. We will alert you when it is 1 km away.</p>
            
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Assigned Bus</label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Choose Bus --</option>
              {buses.map(b => (
                <option key={b.id} value={b.id}>{b.busNumber} ({b.routeName || 'No route'})</option>
              ))}
            </select>
          </div>

          {activeBus && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Route size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{activeBus.busNumber}</h3>
                  <p className="text-xs font-semibold text-indigo-600">{activeBus.status}</p>
                </div>
              </div>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-indigo-100/50">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Speed:</span>
                  <span className="font-semibold text-slate-800">{activeBus.speed} km/h</span>
                </div>
                {distance !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Distance to Stop:</span>
                    <span className="font-bold text-indigo-600">{distance.toFixed(2)} km</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!myStop && selectedBusId && (
            <div className="mt-auto bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm flex items-start gap-3">
              <MapPin className="shrink-0 mt-0.5 text-amber-600" size={18} />
              <p>Please click on the map to drop a pin at your pickup stop so we can send proximity alerts.</p>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden">
          {!hasValidKey ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 flex-col gap-3 bg-slate-100 dark:bg-slate-900">
              <MapPin size={48} className="text-slate-400" />
              <p className="text-slate-500 font-medium">Google Maps Platform Key Required</p>
            </div>
          ) : mapAuthError ? (
            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xRatio = (e.clientX - rect.left) / rect.width;
                const yRatio = (e.clientY - rect.top) / rect.height;
                const clickedLng = 78.40 + xRatio * 0.12;
                const clickedLat = 17.45 - yRatio * 0.08;
                setMyStop({ lat: clickedLat, lng: clickedLng });
                setHasNotified(false);
              }}
              className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 cursor-crosshair select-none"
            >
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none" />

              {/* Concentric distance rings from center */}
              <div className="absolute w-[450px] h-[450px] rounded-full border border-indigo-500/10 pointer-events-none" />
              <div className="absolute w-[280px] h-[280px] rounded-full border border-indigo-500/15 pointer-events-none" />
              <div className="absolute w-[120px] h-[120px] rounded-full border border-indigo-500/20 pointer-events-none" />

              {/* Roads visual */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                <path d="M 120 180 Q 280 160 520 340 T 780 420" fill="none" stroke="#334155" strokeWidth="4" strokeDasharray="6 4" />
                <path d="M 220 90 Q 380 280 420 520" fill="none" stroke="#334155" strokeWidth="3" />
              </svg>

              {/* Render the assigned bus */}
              {activeBus && (
                <div
                  style={{
                    left: `${Math.min(Math.max(((activeBus.lng - 78.40) / 0.12) * 80 + 10, 10), 90)}%`,
                    top: `${Math.min(Math.max(((17.45 - activeBus.lat) / 0.08) * 80 + 10, 10), 90)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 transition-all duration-700"
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 shadow-md whitespace-nowrap">
                      Bus {activeBus.busNumber}
                    </div>
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-indigo-600/30">
                      <BusIcon size={20} className="text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Render My Stop */}
              {myStop && (
                <div
                  style={{
                    left: `${Math.min(Math.max(((myStop.lng - 78.40) / 0.12) * 80 + 10, 10), 90)}%`,
                    top: `${Math.min(Math.max(((17.45 - myStop.lat) / 0.08) * 80 + 10, 10), 90)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 transition-all"
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-1 shadow-md whitespace-nowrap">
                      My Stop
                    </div>
                    <div className="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-md"></div>
                  </div>
                </div>
              )}

              {/* Prompt bar */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl backdrop-blur-md pointer-events-none flex items-center gap-2 shadow-xl">
                <MapPin size={14} className="text-amber-400" />
                <span>Click anywhere on radar to place or move <strong>My Stop</strong></span>
              </div>
            </div>
          ) : (
            <APIProvider 
              apiKey={API_KEY}
              onLoad={() => setMapAuthError(false)}
              onError={() => setMapAuthError(true)}
            >
              <Map
                defaultCenter={{ lat: 17.385, lng: 78.486 }}
                defaultZoom={12}
                mapId="PARENT_MAP_VIEWS_ID"
                disableDefaultUI={true}
                onClick={handleMapClick}
              >
                {/* Render the assigned bus */}
                {activeBus && (
                  <AdvancedMarker position={{ lat: activeBus.lat, lng: activeBus.lng }} zIndex={50}>
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-indigo-600/30">
                      <BusIcon size={20} className="text-white" />
                    </div>
                  </AdvancedMarker>
                )}

                {/* Render My Stop */}
                {myStop && (
                  <AdvancedMarker position={myStop} zIndex={40}>
                    <div className="flex flex-col items-center">
                      <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-1 shadow-md whitespace-nowrap">
                        My Stop
                      </div>
                      <div className="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-md"></div>
                    </div>
                  </AdvancedMarker>
                )}
              </Map>
            </APIProvider>
          )}
        </div>
      </div>

      {/* 1 KM Proximity Alert Overlay */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-amber-400"></div>
              
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BellRing size={40} className="text-amber-500 animate-bounce" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-800 mb-2">Bus is Arriving!</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Bus <strong>{activeBus?.busNumber}</strong> is currently less than <strong>1 km</strong> away from your stop. Please get ready!
              </p>
              
              <button 
                onClick={() => setShowAlert(false)} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                Acknowledge
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
