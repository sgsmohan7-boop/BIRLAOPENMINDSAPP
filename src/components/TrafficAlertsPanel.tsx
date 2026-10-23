import React, { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Navigation, Clock, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TrafficAlert {
  id: string;
  routeId: string;
  routeName: string;
  severity: "High" | "Moderate" | "Low";
  segment: string;
  delayStr: string;
  detourSuggestion: string;
}

const SIMULATED_TRAFFIC_DATA: TrafficAlert[] = [
  {
    id: "TA-101",
    routeId: "R1",
    routeName: "Route A - City Center",
    severity: "High",
    segment: "MG Road Intersection",
    delayStr: "+12 mins",
    detourSuggestion: "Divert via Tank Bund Road to avoid major congestion."
  },
  {
    id: "TA-102",
    routeId: "R2",
    routeName: "Route C - East View",
    severity: "Moderate",
    segment: "Uppal Ring Road",
    delayStr: "+5 mins",
    detourSuggestion: "Use the flyover bypass if possible."
  },
  {
    id: "TA-103",
    routeId: "R3",
    routeName: "Route B - North Hills",
    severity: "Low",
    segment: "Jubilee Hills Checkpost",
    delayStr: "+2 mins",
    detourSuggestion: "Slight slow moving traffic. Maintain current route."
  }
];

export default function TrafficAlertsPanel() {
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("Never");

  const pollTrafficAPI = async () => {
    setIsPolling(true);
    
    // Simulate API network request to a traffic provider (e.g. Google Maps Traffic API)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Randomize some data for the simulation
    const shuffled = [...SIMULATED_TRAFFIC_DATA].sort(() => 0.5 - Math.random());
    const numAlerts = Math.floor(Math.random() * 3) + 1; // 1 to 3 alerts
    
    setAlerts(shuffled.slice(0, numAlerts));
    setLastUpdated(new Date().toLocaleTimeString());
    setIsPolling(false);
  };

  useEffect(() => {
    // Initial poll
    pollTrafficAPI();
    
    // Poll every 15 seconds
    const interval = setInterval(pollTrafficAPI, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Activity size={14} className="text-amber-500" />
          Live Traffic Analysis
        </div>
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          {isPolling ? (
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
              Polling API...
            </span>
          ) : (
            <span>Updated: {lastUpdated}</span>
          )}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {alerts.length === 0 && !isPolling && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center text-slate-500 text-sm border border-dashed border-slate-700/50 rounded-xl">
            No congested segments detected. All routes clear.
          </motion.div>
        )}

        {alerts.map(alert => (
          <motion.div
            key={alert.id}
            layout
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`p-3 rounded-xl border relative overflow-hidden group ${
              alert.severity === 'High' ? 'bg-red-500/10 border-red-500/30' : 
              alert.severity === 'Moderate' ? 'bg-amber-500/10 border-amber-500/30' : 
              'bg-blue-500/10 border-blue-500/30'
            }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              alert.severity === 'High' ? 'bg-red-500' : 
              alert.severity === 'Moderate' ? 'bg-amber-500' : 
              'bg-blue-500'
            }`} />
            
            <div className="pl-3">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sm text-slate-200">{alert.routeName}</h4>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                  alert.severity === 'High' ? 'bg-red-500 text-white' : 
                  alert.severity === 'Moderate' ? 'bg-amber-500 text-slate-900' : 
                  'bg-blue-500 text-white'
                }`}>
                  <Clock size={10} /> {alert.delayStr}
                </span>
              </div>
              
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 flex items-start gap-1.5">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-tight">Congestion at <strong className="text-slate-300">{alert.segment}</strong></span>
                </p>
                <div className="bg-slate-900/50 p-2 rounded-lg text-xs flex items-start gap-1.5 mt-2 border border-slate-700/50">
                  <Navigation size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 leading-tight">
                    <strong className="text-emerald-400 font-semibold mr-1">Detour:</strong> 
                    {alert.detourSuggestion}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
