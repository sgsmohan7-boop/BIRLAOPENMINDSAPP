import React, { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, MapPin, User, Route as RouteIcon, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isFirebaseConfigured, syncCollection, saveDocument, deleteDocument, isFirestoreQuotaExhausted } from "../utils/firebase";

export interface BusRoute {
  id: string;
  routeName: string;
  driverName: string;
  pickupPoints: string[];
}

const DEFAULT_ROUTES: BusRoute[] = [
  {
    id: "R1",
    routeName: "Route A - City Center",
    driverName: "Ramesh K.",
    pickupPoints: ["Central Station", "MG Road", "Jubilee Hills", "School Campus"]
  },
  {
    id: "R2",
    routeName: "Route C - East View",
    driverName: "Mahesh V.",
    pickupPoints: ["Secunderabad", "Tarnaka", "Uppal", "School Campus"]
  }
];

export default function BusRouteManager() {
  const [routes, setRoutes] = useState<BusRoute[]>(DEFAULT_ROUTES);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ routeName: string; driverName: string; pickupPointsText: string }>({
    routeName: "",
    driverName: "",
    pickupPointsText: ""
  });

  useEffect(() => {
    let unsubscribe = () => {};
    if (isFirebaseConfigured()) {
      unsubscribe = syncCollection<BusRoute>("transport_routes", (items) => {
        if (items && items.length > 0) {
          setRoutes(items);
        } else {
          setRoutes(DEFAULT_ROUTES);
        }
      }, DEFAULT_ROUTES);
    }
    return () => unsubscribe();
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ routeName: "", driverName: "", pickupPointsText: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (route: BusRoute) => {
    setEditingId(route.id);
    setFormData({
      routeName: route.routeName || "",
      driverName: route.driverName || "",
      pickupPointsText: Array.isArray(route.pickupPoints) ? route.pickupPoints.join("\n") : ""
    });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!formData.routeName.trim()) return;

    const points = (formData.pickupPointsText || "")
      .split("\n")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const newRoute: BusRoute = {
      id: editingId || `RT-${Date.now()}`,
      routeName: formData.routeName,
      driverName: formData.driverName,
      pickupPoints: points,
    };

    if (isFirebaseConfigured()) {
      saveDocument("transport_routes", newRoute.id, newRoute);
    } else {
      if (editingId) {
        setRoutes(prev => prev.map(r => r.id === editingId ? newRoute : r));
      } else {
        setRoutes(prev => [...prev, newRoute]);
      }
    }

    setIsFormOpen(false);
  };

  const handleDelete = (id: string) => {
    if (isFirebaseConfigured()) {
      deleteDocument("transport_routes", id);
    } else {
      setRoutes(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Actions */}
      {!isFormOpen && (
        <button
          onClick={openAddForm}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg"
        >
          <Plus size={16} /> Add Route
        </button>
      )}

      {/* Form Area */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4 mb-2 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <RouteIcon size={16} className="text-emerald-500" />
                  {editingId ? "Edit Route" : "New Route"}
                </h3>
                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Route Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Route B - South Hills"
                    value={formData.routeName}
                    onChange={e => setFormData(p => ({ ...p, routeName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Assigned Driver</label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh P."
                    value={formData.driverName}
                    onChange={e => setFormData(p => ({ ...p, driverName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Pickup Points (1 per line)</label>
                  <textarea
                    rows={4}
                    placeholder={`Station 1\nStation 2\nSchool`}
                    value={formData.pickupPointsText}
                    onChange={e => setFormData(p => ({ ...p, pickupPointsText: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-y custom-scrollbar"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={!formData.routeName.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg font-bold text-sm tracking-wide shadow flex items-center justify-center gap-2 transition-colors"
                >
                  <Save size={16} /> {editingId ? "Update Route" : "Save Route"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Routes List */}
      <div className="space-y-3">
        {routes.length === 0 && !isFormOpen && (
          <div className="p-6 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
            No routes available.
          </div>
        )}
        
        {routes.map(route => (
          <motion.div
            key={route.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-md group transition-colors hover:border-slate-600"
          >
            <div className="p-3 border-b border-slate-700/50 flex justify-between items-start">
              <div>
                <h4 className="font-bold text-emerald-400 text-sm leading-tight mb-1">{route.routeName}</h4>
                <div className="flex items-center text-xs text-slate-400 gap-1 mt-1">
                  <User size={12} /> {route.driverName || "Unassigned"}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditForm(route)}
                  className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-900 rounded-md transition-colors"
                  title="Edit Route"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(route.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 rounded-md transition-colors"
                  title="Delete Route"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {route.pickupPoints.length > 0 && (
              <div className="p-3 bg-[#0f172a] bg-opacity-40">
                <div className="flex flex-col relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-700">
                  {route.pickupPoints.map((point, index) => (
                    <div key={index} className="flex gap-3 items-start relative mb-2 last:mb-0">
                      <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center shrink-0 z-10">
                        <MapPin size={10} className="text-emerald-400" />
                      </div>
                      <span className="text-xs text-slate-300 pt-1 leading-snug">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

    </div>
  );
}
