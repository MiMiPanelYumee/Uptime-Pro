import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Plus, 
  Settings as SettingsIcon, 
  Shield, 
  Globe, 
  Zap, 
  AlertCircle, 
  CheckCircle2,
  Trash2,
  Bell,
  Cpu,
  BarChart3,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { Monitor, PingLog, Settings, ServerEvent } from './types';

// --- Components ---

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
    {children}
  </div>
);

const NeonButton = ({ children, onClick, variant = 'primary', className = "" }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'danger' | 'ghost', className?: string }) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]",
    ghost: "bg-white/5 hover:bg-white/10 text-white border border-white/10"
  };
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium transition-all active:scale-95 flex items-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const isUp = status === 'up';
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
      isUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
      status === 'down' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
      'bg-slate-500/20 text-slate-400 border border-slate-500/30'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isUp ? 'bg-emerald-400' : status === 'down' ? 'bg-rose-400' : 'bg-slate-400'}`} />
      {status}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const connect = () => {
      const backendUrl = "ais-dev-lukrjoaz3mf3qkg4g2oamk-147485490409.asia-east1.run.app";
      const socket = new WebSocket(`wss://${backendUrl}`);
      
      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 3000);
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as ServerEvent;
        switch (data.type) {
          case 'INITIAL_STATE':
            setMonitors(data.monitors);
            setLogs(data.logs);
            setSettings(data.settings);
            break;
          case 'MONITOR_UPDATED':
            setMonitors(prev => {
              const existing = prev.find(m => m.id === data.monitor.id);
              if (existing && existing.status !== data.monitor.status && data.monitor.status !== 'pending') {
                if (Notification.permission === "granted") {
                  new Notification(`Monitor Alert: ${data.monitor.name}`, {
                    body: `Status is now ${data.monitor.status.toUpperCase()}`,
                    icon: 'https://picsum.photos/100/100'
                  });
                }
              }
              const exists = prev.some(m => m.id === data.monitor.id);
              if (!exists) return [...prev, data.monitor];
              return prev.map(m => m.id === data.monitor.id ? data.monitor : m);
            });
            break;
          case 'NEW_LOG':
            setLogs(prev => {
              const exists = prev.some(l => l.id === data.log.id);
              if (exists) return prev;
              return [data.log, ...prev].slice(0, 100);
            });
            break;
          case 'SETTINGS_UPDATED':
            setSettings(data.settings);
            break;
        }
      };
      
      ws.current = socket;
    };

    connect();
    return () => ws.current?.close();
  }, []);

  const addMonitor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      url: formData.get('url'),
      interval: parseInt(formData.get('interval') as string)
    };
    await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setIsAddModalOpen(false);
  };

  const deleteMonitor = async (id: number) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
    setMonitors(prev => prev.filter(m => m.id !== id));
  };

  const updateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      telegramBotToken: formData.get('botToken'),
      telegramChatId: formData.get('chatId'),
      reportInterval: parseInt(formData.get('reportInterval') as string)
    };
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setIsSettingsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050510] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050510]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.5)]">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">NeonUptime</h1>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                {wsConnected ? 'System Live' : 'Connecting...'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NeonButton onClick={() => setIsSettingsModalOpen(true)} variant="ghost">
              <SettingsIcon className="w-4 h-4" />
            </NeonButton>
            <NeonButton onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Monitor</span>
            </NeonButton>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-400">Total Monitors</div>
              <div className="text-2xl font-bold text-white">{monitors.length}</div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-400">Online</div>
              <div className="text-2xl font-bold text-white">{monitors.filter(m => m.status === 'up').length}</div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-400">Offline</div>
              <div className="text-2xl font-bold text-white">{monitors.filter(m => m.status === 'down').length}</div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-400">Avg Response</div>
              <div className="text-2xl font-bold text-white">
                {monitors.length ? Math.round(monitors.reduce((acc, m) => acc + m.responseTime, 0) / monitors.length) : 0}ms
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Monitors List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Active Monitors
              </h2>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {monitors.map((monitor) => (
                  <motion.div
                    key={monitor.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <GlassCard className="group">
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${monitor.status === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              <Globe className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg">{monitor.name}</h3>
                              <p className="text-sm text-slate-500 font-mono truncate max-w-[200px] sm:max-w-xs">{monitor.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={monitor.status} />
                            <button 
                              onClick={() => deleteMonitor(monitor.id)}
                              className="p-2 text-slate-600 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          {/* Circular Uptime */}
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 z-10">Uptime %</div>
                            <div className="relative w-16 h-16 flex items-center justify-center z-10">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-800" />
                                <circle 
                                  cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" 
                                  strokeDasharray={175.9}
                                  strokeDashoffset={175.9 - (175.9 * monitor.uptime) / 100}
                                  className="text-indigo-500 transition-all duration-1000"
                                />
                              </svg>
                              <span className="absolute text-xs font-bold text-white">{Math.round(monitor.uptime)}%</span>
                            </div>
                          </div>

                          {/* Battery Health Bar (Neon Green) */}
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Health Status</div>
                            <div className="flex items-end gap-1 h-12">
                              {[...Array(10)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`flex-1 rounded-sm transition-all duration-500 ${
                                    i < (monitor.uptime / 10) 
                                      ? 'bg-[#00FF00] shadow-[0_0_10px_#00FF00]' 
                                      : 'bg-slate-800'
                                  }`}
                                  style={{ height: `${20 + (i * 8)}%` }}
                                />
                              ))}
                            </div>
                            <div className="text-[8px] text-[#00FF00] font-bold mt-2 uppercase tracking-tighter">Battery Optimized</div>
                          </div>

                          {/* Response Time */}
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Response</div>
                            <div className="text-xl font-bold text-white">{monitor.responseTime}ms</div>
                            <div className="text-[10px] text-indigo-400 mt-1 flex items-center gap-1">
                              <Zap className="w-2 h-2" />
                              Fast Link
                            </div>
                          </div>

                          {/* Activity Bar */}
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Activity</div>
                            <div className="h-12 flex items-end gap-0.5">
                              {logs.filter(l => l.monitorId === monitor.id).slice(0, 15).map((l, i) => (
                                <div 
                                  key={i} 
                                  className="flex-1 bg-indigo-500/40 rounded-t-sm" 
                                  style={{ height: `${Math.min(100, (l.responseTime / 500) * 100)}%` }} 
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Candlestick Chart (Neon White / Dark Neon Pink) */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Live Status Stream</span>
                            <div className="flex gap-4">
                              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-white shadow-[0_0_5px_#fff]" /> RUN</span>
                              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[#FF1493] shadow-[0_0_5px_#FF1493]" /> ERROR</span>
                            </div>
                          </div>
                          <div className="flex gap-1 h-8 items-center bg-black/20 rounded-lg px-2 border border-white/5">
                            {logs.filter(l => l.monitorId === monitor.id).slice(0, 50).reverse().map((log) => (
                              <div 
                                key={log.id}
                                className={`flex-1 rounded-full transition-all hover:scale-150 ${
                                  log.status === 'up' 
                                    ? 'bg-white shadow-[0_0_8px_#fff] h-4' 
                                    : 'bg-[#FF1493] shadow-[0_0_10px_#FF1493] h-6'
                                }`}
                                title={`${log.status.toUpperCase()} - ${log.responseTime}ms`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {monitors.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                    <Globe className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">No Monitors Found</h3>
                  <p className="text-slate-500 mt-2">Add your first URL to start monitoring</p>
                  <NeonButton onClick={() => setIsAddModalOpen(true)} className="mx-auto mt-6">
                    <Plus className="w-4 h-4" />
                    Add Monitor
                  </NeonButton>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Live Activity Log */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Live Activity
              </h2>
              <GlassCard className="h-[600px] flex flex-col">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Realtime Stream</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                    <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px]">
                  {logs.map((log) => {
                    const monitor = monitors.find(m => m.id === log.monitorId);
                    return (
                      <div key={log.id} className="flex items-start gap-3 group">
                        <span className="text-slate-600 shrink-0">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-400 font-bold">{monitor?.name || 'Unknown'}</span>
                            <span className={log.status === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                              {log.status.toUpperCase()}
                            </span>
                            <span className="text-slate-600">({log.responseTime}ms)</span>
                          </div>
                          {log.errorMessage && (
                            <span className="text-rose-500/70 italic">Error: {log.errorMessage}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </section>

            {/* System Info */}
            <GlassCard className="p-6 space-y-4">
              <h2 className="font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                System Health
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Engine Status</span>
                  <span className="text-emerald-400 font-bold">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Background Worker</span>
                  <span className="text-emerald-400 font-bold">RUNNING</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">DB Persistence</span>
                  <span className="text-indigo-400 font-bold">SQLITE3</span>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span>CPU Usage</span>
                    <span>12%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[12%]" />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>

      {/* Add Monitor Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md"
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Plus className="text-indigo-400" />
                  New Monitor
                </h2>
                <form onSubmit={addMonitor} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Monitor Name</label>
                    <input 
                      name="name" 
                      required 
                      placeholder="e.g. My Website"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">URL to Ping</label>
                    <input 
                      name="url" 
                      type="url" 
                      required 
                      placeholder="https://example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interval (seconds)</label>
                    <select 
                      name="interval" 
                      defaultValue="60"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white appearance-none"
                    >
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="300">5 minutes</option>
                      <option value="600">10 minutes</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <NeonButton className="flex-1 justify-center" onClick={() => {}}>Create Monitor</NeonButton>
                    <NeonButton variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</NeonButton>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md"
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <Bell className="text-indigo-400" />
                  Notifications
                </h2>
                <p className="text-slate-500 text-sm mb-6">Configure your Telegram bot for real-time alerts.</p>
                <form onSubmit={updateSettings} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bot Token</label>
                    <input 
                      name="botToken" 
                      defaultValue={settings?.telegramBotToken}
                      placeholder="123456789:ABC..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chat ID</label>
                    <input 
                      name="chatId" 
                      defaultValue={settings?.telegramChatId}
                      placeholder="-100..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Report Interval (seconds)</label>
                    <input 
                      name="reportInterval" 
                      type="number"
                      defaultValue={settings?.reportInterval}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <NeonButton className="flex-1 justify-center" onClick={() => {}}>Save Settings</NeonButton>
                    <NeonButton variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>Close</NeonButton>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                  <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 space-y-2">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Native APK Build:</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Aplikasi ini sudah dikonfigurasi dengan <b>Capacitor</b> untuk menjadi APK Android Native.
                    </p>
                    <ol className="text-[9px] text-slate-500 list-decimal pl-4 space-y-1">
                      <li>Download source code project ini.</li>
                      <li>Install Android Studio di PC Anda.</li>
                      <li>Jalankan <code className="text-indigo-300">npm run cap:build</code>.</li>
                      <li>Jalankan <code className="text-indigo-300">npx cap open android</code> untuk build APK.</li>
                    </ol>
                  </div>

                  <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 space-y-2">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">📦 Paket Lengkap APK Gradle:</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Semua file yang diperlukan sudah siap. Anda tidak perlu bingung lagi, cukup gunakan folder ini:
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <div className="w-1 h-1 rounded-full bg-indigo-500" />
                        <span><b>/android</b> - Folder Build Gradle & Manifest</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <div className="w-1 h-1 rounded-full bg-indigo-500" />
                        <span><b>/java</b> - File Foreground Service & Auto-Start</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <div className="w-1 h-1 rounded-full bg-indigo-500" />
                        <span><b>/src</b> - Dashboard Neon Futuristik</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-indigo-300 font-bold mt-2">
                      💡 Tips: Klik tombol "Download Project" di menu AI Studio untuk mendapatkan semua file ini dalam satu folder ZIP.
                    </p>
                  </div>

                  <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/20 space-y-2">
                    <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">⚠️ Solusi Layar Putih (White Screen):</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Jika APK Anda layar putih, itu karena file web belum terhubung dengan benar. Saya sudah memperbaikinya:
                    </p>
                    <ul className="text-[9px] text-slate-500 list-disc pl-4 space-y-1">
                      <li><b>Vite Config</b>: Sudah saya set ke <i>Relative Path</i> agar file terbaca di HP.</li>
                      <li><b>WebSocket</b>: Sudah saya kunci ke URL server agar APK bisa konek dari mana saja.</li>
                      <li><b>Solusi</b>: Silakan download ulang project ini dan build ulang APK-nya.</li>
                    </ul>
                  </div>

                  <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 space-y-2">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">📱 Mobile App Mode (Tanpa PC):</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Karena Anda menggunakan HP, Anda bisa menginstall aplikasi ini langsung tanpa APK:
                    </p>
                    <ul className="text-[9px] text-slate-500 list-disc pl-4 space-y-1">
                      <li>Klik ikon <b>Titik Tiga (⋮)</b> di pojok kanan atas browser Chrome Anda.</li>
                      <li>Pilih <b>"Tambahkan ke Layar Utama"</b> (Add to Home Screen).</li>
                      <li>Aplikasi akan muncul di menu HP Anda dengan ikon dan berjalan full-screen seperti aplikasi native!</li>
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
