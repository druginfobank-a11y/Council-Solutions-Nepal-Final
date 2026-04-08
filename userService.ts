import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { Plan } from '../types';

const PLANS_COLLECTION = 'plans';

export const getPlans = async (): Promise<Plan[]> => {
  const snapshot = await getDocs(collection(db, PLANS_COLLECTION));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
};

export const subscribeToPlans = (callback: (plans: Plan[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, PLANS_COLLECTION));
  return onSnapshot(q, 
    (snapshot) => {
      const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
      callback(plans);
    },
    (error) => {
      console.error("Plans subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const savePlanToCloud = async (plan: Partial<Plan> & { id: string }) => {
  await setDoc(doc(db, PLANS_COLLECTION, plan.id), plan, { merge: true });
};

export const deletePlanFromCloud = async (id: string) => {
  await deleteDoc(doc(db, PLANS_COLLECTION, id));
};