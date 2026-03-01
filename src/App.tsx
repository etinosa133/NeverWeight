import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, 
  Activity, 
  Clock, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Dumbbell,
  ArrowRight,
  ChevronRight,
  Info,
  Flame,
  History,
  Target,
  Utensils,
  ShieldCheck,
  TrendingUp,
  Plus,
  Save,
  Calendar,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Machine, OccupancyData, PeakTimeData, ServerEvent, ClientEvent, WaitlistEntry, WorkoutLog, UserStats, HealthGoal } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'live' | 'workouts' | 'goals' | 'nutrition';

export default function App() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [peakTimes, setPeakTimes] = useState<PeakTimeData[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isEmailSet, setIsEmailSet] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; message: string }[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('live');
  
  // New state for workouts and stats
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [goals, setGoals] = useState<HealthGoal | null>(null);
  
  const [isLogging, setIsLogging] = useState(false);
  const [loggingMachine, setLoggingMachine] = useState<Machine | null>(null);
  const [logForm, setLogForm] = useState({ machineId: '', weight: 0, sets: 0, reps: 0, setting: '' });

  const socketRef = useRef<WebSocket | null>(null);

  const currentTime = new Date('2026-02-28T23:07:11-08:00');
  
  const getGymStatus = () => {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    
    // SPAC Hours: 6 AM - 11 PM (23:00)
    if (hour < 6) {
      if (hour === 5 && minute >= 45) {
        return { status: 'Opening Soon', color: 'text-amber-500', sub: `Opens in ${60 - minute}m` };
      }
      return { status: 'Closed', color: 'text-red-500', sub: 'Opens at 6 AM' };
    }
    
    if (hour >= 23) {
      return { status: 'Closed', color: 'text-red-500', sub: 'Opens at 6 AM' };
    }
    
    if (hour === 22 && minute >= 45) {
      return { status: 'Closing Soon', color: 'text-amber-500', sub: `Closes in ${60 - minute}m` };
    }
    
    return { status: 'Open', color: 'text-emerald-500', sub: 'Until 11 PM' };
  };

  const gymStatus = getGymStatus();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      if (isEmailSet) {
        socket.send(JSON.stringify({ type: 'auth', data: { userEmail } }));
      }
    };
    
    socket.onclose = () => setIsConnected(false);

    socket.onmessage = (event) => {
      const serverEvent: ServerEvent = JSON.parse(event.data);
      
      switch (serverEvent.type) {
        case 'init':
          setMachines(serverEvent.data.machines);
          setOccupancy(serverEvent.data.occupancy);
          setPeakTimes(serverEvent.data.peakTimes);
          setWaitlist(serverEvent.data.waitlist);
          if (serverEvent.data.userStats) setUserStats(serverEvent.data.userStats);
          if (serverEvent.data.workouts) setWorkouts(serverEvent.data.workouts);
          if (serverEvent.data.goals) setGoals(serverEvent.data.goals);
          break;
        case 'machine:update':
          setMachines(prev => prev.map(m => m.id === serverEvent.data.id ? serverEvent.data : m));
          break;
        case 'occupancy:update':
          setOccupancy(serverEvent.data);
          break;
        case 'waitlist:update':
          setWaitlist(serverEvent.data);
          break;
        case 'workout:added':
          if (serverEvent.data.userEmail === userEmail) {
            setWorkouts(prev => [serverEvent.data, ...prev].slice(0, 20));
          }
          break;
        case 'stats:update':
          if (serverEvent.data.email === userEmail) {
            setUserStats(serverEvent.data);
          }
          break;
        case 'notification':
          const id = Math.random().toString(36).substr(2, 9);
          setNotifications(prev => [...prev, { id, message: serverEvent.data.message }]);
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
          }, 5000);
          break;
      }
    };

    return () => socket.close();
  }, [isEmailSet, userEmail]);

  const sendEvent = (event: ClientEvent) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  };

  const handleAuth = () => {
    if (userEmail) {
      setIsEmailSet(true);
      // Auth event is sent in useEffect when isEmailSet changes
    }
  };

  const logWorkout = () => {
    // This is now handled inline in the modal button for better flexibility
  };

  if (!isEmailSet) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] shadow-sm max-w-md w-full border border-black/5"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Dumbbell className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900"><span className="font-extrabold">N</span>ever <span className="font-extrabold">W</span>eight</h1>
              <p className="text-zinc-500 text-sm">Wildcat Fitness Hub</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Enter your email to start</label>
              <input 
                type="email" 
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="wildcat@u.northwestern.edu"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <button 
              onClick={handleAuth}
              className="w-full bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 group"
            >
              Continue
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="mt-8 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              We use AI-powered camera detection to verify machine availability. All data is encrypted and used only for facility optimization. No personal video data is stored.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-zinc-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="text-emerald-600 w-6 h-6" />
            <span className="font-bold text-lg tracking-tight"><span className="font-extrabold">N</span>ever <span className="font-extrabold">W</span>eight</span>
          </div>
          
          <div className="flex items-center gap-3">
            {userStats && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                <Flame className="w-4 h-4 fill-orange-500" />
                <span className="text-xs font-bold">{userStats.streak} Day Streak</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full">
              <div className={cn("w-2 h-2 rounded-full", gymStatus.status === 'Open' || gymStatus.status.includes('Soon') ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{gymStatus.status}</span>
                <span className="text-[8px] text-zinc-400 font-medium">{gymStatus.sub}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-xs font-bold text-white">
              {userEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'live' && (
            <motion.div 
              key="live"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Top Section: Occupancy & Peak Times */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Occupancy Card */}
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium uppercase tracking-wider">Foot Traffic</span>
                      </div>
                      <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase">
                        {occupancy && occupancy.current < occupancy.capacity * 0.5 ? 'Optimal' : 'Congested'}
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-6xl font-light tracking-tighter">{occupancy?.current ?? '--'}</span>
                      <span className="text-zinc-400 text-xl">/ {occupancy?.capacity ?? '--'}</span>
                    </div>
                    
                    <p className="text-zinc-500 text-sm mb-8">
                      {occupancy ? `${Math.round((occupancy.current / occupancy.capacity) * 100)}% capacity utilized` : 'Syncing...'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: occupancy ? `${(occupancy.current / occupancy.capacity) * 100}%` : '0%' }}
                        className={cn(
                          "h-full transition-all duration-1000",
                          occupancy && occupancy.current > occupancy.capacity * 0.8 ? "bg-red-500" : "bg-emerald-500"
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span>Quiet</span>
                      <span>Peak</span>
                    </div>
                  </div>
                </div>

                {/* Peak Times Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium uppercase tracking-wider">Crowd Forecast</span>
                      <span className="text-[10px] font-bold text-emerald-600 ml-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Current: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      AI Verified Status
                    </div>
                  </div>

                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={peakTimes}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="hour" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#a1a1aa' }}
                          tickFormatter={(h) => h > 12 ? `${h-12}p` : `${h}a`}
                        />
                        <Tooltip 
                          cursor={{ fill: '#f4f4f5' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl">
                                  <p className="font-bold">{data.hour > 12 ? `${data.hour-12} PM` : `${data.hour} AM`}</p>
                                  <p className="opacity-70">Avg. {data.avgOccupancy} people</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="avgOccupancy" radius={[4, 4, 0, 0]}>
                          {peakTimes.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.hour === currentTime.getHours() ? '#10b981' : '#e4e4e7'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Machine Availability */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Real-time Equipment</h2>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <Zap className="w-3 h-3 text-amber-500" />
                    AI-Powered Detection Active
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {machines.map((machine) => {
                    const userInWaitlist = waitlist.some(w => w.machineId === machine.id && w.userEmail === userEmail);
                    const isAIDetected = machine.currentUser === 'AI_DETECTED';

                    return (
                      <div key={machine.id} className="bg-white rounded-[24px] p-5 border border-black/5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              machine.status === 'available' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                            )}>
                              <Activity className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-zinc-900">{machine.name}</h3>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{machine.type.replace('-', ' ')}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                            machine.status === 'available' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {isAIDetected && <Zap className="w-2.5 h-2.5 text-amber-500" />}
                            {machine.status.replace('-', ' ')}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            disabled={isAIDetected}
                            onClick={() => userInWaitlist ? sendEvent({ type: 'waitlist:leave', data: { machineId: machine.id, userEmail } }) : sendEvent({ type: 'waitlist:join', data: { machineId: machine.id, userEmail } })}
                            className={cn(
                              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                              userInWaitlist ? "bg-zinc-100 text-zinc-600" : "bg-white border border-zinc-200 text-zinc-900"
                            )}
                          >
                            <Bell className="w-4 h-4" />
                            {userInWaitlist ? "Leave Waitlist" : "Notify Me"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'workouts' && (
            <motion.div 
              key="workouts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold tracking-tight">Workout History</h2>
                  <button 
                    onClick={() => setIsLogging(true)}
                    className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Visits</p>
                    <p className="text-xl font-bold">{userStats?.totalVisits ?? 0}</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-200" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Current Streak</p>
                    <p className="text-xl font-bold text-orange-600 flex items-center gap-1">
                      <Flame className="w-5 h-5 fill-orange-500" />
                      {userStats?.streak ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {workouts.length === 0 ? (
                    <div className="bg-white p-12 rounded-[32px] border border-dashed border-zinc-300 flex flex-col items-center justify-center text-center">
                      <History className="w-12 h-12 text-zinc-300 mb-4" />
                      <h3 className="text-lg font-semibold">No workouts logged yet</h3>
                      <p className="text-zinc-500 text-sm max-w-xs">Start using a machine and click the '+' icon to document your progress.</p>
                    </div>
                  ) : (
                    workouts.map((w) => (
                      <div key={w.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500">
                            <Dumbbell className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900">{w.machineName}</h4>
                            <p className="text-xs text-zinc-500">{new Date(w.timestamp).toLocaleDateString()} • {new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <div className="flex gap-6">
                          {w.weight && (
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Weight</p>
                              <p className="font-bold">{w.weight} lbs</p>
                            </div>
                          )}
                          {w.sets && (
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Sets</p>
                              <p className="font-bold">{w.sets}</p>
                            </div>
                          )}
                          {w.reps && (
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Reps</p>
                              <p className="font-bold">{w.reps}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white p-6 rounded-[32px] shadow-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      Weekly Summary
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Active Days</span>
                        <span className="font-bold">{workouts.length > 0 ? new Set(workouts.map(w => new Date(w.timestamp).toDateString())).size : 0} / 7</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Machines Used</span>
                        <span className="font-bold">{new Set(workouts.map(w => w.machineId)).size}</span>
                      </div>
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-xs text-zinc-400 leading-relaxed italic">
                          "You're in the top 15% of Wildcats this week. Keep that streak alive!"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Health Goals</h2>
                <p className="text-zinc-500">Set your targets and we'll recommend the best workouts for you.</p>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {['Weight Loss', 'Muscle Gain', 'Endurance', 'Maintenance'].map((g) => (
                    <button 
                      key={g}
                      onClick={() => setGoals(prev => ({ ...prev!, userEmail, goalType: g.toLowerCase().replace(' ', '-') as any }))}
                      className={cn(
                        "p-4 rounded-2xl border text-sm font-bold transition-all",
                        goals?.goalType === g.toLowerCase().replace(' ', '-') 
                          ? "bg-zinc-900 text-white border-zinc-900" 
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Target Weight (lbs)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200" 
                      placeholder="165"
                      onChange={(e) => setGoals(prev => ({ ...prev!, userEmail, targetWeight: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Daily Calories</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200" 
                        placeholder="2500"
                        onChange={(e) => setGoals(prev => ({ ...prev!, userEmail, dailyCalories: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Daily Protein (g)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200" 
                        placeholder="150"
                        onChange={(e) => setGoals(prev => ({ ...prev!, userEmail, dailyProtein: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => goals && sendEvent({ type: 'goal:set', data: goals })}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save Goals
                </button>
              </div>

              {goals && (
                <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Recommended for you
                  </h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">
                    Based on your <span className="font-bold">{goals.goalType.replace('-', ' ')}</span> goal, we recommend focusing on the <span className="font-bold">Squat Racks</span> and <span className="font-bold">Cable Machines</span> today. Try to visit during the 6 AM - 8 AM window for the best experience.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'nutrition' && (
            <motion.div 
              key="nutrition"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Wildcat Dining</h2>
                <div className="px-4 py-2 bg-zinc-100 rounded-full text-xs font-bold text-zinc-600 flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Connected to Dining Halls
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Today's Menu Macros</h3>
                    <div className="space-y-4">
                      {[
                        { hall: 'Allison', meal: 'Grilled Chicken & Quinoa', cal: 450, pro: 35 },
                        { hall: 'Plex', meal: 'Tofu Stir Fry', cal: 380, pro: 22 },
                        { hall: 'Elder', meal: 'Beef & Broccoli', cal: 520, pro: 28 }
                      ].map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{m.hall}</p>
                            <p className="font-bold">{m.meal}</p>
                          </div>
                          <div className="flex gap-6 text-right">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Calories</p>
                              <p className="font-bold">{m.cal}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Protein</p>
                              <p className="font-bold text-emerald-600">{m.pro}g</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 text-white p-8 rounded-[32px] shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Personalized Plan</h3>
                    <p className="text-zinc-400 text-sm mb-8">Based on your workout and goals.</p>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                          <span>Calories</span>
                          <span>1,200 / 2,500</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[48%]" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                          <span>Protein</span>
                          <span>85g / 150g</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-[56%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      "To hit your protein goal for today, we recommend the Grilled Chicken at Allison for dinner."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Workout Log Modal */}
      <AnimatePresence>
        {(loggingMachine || isLogging) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">Log Progress</h3>
                  <p className="text-zinc-500 text-sm">{loggingMachine ? loggingMachine.name : 'Select Equipment'}</p>
                </div>
                <button onClick={() => { setLoggingMachine(null); setIsLogging(false); }} className="p-2 hover:bg-zinc-100 rounded-full">
                  <XCircle className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                {!loggingMachine && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Equipment</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white"
                      value={logForm.machineId}
                      onChange={(e) => setLogForm(prev => ({ ...prev, machineId: e.target.value }))}
                    >
                      <option value="">Select a machine...</option>
                      {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Weight (lbs)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200"
                      value={logForm.weight || ''}
                      onChange={(e) => setLogForm(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Setting/Level</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200"
                      placeholder="Lvl 10"
                      value={logForm.setting}
                      onChange={(e) => setLogForm(prev => ({ ...prev, setting: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Sets</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200"
                      value={logForm.sets || ''}
                      onChange={(e) => setLogForm(prev => ({ ...prev, sets: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Reps</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200"
                      value={logForm.reps || ''}
                      onChange={(e) => setLogForm(prev => ({ ...prev, reps: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const machine = loggingMachine || machines.find(m => m.id === logForm.machineId);
                    if (!machine || !isEmailSet) return;
                    sendEvent({ 
                      type: 'workout:log', 
                      data: { 
                        machineId: machine.id, 
                        machineName: machine.name, 
                        userEmail, 
                        ...logForm 
                      } 
                    });
                    setLoggingMachine(null);
                    setIsLogging(false);
                    setLogForm({ machineId: '', weight: 0, sets: 0, reps: 0, setting: '' });
                  }}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Document Workout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div 
              key={n.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto min-w-[300px]"
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="text-zinc-500 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveTab('live')}
          className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'live' ? "text-emerald-600" : "text-zinc-400")}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
        </button>
        <button 
          onClick={() => setActiveTab('workouts')}
          className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'workouts' ? "text-emerald-600" : "text-zinc-400")}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Log</span>
        </button>
        <button 
          onClick={() => setActiveTab('goals')}
          className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'goals' ? "text-emerald-600" : "text-zinc-400")}
        >
          <Target className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
        </button>
        <button 
          onClick={() => setActiveTab('nutrition')}
          className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'nutrition' ? "text-emerald-600" : "text-zinc-400")}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Dining</span>
        </button>
      </nav>
    </div>
  );
}
