
export enum UserRole {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN'
}

export enum QuizMode {
  PRACTICE = 'PRACTICE',
  EXAM = 'EXAM'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subscriptionEnd?: string;
  isVerified: boolean;
  intelligenceApproved?: boolean;
  intelligenceRequested?: boolean;
  status?: 'active' | 'banned';
  profileUrl?: string;
  npcNumber?: string;
  specialization?: string;
  council?: string;
  level?: string;
  program?: string;
  batch?: string;
  college?: string;
  createdAt: string;
  language?: 'ENG' | 'NEP';
  phone?: string;
  bio?: string;
  currentSessionId?: string; // Track active device session
  streakCount?: number;
  lastActiveDate?: string;
  badges?: string[];
  isPremium?: boolean;
  weaknesses?: Record<string, number>; // subject -> error count
  dailyMcqCount?: number;
  lastMcqDate?: string;
}

export interface StudyTask {
  id: string;
  text: string;
  completed: boolean;
  timestamp: string;
  priority: 'High' | 'Medium' | 'Low';
  dueDate?: string;
}

export interface Ad {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'promo';
  targetCouncil?: string;
  createdAt: string;
  imageUrl?: string;
  linkUrl?: string;
  displayDuration?: number; // In seconds
}

export interface SystemSettings {
  maintenanceMode: boolean;
  platformName: string;
  logoUrl: string;
  esewaNumber: string;
  esewaQrUrl: string;
  khaltiNumber: string;
  khaltiQrUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankQrUrl?: string;
  bunnyRegion: string;
  bunnyZoneName: string;
  bunnyPassword: string;
  bunnyPullZoneUrl: string;
  enabledPrograms?: Record<string, boolean>;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  showDisclaimers?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  features: string[];
  duration: string;
  imageUrl?: string;
  isPopular?: boolean;
  targetProgram?: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  referenceId: string;
  screenshot: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface ExamResult {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: string;
  program: string;
  council: string;
  subject: string;
  unit?: string;
  rank?: number;
  isFirstAttempt?: boolean; // Required for ranking logic
  quizModuleType?: string; // e.g., 'Mock Exam'
}

export interface Quiz {
  id: string;
  title: string;
  mode: QuizMode;
  questionsCount: number;
  duration: number;
  category: string;
  subject: string; 
  unit?: string; 
  difficulty: 'Easy' | 'Medium' | 'Hard';
  program: string;
  programs?: string[];
  council: string;
  uploadedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  scheduledDate?: string; // Format: YYYY-MM-DD
  scheduledTime?: string; // Format: HH:mm
  autoSubmit?: boolean;
  questions?: any[];
  moduleType?: string; // 'Unit-wise' | 'Set-wise' | 'Mock Exam' | 'Subject Drill'
}

export interface LearningMaterial {
  id: string;
  title: string;
  description?: string;
  category: string;
  subject: string; 
  unit?: string; 
  type: 'pdf' | 'video' | 'lab' | 'ppt' | 'handout' | 'notes' | 'book';
  url: string;
  program: string;
  programs?: string[];
  council: string;
  size?: string;
  status?: 'pending' | 'approved' | 'rejected';
  uploadedBy?: string;
  uploadDate?: string;
}
