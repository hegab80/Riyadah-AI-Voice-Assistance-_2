import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Server, Calendar, Activity, AlertCircle, Building, Wifi, Radio, Mail, CheckCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { useGeminiLive } from './hooks/useGeminiLive';
import Visualizer from './components/Visualizer';
import { ActionLog, ConnectionState } from './types';
import { GOOGLE_SHEETS_WEBHOOK_URL } from './constants';

const App: React.FC = () => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleAction = (action: ActionLog) => {
    setLogs(prev => [...prev, action]);
  };

  const { connect, disconnect, connectionState, isTalking, volume } = useGeminiLive({ onAction: handleAction });

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // AUTOMATION LOGIC: Watch for pending logs and simulate sending
  useEffect(() => {
    const pendingLogs = logs.filter(log => log.status === 'pending');

    pendingLogs.forEach(log => {
        // Mark as sending immediately to prevent double-processing
        setLogs(currentLogs => 
            currentLogs.map(l => l.id === log.id ? { ...l, status: 'sending' } : l)
        );

        // 1. Simulate Email Backend API Call
        console.log("Mock Backend: Sending email...", log.emailDraft); 

        // 2. Sync to Google Sheets (if URL is provided)
        if (GOOGLE_SHEETS_WEBHOOK_URL) {
            console.log("Syncing to Google Sheets...");
            const sheetData = {
                type: log.type,
                title: log.title,
                details: log.details,
                timestamp: new Date().toISOString()
            };

            // CRITICAL FIX: Use text/plain for Google Apps Script Webhooks to avoid CORS preflight issues
            fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(sheetData),
                keepalive: true, // Ensures request completes even if component unmounts
                credentials: 'omit',
                cache: 'no-cache'
            }).then(() => {
                 console.log("Sheet sync request sent.");
            }).catch(err => console.error("Sheet sync failed", err));
        } else {
            console.log("Google Sheets URL not configured. Skipping sync.");
        }

        // Simulate network delay for the "processing" effect
        setTimeout(() => {
            setLogs(currentLogs => 
                currentLogs.map(l => l.id === log.id ? { ...l, status: 'success' } : l)
            );
        }, 2000); 
    });

  }, [logs]);

  const isActive = connectionState === ConnectionState.CONNECTED;

  const handleToggleConnection = () => {
    if (isActive) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 md:p-8">
      
      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Building className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Riyadah Virtual Assistant</h1>
            <p className="text-slate-400 text-sm">Infrastructure • Solutions • Supply</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400">
           <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
           {connectionState}
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        
        {/* Left Column: Assistant Interface */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Visualizer Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl flex-grow flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full h-48 md:h-64 z-10">
              <Visualizer isActive={isActive} volume={volume} isAgentTalking={isTalking} />
            </div>

            <div className="mt-6 z-10 text-center">
              <h2 className="text-2xl font-semibold mb-2">
                {isActive 
                  ? (isTalking ? "Speaking..." : "Listening...") 
                  : "Ready to assist"}
              </h2>
              <p className="text-slate-400 max-w-md mx-auto">
                {isActive 
                  ? "Ask about UPS maintenance, Rentals, Indoor Navigation, or Support." 
                  : "Connect to start a voice session with our AI agent."}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
             <button
                onClick={handleToggleConnection}
                className={`flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all transform hover:scale-105 shadow-lg ${
                  isActive 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
             >
                {isActive ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                {isActive ? 'End Session' : 'Start Conversation'}
             </button>
          </div>

        </div>

        {/* Right Column: Live Actions & Status */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl flex flex-col overflow-hidden h-[500px] lg:h-auto">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Live Actions
            </h3>
            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded-full">{logs.length} events</span>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-hide">
             {logs.length === 0 && (
               <div className="text-center text-slate-500 mt-10">
                 <Server className="w-12 h-12 mx-auto mb-2 opacity-20" />
                 <p className="text-sm">No actions recorded yet.</p>
                 <p className="text-xs mt-2">Try asking to "Book a meeting" or "Log a ticket".</p>
               </div>
             )}

             {logs.map((log) => (
               <div key={log.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 animate-in fade-in slide-in-from-bottom-4">
                 <div className="flex items-start gap-3">
                    <div className={`mt-1 p-1.5 rounded-md ${
                      log.type === 'booking' ? 'bg-green-500/20 text-green-400' :
                      log.type === 'ticket' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {log.type === 'booking' && <Calendar className="w-4 h-4" />}
                      {log.type === 'ticket' && <AlertCircle className="w-4 h-4" />}
                      {log.type === 'info' && <Radio className="w-4 h-4" />}
                    </div>
                    <div className="w-full">
                      <h4 className="text-sm font-medium text-white">{log.title}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">{log.message}</p>
                      
                      {/* Automated Status UI */}
                      {log.status === 'sending' && (
                          <div className="mt-3 w-full flex items-center gap-2 text-xs text-blue-300 bg-blue-900/20 p-2 rounded border border-blue-900/50">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing request & syncing...
                          </div>
                      )}

                      {log.status === 'success' && (
                          <div className="mt-3 w-full flex flex-col gap-1 text-xs text-green-300 bg-green-900/20 p-2 rounded border border-green-900/50">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" />
                                Sent to {log.emailDraft?.recipient}
                              </div>
                              <div className="flex items-center gap-2 text-green-400/80">
                                <FileSpreadsheet className="w-3 h-3" />
                                {GOOGLE_SHEETS_WEBHOOK_URL ? "Logged to Google Sheet" : "Sheet Sync skipped (No URL)"}
                              </div>
                          </div>
                      )}
                      
                      {log.status === 'error' && (
                          <div className="mt-3 w-full flex items-center gap-2 text-xs text-red-300 bg-red-900/20 p-2 rounded border border-red-900/50">
                              <AlertCircle className="w-3 h-3" />
                              Failed to process request.
                          </div>
                      )}

                      <p className="text-[10px] text-slate-500 mt-2 text-right">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                 </div>
               </div>
             ))}
             <div ref={logsEndRef} />
          </div>
        </div>

      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl mt-8 pt-4 border-t border-slate-800 text-center md:text-left flex flex-col md:flex-row justify-between text-slate-500 text-sm">
        <p>© 2026 Riyadah Ltd. All rights reserved.</p>
        <div className="flex gap-4 justify-center md:justify-end mt-2 md:mt-0">
          <span>Hotline: (+2) 0155-155-3285</span>
          <span>Cairo, Egypt</span>
        </div>
      </footer>

    </div>
  );
};

export default App;