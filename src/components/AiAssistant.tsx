import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  FileText, 
  Wrench, 
  Layers, 
  AlertTriangle, 
  Copy, 
  Check, 
  BookOpen, 
  ChevronRight, 
  Cpu, 
  ArrowRight,
  Wifi,
  Printer,
  Laptop,
  CheckCircle2,
  Trash2,
  Download
} from "lucide-react";

interface AiAssistantProps {
  tickets: any[];
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

export default function AiAssistant({ tickets }: AiAssistantProps) {
  const [activeTab, setActiveTab] = useState<"copilot" | "tickets" | "sop">("copilot");
  const [loading, setLoading] = useState(false);
  
  // Custom Markdown & Text Formatter Component for rich formatted output
  const ReplyFormatter = ({ text }: { text: string }) => {
    if (!text) return null;

    // Direct parser to replace simple markdown patterns (bullets, bold, lists, code, and warnings)
    const lines = text.split("\n");
    return (
      <div className="space-y-2.5 text-slate-705 dark:text-slate-300 leading-relaxed font-sans text-sm">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          
          // Check for core headers (e.g. ### Header or **Header**)
          if (trimmed.startsWith("###")) {
            return (
              <h4 key={idx} className="text-sm font-bold text-slate-900 dark:text-white capitalize tracking-wide pt-3 border-b border-slate-200/50 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                {trimmed.replace(/###|[*]/g, "").trim()}
              </h4>
            );
          }
          if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
            return (
              <h3 key={idx} className="text-base font-extrabold text-indigo-650 dark:text-indigo-400 capitalize tracking-wide pt-4 pb-1.5 flex items-center gap-1.5 border-b border-indigo-500/10">
                <Sparkles size={14} className="text-indigo-500" />
                {trimmed.replace(/##|#|[*]/g, "").trim()}
              </h3>
            );
          }

          // Check for prominent Warnings
          if (trimmed.toUpperCase().includes("WARNING") || trimmed.toUpperCase().includes("CRITICAL") || trimmed.toUpperCase().includes("CAUTION")) {
            return (
              <div key={idx} className="p-3 bg-red-500/5 dark:bg-red-500/10 border-l-4 border-red-500 rounded-r-xl text-xs flex gap-2.5 text-red-900 dark:text-red-300 my-2 shadow-sm font-semibold">
                <AlertTriangle size={15} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5 animate-pulse" />
                <span>{trimmed.replace(/[*]/g, "")}</span>
              </div>
            );
          }

          // Check for standard Bullet Lists
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const cleanText = trimmed.substring(1).trim();
            // Highlight terms inside standard strong pairs
            return (
              <li key={idx} className="list-none pl-5 relative before:content-[''] before:absolute before:left-1 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-indigo-500/85 text-slate-700 dark:text-slate-300 font-medium">
                {parseInlineBold(cleanText)}
              </li>
            );
          }

          // Check for numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="pl-4 flex items-start gap-2.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  {numMatch[1]}
                </span>
                <span className="flex-1 leading-normal">{parseInlineBold(numMatch[2])}</span>
              </div>
            );
          }

          // Fallback text line
          if (trimmed === "") return <div key={idx} className="h-2" />;
          return <p key={idx} className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{parseInlineBold(trimmed)}</p>;
        })}
      </div>
    );
  };

  // Helper parser for **text** formatting
  const parseInlineBold = (text: string) => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    if (parts.length <= 1) return text;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-extrabold text-slate-900 dark:text-white bg-indigo-500/5 dark:bg-indigo-500/10 px-1 rounded">{part}</strong>;
      }
      return part;
    });
  };

  // --- TAB 1: IT COPILOT STATES & HANDLERS ---
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("sgs_assistant_chat");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch {
        return [];
      }
    }
    return [
      {
        id: "welcome",
        sender: "ai",
        text: "Hello! I am **Gemini**, your AI-powered BI IT Support Specialist. Ask me any question about school tech hardware, WiFi networks, projector setup, printers, or smart devices in classrooms, and I'll draft step-by-step diagnostic procedures instantly.",
        timestamp: new Date()
      }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("sgs_assistant_chat", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendPrompt = async (forcedPrompt?: string) => {
    const textToSend = (forcedPrompt || chatInput).trim();
    if (!textToSend || loading) return;

    if (!forcedPrompt) {
      setChatInput("");
    }

    const userMessage: Message = {
      id: `m-usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/troubleshoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to parse API request.");
      }

      const aiMessage: Message = {
        id: `m-ai-${Date.now()}`,
        sender: "ai",
        text: resData.text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      const errMsg = err.message || "An error occurred while connecting with Gemini.";
      const aiErrorMessage: Message = {
        id: `m-ai-err-${Date.now()}`,
        sender: "ai",
        text: `🔴 **Gemini AI Connection Failed**: ${errMsg}\n\n*Please verify that GEMINI_API_KEY is configured correctly in your Secrets Panel settings.*`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiErrorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear your current conversation history?")) {
      const welcome: Message = {
        id: "welcome",
        sender: "ai",
        text: "Hello again! I am **Gemini**, your AI-powered BI IT Support Specialist. Ask me any question or try one of the instant diagnostic templates below.",
        timestamp: new Date()
      };
      setMessages([welcome]);
    }
  };

  const copilotChips = [
    { label: "🖨️ Printer Offline", prompt: "Explain step-by-step how to troubleshoot a network classroom printer showing as 'offline' or not responding to school print jobs." },
    { label: "🔌 Projector No Signal", prompt: "A teacher in room smart class is getting 'No Signal' on the Epson ceiling projector. Give quick diagnostic steps they can attempt in under 2 minutes." },
    { label: "📶 Slow WiFi Speeds", prompt: "Generate a troubleshooting checklist for a laptop experiencing severe packet loss and extremely slow speed connection on the school's WLAN." },
    { label: "🔊 Smart Board Muted", prompt: "The interactive white-board speakers are not outputting sound when playing video lessons. Give the exact checklist of volume and physical cable points to inspect on Windows/Android." }
  ];

  // --- TAB 2: LIVE TICKET SOLVER STATES ---
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [ticketAnalysisResult, setTicketAnalysisResult] = useState("");
  const [copiedResponse, setCopiedResponse] = useState(false);

  const openTickets = tickets.filter(t => t.status !== "Resolved" && t.status !== "Closed");

  const handleSolveTicket = async () => {
    if (!selectedTicketId || loading) return;
    const ticket = tickets.find(t => t.id === selectedTicketId);
    if (!ticket) return;

    setLoading(true);
    setTicketAnalysisResult("");

    const promptText = `Analyze and provide a highly practical technical repair strategy and resolution copy for this school support ticket:
    
    Ticket ID: ${ticket.id}
    Device Category: ${ticket.category}
    Equipment Name/Identifier: ${ticket.deviceName || "Not Specific"}
    Location / Classroom: ${ticket.roomName || "Unassigned"}
    Issue Declared: ${ticket.issue}
    Urgency Priority: ${ticket.priority}
    Reported On: ${ticket.date || "Unknown"}
    
    Include:
    1. **Primary Diagnosis**: What is the most probable cause of this hardware/software error?
    2. **Technician STEP-BY-STEP Fix Checklist**: Clear chronological checklists that a junior IT Technician can follow to diagnose and solve this problem on-site.
    3. **Spare Parts or Tools Needed**: Any specific tools (e.g., RJ45 crimper, HDMI tester) or replacement hardware required.
    4. **Polite Update Remarks and Actions**: Draft a perfect copy-pasteable professional update message (or closing comment) that is customized for this school branch environment to send back to the frustrated teacher.`;

    try {
      const response = await fetch("/api/ai/troubleshoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: promptText,
          systemInstruction: "You are an expert school infrastructure IT architect. Provide professional, highly structured, and clear step-by-step diagnostic guidelines for resolving high-priority school equipment issues. Highlight technical warnings and use clear section subdivisions."
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to connect with Gemini model.");
      }
      setTicketAnalysisResult(resData.text);
    } catch (err: any) {
      setTicketAnalysisResult(`🔴 **AI Analysis Failure**: ${err.message || "Unknown server response."}\n\nPlease check your key credentials or network connection.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTicketResolution = () => {
    if (!ticketAnalysisResult) return;
    navigator.clipboard.writeText(ticketAnalysisResult);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // --- TAB 3: SOP PREVENTIVE GENERATOR STATES ---
  const [sopCategory, setSopCategory] = useState("Hardware Maintenance");
  const [sopHardwareType, setSopHardwareType] = useState("Interactive Projector");
  const [sopResult, setSopResult] = useState("");
  const [copiedSop, setCopiedSop] = useState(false);

  const handleGenerateSop = async () => {
    if (loading) return;
    setLoading(true);
    setSopResult("");

    const promptText = `Generate a highly professional Standard Operating Procedure (SOP) Document for Preventive Maintenance inside a modern school environment.
    
    Category Area: ${sopCategory}
    Equipment/System Target: ${sopHardwareType}
    School Branch context: Birla Open Minds International School Support Service Team
    
    Please output a complete, publication-ready SOP layout detailing:
    1. **SOP Identifier / Header**: Create a unique ID (e.g., PM-BI-${sopHardwareType.replace(/\s+/g, "").slice(0, 5).toUpperCase()}) and operational scope.
    2. **Required Tools and Protective/Safety Gear**.
    3. **Frequency Schedule**: (Weekly, Monthly, or Quarterly actions).
    4. **Phase-by-Phase Preventive Checklist**: (Visual inspection, hardware cleaning, diagnostic software checks, performance measurements).
    5. **Critical Safety Warns**: Essential warning guidelines (e.g. electrical shock, laser lens caution, proper static grounding).
    6. **Checklist Sign-off sheet structure**: Draft a sign-off register pattern.`;

    try {
      const response = await fetch("/api/ai/troubleshoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: promptText,
          systemInstruction: "You are the chief Chief Technical Officer of Birla Open Minds International School. Draft formal, meticulous, and strict standardized engineering guides or SOP sheets for hardware and infrastructure safety. Maintain a rigorous technical standard."
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to communicate with model.");
      }
      setSopResult(resData.text);
    } catch (err: any) {
      setSopResult(`🔴 **SOP Drafting failed**: ${err.message || "Unknown error."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySop = () => {
    if (!sopResult) return;
    navigator.clipboard.writeText(sopResult);
    setCopiedSop(true);
    setTimeout(() => setCopiedSop(false), 2000);
  };

  return (
    <div id="ai-assistant-panel" className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">
      
      {/* Upper header section */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shadow-sm shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-700 p-0.5 shadow-md shadow-indigo-500/10 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-400">
              <Bot size={22} className="animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase font-mono">
                AI Troubleshooting Copilot
              </h2>
              <span className="px-2 py-0.5 bg-indigo-505/10 dark:bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-black tracking-wider rounded-md uppercase">
                Gemini Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Leverage artificial intelligence to diagnose school assets, resolve tickets, and draft preventive SOP manuals.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 shrink-0 select-none">
          <button
            onClick={() => setActiveTab("copilot")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "copilot"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-250 dark:border-slate-700/60"
                : "text-slate-500 hover:text-slate-250 dark:hover:text-slate-300"
            }`}
          >
            <Sparkles size={14} />
            <span>IT Copilot Chat</span>
          </button>
          
          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "tickets"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-250 dark:border-slate-700/60"
                : "text-slate-500 hover:text-slate-250 dark:hover:text-slate-300"
            }`}
          >
            <Wrench size={14} />
            <span>Ticket Resolution Solver</span>
            {openTickets.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-black text-[9px] flex items-center justify-center">
                {openTickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("sop")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "sop"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-250 dark:border-slate-700/60"
                : "text-slate-500 hover:text-slate-250 dark:hover:text-slate-300"
            }`}
          >
            <BookOpen size={14} />
            <span>SOP Preventative Generator</span>
          </button>
        </div>
      </div>

      {/* Primary Section Canvas */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* TAB 1 CONTENT: IT COPILOT CHAT */}
        {activeTab === "copilot" && (
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* Messages Display */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/20">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-3.5 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div className={`w-8 h-8 rounded-xl shrink-0 border flex items-center justify-center text-sm ${
                    msg.sender === "user" 
                      ? "bg-slate-100 dark:bg-slate-800 border-slate-250 dark:border-slate-700 text-slate-700 dark:text-slate-300" 
                      : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-150 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400"
                  }`}>
                    {msg.sender === "user" ? <User size={14} /> : <Bot size={14} />}
                  </div>

                  <div className={`p-4 rounded-2xl shadow-sm border ${
                    msg.sender === "user" 
                      ? "bg-slate-900 border-slate-800 text-white rounded-tr-none" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 rounded-tl-none"
                  }`}>
                    <ReplyFormatter text={msg.text} />
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-2 block text-right font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3.5 mr-auto max-w-[85%]">
                  <div className="w-8 h-8 rounded-xl shrink-0 bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 animate-spin-slow">
                    <RefreshCw size={14} />
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                    <span className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600/40 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600/60 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">Gemini AI is analyzing diagnostic maps...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Prompt Template Quick Chips */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <span className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider block mb-2">
                ⚡ RAPID-FIRE DIAGNOSTICS & HELP CHECKS:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar shrink-0 select-none">
                {copilotChips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendPrompt(chip.prompt)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form Box */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendPrompt(); }}
              className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear current convo history"
                className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-100 dark:border-red-900/40 hover:border-red-300 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Trash2 size={16} />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Gemini about school IT issues (e.g. Epson indicator lights, WiFi channels, smart classroom setup)..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-900 dark:text-white transition-all disabled:opacity-50"
              />
              
              <button
                type="submit"
                disabled={!chatInput.trim() || loading}
                className="px-5 py-3 bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all select-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] shrink-0"
              >
                <span>Draft SOP</span>
                <Send size={12} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2 CONTENT: TICKET RESOLUTION SOLVER */}
        {activeTab === "tickets" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col h-full lg:flex-row gap-6">
            
            {/* Left sidebar: Select ticket */}
            <div className="w-full lg:w-96 flex flex-col shrink-0 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600">
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white font-mono tracking-wider">
                      Select Active Ticket
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Pick any reported issue from classrooms or labs
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500">Pick Ticket:</label>
                  <select
                    value={selectedTicketId}
                    onChange={(e) => setSelectedTicketId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="">-- Choose open ticket context --</option>
                    {openTickets.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.status || "PENDING"}] {t.id} - {t.roomName || "Unassigned"} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTicketId ? (
                  (() => {
                    const ticket = tickets.find(t => t.id === selectedTicketId);
                    if (!ticket) return null;
                    return (
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 space-y-3.5 animate-fade-in text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                          <span className="font-extrabold text-slate-900 dark:text-white capitalize font-mono text-sm">{ticket.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border select-none ${
                            ticket.priority === "High" || ticket.priority === "Critical"
                              ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"
                              : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
                          }`}>
                            {ticket.priority || "Normal"} Priority
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-slate-650 dark:text-slate-400">
                          <div>
                            <span className="font-bold text-slate-450 dark:text-slate-500 uppercase text-[9px] block">Location:</span>
                            <span className="font-semibold text-slate-850 dark:text-slate-200">{ticket.roomName || "Not assigned"}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-450 dark:text-slate-500 uppercase text-[9px] block">Equipment / Item:</span>
                            <span className="font-semibold text-slate-850 dark:text-slate-200">{ticket.deviceName || "General Area / Facility"}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-450 dark:text-slate-500 uppercase text-[9px] block">Reported Problem:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200">{ticket.issue}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-450 dark:text-slate-500 uppercase text-[9px] block">Reporter ID:</span>
                            <span className="font-semibold text-slate-850 dark:text-slate-300 font-mono text-[11px]">{ticket.employeeEmail || "BI Staff Member"}</span>
                          </div>
                        </div>

                        <button
                          onClick={handleSolveTicket}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wide rounded-xl transition-all shadow-md cursor-pointer active:scale-[0.98]"
                        >
                          <Cpu size={14} />
                          <span>Generate Repair Guide</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-6 bg-slate-50/50 dark:bg-slate-950/20 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <span className="text-3xl filter saturate-50 block mb-2 opacity-60">📋</span>
                    <p className="text-xs text-slate-400 font-bold">Please select an open ticket from the list above to diagnostic-map custom solutions.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right block: Solution Details */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[400px]">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
                    <Wrench size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white font-mono tracking-wider">
                      Technician Repair Protocol Sheet
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Step-by-step diagnostic and closing copy drafted by Gemini AI
                    </p>
                  </div>
                </div>

                {ticketAnalysisResult && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyTicketResolution}
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none border border-slate-250 dark:border-slate-705"
                      title="Copy sheet markdown content"
                    >
                      {copiedResponse ? (
                        <>
                          <Check size={14} className="text-emerald-500" />
                          <span className="text-[10px]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span className="text-[10px]">Copy Strategy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Resolution Container */}
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-505/20 flex items-center justify-center text-indigo-500 animate-spin">
                      <RefreshCw size={24} />
                    </div>
                    <p className="text-xs text-slate-400 font-bold font-mono animate-pulse">Engaging Gemini Deep Diagnosis engine...</p>
                  </div>
                ) : ticketAnalysisResult ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 text-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <div>
                        <p className="font-bold">Protocol Generated Successfully</p>
                        <p className="font-medium opacity-90 text-[11px] mt-0.5">Use the step-by-step points below to isolate physical wires, reset device firmware, and copy concluding updates for teachers.</p>
                      </div>
                    </div>
                    
                    <ReplyFormatter text={ticketAnalysisResult} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 dark:bg-slate-950/5 rounded-xl border-2 border-dashed border-slate-150 dark:border-slate-850">
                    <span className="text-4xl filter saturate-50 block mb-3 opacity-75">🔬</span>
                    <h5 className="text-xs font-extrabold text-[#7F8EA3] uppercase tracking-wide">Diagnosis Console Standby</h5>
                    <p className="max-w-xs text-slate-400 text-[11px] font-bold mt-1">Select an active ticket from the left panel and click 'Generate Repair Guide' to draft actionable diagnostic checkpoints.</p>
                  </div>
                )}
              </div>

              {/* Resolution footer info */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono shrink-0">
                <span>MODEL: GEMINI-3.5-FLASH</span>
                <span>SYSTEM VERSION 2.1.0</span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3 CONTENT: SOP PREVENTIVE MAINTENANCE GENERATOR */}
        {activeTab === "sop" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col h-full lg:flex-row gap-6">
            
            {/* Left Parameters form box */}
            <div className="w-full lg:w-96 flex flex-col shrink-0 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-505/25 flex items-center justify-center text-indigo-500">
                    <BookOpen size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white font-mono tracking-wider">
                      PM Profile Config
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Customize preventative maintenance sheet details
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500">Service Category:</label>
                    <select
                      value={sopCategory}
                      onChange={(e) => setSopCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="Hardware Maintenance">Classroom Hardware Maintenance</option>
                      <option value="Network Infrastructure Check">Network Infrastructure Check</option>
                      <option value="Audio-Visual Integration">Audio-Visual Integration</option>
                      <option value="System Backup & Database audit">System Backup & Database audit</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500">Target Equipment Model:</label>
                    <select
                      value={sopHardwareType}
                      onChange={(e) => setSopHardwareType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="Interactive LCD Projector">Epson Interactive LCD Projector</option>
                      <option value="Network Laser printer">School Office Laser Network Printer</option>
                      <option value="Classroom Wireless Access Point">Aruba WiFi Classroom Access Point</option>
                      <option value="Lab Smart Laptop Hub">Computer Lab Smart Laptop Hubs</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerateSop}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-505 text-white font-black text-xs uppercase tracking-wide rounded-xl transition-all shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    <Layers size={14} />
                    <span>Generate Standard SOP</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Safety banner warning */}
              <div className="p-4 bg-amber-500/5 dark:bg-amber-550/10 rounded-2xl border border-amber-500/20 text-xs text-amber-900 dark:text-amber-400 space-y-1.5 leading-relaxed font-semibold">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                  <AlertTriangle size={15} className="animate-pulse" /> Safety Standard Guideline
                </p>
                <p className="text-[10px]">
                  All preventive checklists drafted by Gemini AI are meant as standard maintenance procedures. Ensure you shut off master electricity inputs before handling live cabling panels or projector capacitors.
                </p>
              </div>
            </div>

            {/* Right block: SOP Content sheet */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-905 border border-slate-205 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[400px]">
              
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-505/25 flex items-center justify-center text-indigo-500">
                    <BookOpen size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white font-mono tracking-wider">
                      Preventive SOP Checklist Sheet
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Formal technical operating checklists for classroom equipment
                    </p>
                  </div>
                </div>

                {sopResult && (
                  <button
                    onClick={handleCopySop}
                    className="p-2 bg-slate-101 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none border border-slate-250 dark:border-slate-705"
                    title="Copy SOP markdown"
                  >
                    {copiedSop ? (
                      <>
                        <Check size={14} className="text-emerald-500" />
                        <span className="text-[10px]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="text-[10px]">Copy Manual</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* SOP Result container */}
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-505/20 flex items-center justify-center text-indigo-505 animate-spin">
                      <RefreshCw size={24} />
                    </div>
                    <p className="text-xs text-slate-400 font-bold font-mono animate-pulse">Drafting standard operating engineering procedures...</p>
                  </div>
                ) : sopResult ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex gap-3 text-indigo-900 dark:text-indigo-400 text-xs font-semibold">
                      <CheckCircle2 size={16} className="shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                      <div>
                        <p className="font-bold">SOP Standard Document Drafted Successfully</p>
                        <p className="font-medium opacity-90 text-[11px] mt-0.5">Please export, duplicate, or catalog this document inside the school branch files. Standardize the recurring routines for technicians.</p>
                      </div>
                    </div>
                    
                    <ReplyFormatter text={sopResult} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 dark:bg-slate-950/5 rounded-xl border-2 border-dashed border-slate-150 dark:border-slate-850">
                    <span className="text-4xl filter saturate-50 block mb-3 opacity-75">📚</span>
                    <h5 className="text-xs font-extrabold text-[#7F8EA3] uppercase tracking-wide">Standard SOP Module Standby</h5>
                    <p className="max-w-xs text-slate-400 text-[11px] font-bold mt-1 font-sans">Select target school equipment parameters on the left and click 'Generate Standard SOP' to draft technical preventive maintenance schedules.</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono shrink-0">
                <span>MODEL: GEMINI-3.5-FLASH</span>
                <span>SOP REVISION ID: BI-2026-v2</span>
              </div>
            </div>

          </div>
        )}

      </div>
      
    </div>
  );
}
