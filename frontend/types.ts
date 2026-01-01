
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
  NONE = 'NONE'
}

export interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  identifier: string;
  name: string;
}

export interface SystemConfig {
  isLoginLocked: boolean;
  lastUpdated: string;
}

export interface TeacherProfile {
  employeeId: string;
  name: string;
  department: string;
  password?: string;
}

export interface StudentProfile {
  rollNumber: string;
  name: string;
  phone: string;
  section: string;
  department: string;
  password?: string;
  deviceId?: string; // Unique ID of the physical device bound to this student
}

export interface AttendanceRecord {
  rollNumber: string;
  timestamp: string;
  name: string;
  section: string;
  department: string;
  deviceId?: string; // Captured at the time of check-in
}

export interface AttendanceSession {
  id: string;
  courseName: string;
  startTime: string;
  attendance: AttendanceRecord[];
  isActive: boolean;
  teacherId: string;
}
