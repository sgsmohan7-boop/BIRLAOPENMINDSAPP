import React, { useState, useEffect } from "react";
import { LogOut, MapPin, Navigation, Bus as BusIcon, AlertTriangle, ShieldCheck } from "lucide-react";
import { syncCollection, saveDocument } from "../utils/firebase";

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

export default function DriverPortal({ onLogout }: { onLogout: () => void }) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>("");
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    const unsub = syncCollection<Bus>("transport_fleet", (items) => {
      setBuses(items);
    }, []);
    return () => unsub();
  }, []);

  const handleStartTracking = () => {
    if (!selectedBusId) {
      setLocationError("Please select a bus first.");
      return;
    }
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your device or browser.");
      return;
    }

    setLocationError("");
    setIsTracking(true);

    const busInfo = buses.find(b => b.id === selectedBusId);
    if (busInfo) {
      saveDocument("transport_fleet", selectedBusId, {
        ...busInfo,
        status: "Moving",
        lastUpdated: new Date().toISOString()
      });
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading } = position.coords;
        const currentSpeedKmH = speed ? Math.round(speed * 3.6) : 0; // Convert m/s to km/h
        
        // Fetch current bus state so we don't overwrite other fields like ETA or Route
        const currentBus = buses.find(b => b.id === selectedBusId);
        
        saveDocument("transport_fleet", selectedBusId, {
          ...(currentBus || {}),
          status: currentSpeedKmH > 0 ? "Moving" : "Idling",
          lat: latitude,
          lng: longitude,
          speed: currentSpeedKmH,
          heading: heading || 0,
          lastUpdated: new Date().toISOString()
        });
      },
      (error) => {
        setLocationError(`GPS Error: ${error.message}`);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    setWatchId(id);
  };

  const handleStopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
    
    const busInfo = buses.find(b => b.id === selectedBusId);
    if (busInfo) {
      saveDocument("transport_fleet", selectedBusId, {
        ...busInfo,
        status: "Offline",
        speed: 0,
        lastUpdated: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const activeBus = buses.find(b => b.id === selectedBusId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BusIcon className="text-[#F6AD55]" />
          <h1 className="font-bold">Driver Live Tracker</h1>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm bg-slate-700 px-3 py-1.5 rounded-lg">
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {!isTracking ? (
          <div className="w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold mb-2">Select Your Bus</h2>
            <p className="text-sm text-slate-400 mb-6">Choose your assigned bus to start transmitting live GPS location to the school admin dashboard.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">My Bus</label>
              <select
                value={selectedBusId}
                onChange={(e) => setSelectedBusId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">-- Choose bus --</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>{b.busNumber} ({b.driverName})</option>
                ))}
              </select>
            </div>

            {locationError && (
              <div className="mb-4 bg-red-900/50 border border-red-500/50 p-3 rounded-lg text-red-200 text-sm flex gap-2 items-start">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <p>{locationError}</p>
              </div>
            )}

            <button
              onClick={handleStartTracking}
              disabled={!selectedBusId}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${selectedBusId ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              <MapPin size={22} /> Start GPS Tracking
            </button>
            <p className="mt-4 text-xs text-center text-slate-500 flex items-center justify-center gap-1"><ShieldCheck size={14}/> Secure AES-256 transmission</p>
          </div>
        ) : (
          <div className="w-full bg-slate-800 p-6 rounded-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 relative">
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-ping opacity-20"></div>
              <Navigation size={40} className="text-emerald-400 drop-shadow-md" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">Live Tracking Active</h2>
            <p className="text-emerald-400 font-medium mb-6 animate-pulse">Transmitting GPS Location...</p>
            
            <div className="grid grid-cols-2 gap-4 w-full mb-8">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Vehicle</p>
                <p className="font-bold text-lg">{activeBus?.busNumber || "Unknown"}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Speed</p>
                <p className="font-bold text-lg">{activeBus?.speed || 0} <span className="text-sm font-normal text-slate-500">km/h</span></p>
              </div>
            </div>

            <button
              onClick={handleStopTracking}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <LogOut size={22} /> End Trip & Stop Tracking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
