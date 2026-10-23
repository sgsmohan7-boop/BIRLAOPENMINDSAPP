import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Ticket, InventoryItem, Room } from "../types";
import { Box, HelpCircle } from "lucide-react";

interface AnalyticsProps {
  tickets: Ticket[];
  history: Ticket[];
  inventory: InventoryItem[];
  rooms: Room[];
}

export default function Analytics({ tickets, history, inventory, rooms }: AnalyticsProps) {
  
  // 1. Core tallies counts
  const totalAssetsPurchased = inventory.reduce((acc, i) => acc + i.totalQty, 0);
  const lowStockBins = inventory.filter(i => i.category !== "Major Assets" && i.balanceQty < 5).length;
  const activeTicketsTotal = tickets.filter(t => t.status !== "resolved").length;
  const totalLocationsCount = rooms.length;

  // 2. Prepare Category Pie Data
  const categoryTally: Record<string, number> = {};
  inventory.forEach(item => {
    categoryTally[item.category] = (categoryTally[item.category] || 0) + item.totalQty;
  });

  const pieData = Object.entries(categoryTally).map(([name, value]) => ({
    name: name.replace(" (Mouse/Keyboard)", "").replace(" (Switches/Cables)", "").replace(" (RAM/SSD)", ""),
    value
  }));

  const COLORS = ["#3182CE", "#38A169", "#D69E2E", "#E53E3E", "#805AD5"];

  // 3. Prepare Tickets Bar Data
  const openCount = tickets.filter(t => t.status === "open").length;
  const pendingCount = tickets.filter(t => t.status === "pending").length;
  const resolvedCount = history.length;

  const barData = [
    { name: "Strictly Active", count: openCount, fill: "#E53E3E" },
    { name: "Pending", count: pendingCount, fill: "#DD6B20" },
    { name: "Resolved Logs", count: resolvedCount, fill: "#38A169" }
  ];

  return (
    <div id="analytics-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Header bar */}
      <div className="flex pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">📊 REAL-TIME CORE METRICS & ANALYTICS</h2>
          <p className="text-xs text-slate-500 font-medium font-sans">Statistical distribution of stock volumes, resolution ratios, and active bins</p>
        </div>
      </div>

      {/* Top row cards preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-8">
        
        {/* Total Stock Volume */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Total Assets Volume</span>
          <span className="text-2xl font-black text-blue-600 block">{totalAssetsPurchased} units</span>
          <span className="text-[9px] text-[#4299E1] font-bold uppercase block tracking-wider">Across inventory bins</span>
        </div>

        {/* Low Stock count alert */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Low Stock Hardware Bins</span>
          <span className="text-2xl font-black text-rose-500 block">{lowStockBins} Alert</span>
          <span className="text-[9px] text-rose-400 font-bold uppercase block tracking-wider">Balance quantity under 5</span>
        </div>

        {/* Active tickets */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Active Ticketing Desk</span>
          <span className="text-2xl font-black text-[#DD6B20] block">{activeTicketsTotal} Open</span>
          <span className="text-[9px] text-amber-500 font-bold uppercase block tracking-wider">Awaiting technician fixes</span>
        </div>

        {/* Total rooms master log ledger */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Locations Master Ledger</span>
          <span className="text-2xl font-black text-emerald-600 block">{totalLocationsCount} Rooms</span>
          <span className="text-[9px] text-emerald-500 font-bold uppercase block tracking-wider font-sans">Mapped schools layout</span>
        </div>

      </div>

      {/* Charts Grid visualizers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Category Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-slate-900 text-sm tracking-wide border-b pb-3 border-slate-100 uppercase text-xs">
            📊 Stock Category Distribution
          </h3>

          <div className="flex-1 flex items-center justify-center pt-4 relative">
            {pieData.length === 0 ? (
              <span className="text-slate-400 text-xs">No stock datasets registered.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} units`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Legends */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center pt-2 text-[10px] font-bold">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="text-slate-600 font-sans">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets Completion Bar Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-slate-900 text-sm tracking-wide border-b pb-3 border-slate-100 uppercase text-xs">
            📈 Tickets Operational Performance Tracking
          </h3>

          <div className="flex-1 pt-4">
            <ResponsiveContainer width="100%" height="95%">
              <BarChart data={barData} margin={{ top: 10, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => `${value} tickets`} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={45}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
