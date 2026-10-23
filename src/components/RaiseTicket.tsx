import React, { useState, useEffect } from "react";
import { PlusCircle, Info, ShieldCheck, Ticket } from "lucide-react";
import { Ticket as TicketType, Room, Priority, getNextTicketId, getNowFormatted } from "../types";

interface RaiseTicketProps {
  rooms: Room[];
  tickets: TicketType[];
  history: TicketType[];
  updateTickets: (tkts: TicketType[]) => void;
  jumpToTab: (tab: string) => void;
}

export default function RaiseTicket({ rooms, tickets, history, updateTickets, jumpToTab }: RaiseTicketProps) {
  const [staffName, setStaffName] = useState("");
  const [actualIssue, setActualIssue] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("LB Nagar Branch");
  const [priority, setPriority] = useState<Priority>("Medium");

  // Sync building block when a room is chosen
  useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room && room.building) {
        setSelectedBuilding(room.building);
      }
    }
  }, [selectedRoomId, rooms]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !actualIssue.trim() || !mobile.trim()) {
      alert("All fields are mandatory including staff name, reported problem, and contact mobile!");
      return;
    }

    const linkedRoomObj = rooms.find(r => r.id === selectedRoomId);
    const linkedRoomStr = linkedRoomObj 
      ? `${linkedRoomObj.school} - ${linkedRoomObj.dept} - ${linkedRoomObj.roomNumber} (${linkedRoomObj.className})`
      : "No Room Link";

    const finalBuilding = linkedRoomObj ? (linkedRoomObj.building || "LB Nagar Branch") : selectedBuilding;

    const nowStr = getNowFormatted();

    const tktId = getNextTicketId(tickets, history);

    const newTicket: TicketType = {
      id: tktId,
      issue: `[${staffName.trim()}] ${actualIssue.trim()}`,
      staffName: staffName.trim(),
      actualIssue: actualIssue.trim(),
      mobile: mobile.trim(),
      priority,
      status: "open",
      linkedRoom: linkedRoomStr,
      building: finalBuilding,
      date: nowStr
    };

    updateTickets([newTicket, ...tickets]);

    // Reset Form Input
    setStaffName("");
    setActualIssue("");
    setMobile("");
    setSelectedRoomId("");
    setSelectedBuilding("LB Nagar Branch");
    setPriority("Medium");

    alert(`Ticket raised successfully for ${finalBuilding}! Now viewing active queue desks.`);
    jumpToTab("dashboard");
  };

  return (
    <div id="raise-ticket-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Header bar */}
      <div className="flex pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">➕ RAISE SUPPORT REQUEST TICKET</h2>
          <p className="text-xs text-slate-500 font-medium">Dispatch work logs directly into live technician dashboard queues instantly</p>
        </div>
      </div>

      <div className="my-8 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          
          <div className="bg-[#38A169] text-white p-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold font-sans">New IT Support Case Sheet</h3>
              <p className="text-xs text-emerald-100 font-medium leading-none mt-1">Submit operational anomalies and hardware failures</p>
            </div>
            <Ticket size={28} className="text-emerald-50" />
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            
            {/* Staff name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Requester Staff Name
              </label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="E.g. Santhosh Kumar, Prasad Sir"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Mobile Contact */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Requester Mobile Contact
              </label>
              <input
                type="text"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="E.g. 9876543210 (Direct WhatsApp dispatch)"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            {/* Identified Building Block Location */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                🏫 Verified Building Block Location (Select Building)
              </label>
              <select
                required
                value={selectedBuilding}
                onChange={(e) => {
                  setSelectedBuilding(e.target.value);
                  setSelectedRoomId(""); // Reset room when building changes
                }}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer mb-2"
              >
                <option value="LB Nagar Branch">🏢 LB Nagar Branch</option>

              </select>
            </div>

             {/* Select School Room master */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Linked Work Room Compartment
              </label>
              <select
                required
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-850 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="">Select registered room compartment...</option>
                {rooms
                  .filter(r => (r.building || 'LB Nagar Branch') === selectedBuilding)
                  .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.school} Branch | 🏢 LB Nagar Branch — Room {r.roomNumber} ({r.className})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                If room is not listed, register the layout inside the <strong className="font-semibold text-slate-600">Room Master</strong> panel first under permissions.
              </p>
            </div>

            {/* Describe Issue detail */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Detailed Issue Description
              </label>
              <textarea
                required
                value={actualIssue}
                onChange={(e) => setActualIssue(e.target.value)}
                placeholder="Describe flickering monitors, stuck keys, network switches offline details..."
                rows={4}
                className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Priority Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Critical Severity Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["High", "Medium", "Low"] as Priority[]).map((p) => {
                  const isChecked = priority === p;
                  const btnClass = isChecked 
                    ? p === "High" 
                      ? "bg-rose-50 border-rose-500 text-rose-700"
                      : p === "Medium"
                        ? "bg-amber-50 border-amber-500 text-amber-700"
                        : "bg-emerald-50 border-emerald-500 text-emerald-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100";

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-3 border rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer select-none ${btnClass}`}
                    >
                      {p === "High" ? "🔴 HIGH" : p === "Medium" ? "🟡 MEDIUM" : "🟢 LOW"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3.5 bg-[#38A169] hover:bg-emerald-600 text-white rounded-xl text-sm font-bold tracking-wider shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle size={18} />
                DISPATCH TICKET TO ACTIVE QUEUE
              </button>
            </div>

          </form>

        </div>
      </div>

    </div>
  );
}
