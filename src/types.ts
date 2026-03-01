export type MachineStatus = 'available' | 'in-use' | 'reserved';

export interface Machine {
  id: string;
  name: string;
  type: 'treadmill' | 'elliptical' | 'bike' | 'squat-rack' | 'bench' | 'cable';
  status: MachineStatus;
  currentUser?: string;
  reservedBy?: string;
}

export interface OccupancyData {
  current: number;
  capacity: number;
  timestamp: number;
}

export interface PeakTimeData {
  hour: number;
  avgOccupancy: number;
}

export interface WaitlistEntry {
  machineId: string;
  userEmail: string;
  timestamp: number;
}

export interface WorkoutLog {
  id: string;
  userEmail: string;
  machineId: string;
  machineName: string;
  weight?: number;
  setting?: string;
  sets?: number;
  reps?: number;
  timestamp: number;
}

export interface UserStats {
  email: string;
  streak: number;
  lastVisit: number;
  totalVisits: number;
}

export interface HealthGoal {
  userEmail: string;
  goalType: 'weight-loss' | 'muscle-gain' | 'endurance' | 'maintenance';
  targetWeight?: number;
  dailyCalories?: number;
  dailyProtein?: number;
}

export interface NutritionLog {
  userEmail: string;
  mealName: string;
  calories: number;
  protein: number;
  timestamp: number;
}

export type ServerEvent = 
  | { type: 'init'; data: { 
      machines: Machine[], 
      occupancy: OccupancyData, 
      peakTimes: PeakTimeData[], 
      waitlist: WaitlistEntry[],
      userStats?: UserStats,
      workouts?: WorkoutLog[],
      goals?: HealthGoal
    } }
  | { type: 'machine:update'; data: Machine }
  | { type: 'occupancy:update'; data: OccupancyData }
  | { type: 'waitlist:update'; data: WaitlistEntry[] }
  | { type: 'workout:added'; data: WorkoutLog }
  | { type: 'stats:update'; data: UserStats }
  | { type: 'notification'; data: { message: string, machineId: string } };

export type ClientEvent =
  | { type: 'auth'; data: { userEmail: string } }
  | { type: 'machine:toggle'; data: { machineId: string, userEmail: string } }
  | { type: 'waitlist:join'; data: { machineId: string, userEmail: string } }
  | { type: 'waitlist:leave'; data: { machineId: string, userEmail: string } }
  | { type: 'workout:log'; data: Omit<WorkoutLog, 'id' | 'timestamp'> }
  | { type: 'goal:set'; data: HealthGoal };
