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
  await setDoc(userRef, { intelligenceApproved: status }, { merge: true });
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