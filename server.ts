import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Machine, OccupancyData, PeakTimeData, ServerEvent, ClientEvent, WaitlistEntry, WorkoutLog, UserStats, HealthGoal } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database('spac.db');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    currentUser TEXT,
    reservedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS occupancy_history (
    timestamp INTEGER PRIMARY KEY,
    count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    machineId TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (machineId, userEmail)
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    userEmail TEXT NOT NULL,
    machineId TEXT NOT NULL,
    machineName TEXT NOT NULL,
    weight REAL,
    setting TEXT,
    sets INTEGER,
    reps INTEGER,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    email TEXT PRIMARY KEY,
    streak INTEGER DEFAULT 0,
    lastVisit INTEGER DEFAULT 0,
    totalVisits INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS health_goals (
    userEmail TEXT PRIMARY KEY,
    goalType TEXT NOT NULL,
    targetWeight REAL,
    dailyCalories INTEGER,
    dailyProtein INTEGER
  );
`);

// Seed machines if empty
const machineCount = db.prepare('SELECT count(*) as count FROM machines').get() as { count: number };
if (machineCount.count === 0) {
  const initialMachines = [
    { id: 't1', name: 'Treadmill 1', type: 'treadmill', status: 'available' },
    { id: 't2', name: 'Treadmill 2', type: 'treadmill', status: 'available' },
    { id: 't3', name: 'Treadmill 3', type: 'treadmill', status: 'available' },
    { id: 'e1', name: 'Elliptical 1', type: 'elliptical', status: 'available' },
    { id: 'e2', name: 'Elliptical 2', type: 'elliptical', status: 'available' },
    { id: 'b1', name: 'Squat Rack 1', type: 'squat-rack', status: 'available' },
    { id: 'b2', name: 'Bench Press 1', type: 'bench', status: 'available' },
    { id: 'b3', name: 'Dumbbell Area', type: 'bench', status: 'available' },
    { id: 'c1', name: 'Cable Machine 1', type: 'cable', status: 'available' },
    { id: 'c2', name: 'Cable Machine 2', type: 'cable', status: 'available' },
  ];
  const insert = db.prepare('INSERT INTO machines (id, name, type, status) VALUES (?, ?, ?, ?)');
  initialMachines.forEach(m => insert.run(m.id, m.name, m.type, m.status));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  const broadcast = (event: ServerEvent) => {
    const message = JSON.stringify(event);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  const getMachines = (): Machine[] => {
    return db.prepare('SELECT * FROM machines').all() as Machine[];
  };

  const getOccupancy = (): OccupancyData => {
    const last = db.prepare('SELECT count FROM occupancy_history ORDER BY timestamp DESC LIMIT 1').get() as { count: number } | undefined;
    return {
      current: last?.count ?? Math.floor(Math.random() * 50) + 10,
      capacity: 150,
      timestamp: Date.now()
    };
  };

  const getPeakTimes = (): PeakTimeData[] => {
    return Array.from({ length: 15 }, (_, i) => {
      const hour = i + 6; // 6 AM to 9 PM
      let avg = 20;
      if (hour >= 16 && hour <= 19) avg = 120; // Evening peak
      if (hour >= 7 && hour <= 9) avg = 80;   // Morning peak
      return { hour, avgOccupancy: avg };
    });
  };

  const updateStreak = (email: string) => {
    const now = Date.now();
    const stats = db.prepare('SELECT * FROM user_stats WHERE email = ?').get(email) as UserStats | undefined;
    
    if (!stats) {
      db.prepare('INSERT INTO user_stats (email, streak, lastVisit, totalVisits) VALUES (?, 1, ?, 1)').run(email, now);
      return;
    }

    const lastVisitDate = new Date(stats.lastVisit).toDateString();
    const todayDate = new Date(now).toDateString();

    if (lastVisitDate === todayDate) return; // Already visited today

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toDateString();

    let newStreak = stats.streak;
    if (lastVisitDate === yesterdayDate) {
      newStreak += 1;
    } else {
      newStreak = 1; // Streak broken
    }

    db.prepare('UPDATE user_stats SET streak = ?, lastVisit = ?, totalVisits = totalVisits + 1 WHERE email = ?').run(newStreak, now, email);
  };

  wss.on('connection', (ws) => {
    let currentUserEmail: string | null = null;

    ws.on('message', (data) => {
      try {
        const event: ClientEvent = JSON.parse(data.toString());
        
        if (event.type === 'auth') {
          currentUserEmail = event.data.userEmail;
          updateStreak(currentUserEmail);
          
          const stats = db.prepare('SELECT * FROM user_stats WHERE email = ?').get(currentUserEmail) as UserStats;
          const workouts = db.prepare('SELECT * FROM workouts WHERE userEmail = ? ORDER BY timestamp DESC LIMIT 20').all(currentUserEmail) as WorkoutLog[];
          const goals = db.prepare('SELECT * FROM health_goals WHERE userEmail = ?').get(currentUserEmail) as HealthGoal;

          ws.send(JSON.stringify({
            type: 'init',
            data: {
              machines: getMachines(),
              occupancy: getOccupancy(),
              peakTimes: getPeakTimes(),
              waitlist: db.prepare('SELECT * FROM waitlist').all() as WaitlistEntry[],
              userStats: stats,
              workouts: workouts,
              goals: goals
            }
          }));
        }

        if (event.type === 'machine:toggle') {
          // Manual toggling is disabled as per user request. 
          // Machine status is now pulled from AI security cameras.
          return;
        }

        if (event.type === 'workout:log') {
          const { machineId, machineName, userEmail, weight, setting, sets, reps } = event.data;
          const id = Math.random().toString(36).substr(2, 9);
          const timestamp = Date.now();
          db.prepare('INSERT INTO workouts (id, userEmail, machineId, machineName, weight, setting, sets, reps, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, userEmail, machineId, machineName, weight, setting, sets, reps, timestamp);
          
          broadcast({ 
            type: 'workout:added', 
            data: { id, userEmail, machineId, machineName, weight, setting, sets, reps, timestamp } 
          });
        }

        if (event.type === 'goal:set') {
          const { userEmail, goalType, targetWeight, dailyCalories, dailyProtein } = event.data;
          db.prepare('INSERT OR REPLACE INTO health_goals (userEmail, goalType, targetWeight, dailyCalories, dailyProtein) VALUES (?, ?, ?, ?, ?)')
            .run(userEmail, goalType, targetWeight, dailyCalories, dailyProtein);
        }

        if (event.type === 'waitlist:join') {
          const { machineId, userEmail } = event.data;
          db.prepare('INSERT OR IGNORE INTO waitlist (machineId, userEmail, timestamp) VALUES (?, ?, ?)').run(machineId, userEmail, Date.now());
          const waitlist = db.prepare('SELECT * FROM waitlist').all() as WaitlistEntry[];
          broadcast({ type: 'waitlist:update', data: waitlist });
        }

        if (event.type === 'waitlist:leave') {
          const { machineId, userEmail } = event.data;
          db.prepare('DELETE FROM waitlist WHERE machineId = ? AND userEmail = ?').run(machineId, userEmail);
          const waitlist = db.prepare('SELECT * FROM waitlist').all() as WaitlistEntry[];
          broadcast({ type: 'waitlist:update', data: waitlist });
        }

      } catch (err) {
        console.error('WS Error:', err);
      }
    });
  });

  // Background task to update occupancy randomly for demo
  setInterval(() => {
    const current = getOccupancy().current;
    const delta = Math.floor(Math.random() * 5) - 2;
    const newCount = Math.max(0, Math.min(150, current + delta));
    db.prepare('INSERT INTO occupancy_history (timestamp, count) VALUES (?, ?)').run(Date.now(), newCount);
    broadcast({ type: 'occupancy:update', data: { current: newCount, capacity: 150, timestamp: Date.now() } });
  }, 10000);

  // Simulate AI detection for machines
  setInterval(() => {
    const machines = getMachines();
    machines.forEach(m => {
      if (m.status === 'available' && Math.random() < 0.05) {
        // AI detected someone using it without the app
        db.prepare('UPDATE machines SET status = "in-use", currentUser = "AI_DETECTED" WHERE id = ?').run(m.id);
        broadcast({ type: 'machine:update', data: { ...m, status: 'in-use', currentUser: 'AI_DETECTED' } });
      } else if (m.status === 'in-use' && m.currentUser === 'AI_DETECTED' && Math.random() < 0.1) {
        // AI detected machine is free
        db.prepare('UPDATE machines SET status = "available", currentUser = NULL WHERE id = ?').run(m.id);
        broadcast({ type: 'machine:update', data: { ...m, status: 'available', currentUser: undefined } });
      }
    });
  }, 15000);
}

startServer();
