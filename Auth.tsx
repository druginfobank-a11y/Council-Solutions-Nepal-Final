import { db } from './firebase';
import { 
  doc, 
  setDoc,
  getDoc, 
  collection, 
  onSnapshot,
  query,
  where,
  runTransaction,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { User, PaymentRequest, Plan, StudyTask } from '../types';

export const updateUserProfile = async (uid: string, data: Partial<User>) => {
  if (!uid) throw new Error("Logic Fault: Missing Target Node ID.");
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, data, { merge: true });
  } catch (error: any) {
    console.error("Firestore Update Error:", error);
    throw new Error(`Academic Sync Node Failure: ${error.message}`);
  }
};

export const setUserStatus = async (uid: string, status: 'active' | 'banned') => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { status }, { merge: true });
};

export const setUserIntelligenceApproval = async (uid: string, status: boolean) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { intelligenceApproved: status, intelligenceRequested: false }, { merge: true });
};

export const requestIntelligenceAccess = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { intelligenceRequested: true }, { merge: true });
};

export const getUserData = async (uid: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? { id: uid, ...userDoc.data() } as User : null;
  } catch (error: any) {
    console.error("Firestore Get Error:", error);
    return null;
  }
};

export const subscribeToAllUsers = (callback: (users: User[]) => void, onError?: (error: any) => void) => {
  return onSnapshot(collection(db, 'users'), 
    (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    },
    (error) => {
      console.error("Users subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeToPaymentRequests = (callback: (payments: PaymentRequest[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, 'payments'), where('status', '==', 'pending'));
  return onSnapshot(q, 
    (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRequest)));
    },
    (error) => {
      console.error("Payments subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const updatePaymentStatusInCloud = async (paymentId: string, status: 'approved' | 'rejected') => {
  const paymentRef = doc(db, 'payments', paymentId);
  
  if (status === 'rejected') {
    await setDoc(paymentRef, { status }, { merge: true });
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists()) throw new Error("Payment node not found.");
      
      const paymentData = paymentSnap.data() as PaymentRequest;
      const userRef = doc(db, 'users', paymentData.userId);
      const userSnap = await transaction.get(userRef);
      
      const planRef = doc(db, 'plans', paymentData.planId);
      const planSnap = await transaction.get(planRef);
      
      if (userSnap.exists() && planSnap.exists()) {
        const plan = planSnap.data() as Plan;
        const durationStr = (plan.duration || '').toLowerCase();
        let daysToAdd = 30; 

        const numMatch = durationStr.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0]);
          if (durationStr.includes('year')) daysToAdd = num * 365;
          else if (durationStr.includes('month')) daysToAdd = num * 30;
          else if (durationStr.includes('day')) daysToAdd = num;
        }

        const currentEnd = userSnap.data().subscriptionEnd;
        const baseDate = (currentEnd && new Date(currentEnd) > new Date()) 
          ? new Date(currentEnd) 
          : new Date();
        
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        
        transaction.update(userRef, { subscriptionEnd: baseDate.toISOString() });
        transaction.update(paymentRef, { status: 'approved' });
      }
    });
  } catch (error) {
    console.error("Subscription transaction failed:", error);
    throw error;
  }
};

export const setUserVerification = async (uid: string, status: boolean) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { isVerified: status }, { merge: true });
  } catch (error: any) {
    console.error("Firestore Verification Error:", error);
    throw error;
  }
};

export const addTask = async (uid: string, task: Omit<StudyTask, 'id'>) => {
  return await addDoc(collection(db, 'users', uid, 'tasks'), task);
};

export const updateTaskStatus = async (uid: string, taskId: string, completed: boolean) => {
  await updateDoc(doc(db, 'users', uid, 'tasks', taskId), { completed });
};

export const deleteTaskFromCloud = async (uid: string, taskId: string) => {
  await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
};

export const subscribeToTasks = (uid: string, callback: (tasks: StudyTask[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, 'users', uid, 'tasks'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, 
    (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudyTask)));
    },
    (error) => {
      console.error("Tasks subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const updateStreak = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as User;
  const today = new Date().toISOString().split('T')[0];
  const lastActive = userData.lastActiveDate ? userData.lastActiveDate.split('T')[0] : null;

  if (lastActive === today) return;

  let newStreak = 1;
  if (lastActive) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (lastActive === yesterdayStr) {
      newStreak = (userData.streakCount || 0) + 1;
    }
  }

  await updateDoc(userRef, {
    streakCount: newStreak,
    lastActiveDate: new Date().toISOString()
  });

  const currentBadges = userData.badges || [];
  const newBadges = [...currentBadges];
  if (newStreak >= 7 && !newBadges.includes('Consistent Scholar')) newBadges.push('Consistent Scholar');
  if (newStreak >= 30 && !newBadges.includes('Academic Legend')) newBadges.push('Academic Legend');

  if (newBadges.length > currentBadges.length) {
    await updateDoc(userRef, { badges: newBadges });
  }
};

export const incrementDailyMcqCount = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as User;
  const today = new Date().toISOString().split('T')[0];
  const lastMcqDate = userData.lastMcqDate ? userData.lastMcqDate.split('T')[0] : null;

  let count = 1;
  if (lastMcqDate === today) {
    count = (userData.dailyMcqCount || 0) + 1;
  }

  await updateDoc(userRef, {
    dailyMcqCount: count,
    lastMcqDate: new Date().toISOString()
  });

  if (count === 5) {
    await updateStreak(uid);
  }
};

export const getWeeklyLeaderboard = (council: string, callback: (results: any[]) => void) => {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'exam_results'),
    where('council', '==', council),
    where('timestamp', '>=', startOfWeek.toISOString()),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const userBest = new Map<string, any>();
    results.forEach(r => {
      if (!userBest.has(r.userId) || r.score > userBest.get(r.userId)!.score) {
        userBest.set(r.userId, r);
      }
    });
    const sorted = Array.from(userBest.values()).sort((a, b) => b.score - a.score).slice(0, 10);
    callback(sorted);
  }, (error) => {
    console.error("Leaderboard sync failure:", error);
    if (error.code === 'failed-precondition') {
      console.warn("Composite index required for leaderboard. Please check the Firebase console.");
    }
  });
};
