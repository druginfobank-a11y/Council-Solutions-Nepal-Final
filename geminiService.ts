
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, onSnapshot, orderBy, deleteDoc, getDoc, setDoc, limit } from 'firebase/firestore';
import { Quiz, LearningMaterial, ExamResult } from '../types';

export const publishLearningMaterial = async (material: Partial<LearningMaterial>) => {
  try {
    const docRef = await addDoc(collection(db, 'materials'), {
      ...material,
      status: material.status || 'pending',
      uploadDate: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error publishing material:", error);
    throw error;
  }
};

export const deleteLearningMaterial = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'materials', id));
  } catch (error) {
    console.error("Error deleting material:", error);
    throw error;
  }
};

export const publishQuiz = async (quiz: Partial<Quiz>, questions: any[]) => {
  try {
    const docRef = await addDoc(collection(db, 'quizzes'), {
      ...quiz,
      questions,
      status: quiz.status || 'pending',
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error publishing quiz:", error);
    throw error;
  }
};

export const deleteQuizFromCloud = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'quizzes', id));
  } catch (error) {
    console.error("Error deleting quiz node:", error);
    throw error;
  }
};

export const submitExamResult = async (result: Omit<ExamResult, 'id'>) => {
  try {
    // Check if this is the user's first attempt for this quiz
    const q = query(
      collection(db, 'exam_results'),
      where('userId', '==', result.userId),
      where('quizId', '==', result.quizId),
      limit(1)
    );
    const snap = await getDocs(q);
    const isFirst = snap.empty;

    const docRef = await addDoc(collection(db, 'exam_results'), {
      ...result,
      isFirstAttempt: isFirst
    });
    return docRef.id;
  } catch (error) {
    console.error("Error submitting exam result:", error);
    throw error;
  }
};

/**
 * Gets rankings for a specific quiz, only counting the first attempt of each user.
 */
export const getQuizRankings = async (quizId: string) => {
  const q = query(
    collection(db, 'exam_results'),
    where('quizId', '==', quizId),
    where('isFirstAttempt', '==', true)
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
  
  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // If scores are tied, the one who submitted earlier wins
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    })
    .map((res, index) => ({ ...res, rank: index + 1 }));
};

/**
 * Calculates cumulative rankings for a program based ONLY on "Mock Exam" types.
 * Only the first attempt of each mock exam is factored into the student's mastery score.
 */
export const getProgramMasteryRankings = async (council: string, program: string) => {
  const q = query(
    collection(db, 'exam_results'),
    where('council', '==', council),
    where('program', '==', program),
    where('quizModuleType', '==', 'Mock Exam'),
    where('isFirstAttempt', '==', true)
  );
  
  const snap = await getDocs(q);
  const allResults = snap.docs.map(d => d.data() as ExamResult);
  
  const studentStats: Record<string, { totalPct: number; count: number; name: string }> = {};
  
  allResults.forEach(r => {
    if (!studentStats[r.userId]) {
      studentStats[r.userId] = { totalPct: 0, count: 0, name: r.userName };
    }
    studentStats[r.userId].totalPct += r.percentage;
    studentStats[r.userId].count += 1;
  });
  
  const rankedStudents = Object.entries(studentStats).map(([userId, stats]) => ({
    userId,
    userName: stats.name,
    averageMastery: stats.totalPct / stats.count,
    attempts: stats.count
  }));
  
  return rankedStudents
    .sort((a, b) => b.averageMastery - a.averageMastery)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));
};

export const subscribeToPendingQuizzes = (callback: (quizzes: Quiz[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, 'quizzes'), where('status', '==', 'pending'));
  return onSnapshot(q, 
    (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    },
    (error) => {
      console.error("Quizzes subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeToApprovedQuizzes = (callback: (quizzes: Quiz[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, 'quizzes'), where('status', '==', 'approved'));
  return onSnapshot(q, 
    (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    },
    (error) => {
      console.error("Approved Quizzes subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeToPendingMaterials = (callback: (materials: LearningMaterial[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, 'materials'), where('status', '==', 'pending'));
  return onSnapshot(q, 
    (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LearningMaterial)));
    },
    (error) => {
      console.error("Materials subscription error:", error);
      if (onError) onError(error);
    }
  );
};

export const updateQuizStatusInCloud = async (id: string, status: 'approved' | 'rejected') => {
  await updateDoc(doc(db, 'quizzes', id), { status });
};

export const updateMaterialStatusInCloud = async (id: string, status: 'approved' | 'rejected') => {
  await updateDoc(doc(db, 'materials', id), { status });
};

export const getInstructorContent = async (instructorId: string) => {
  const materialsQuery = query(collection(db, 'materials'), where('uploadedBy', '==', instructorId));
  const quizzesQuery = query(collection(db, 'quizzes'), where('uploadedBy', '==', instructorId));
  
  const [matSnap, quizSnap] = await Promise.all([getDocs(materialsQuery), getDocs(quizzesQuery)]);
  
  return {
    materials: matSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningMaterial)),
    quizzes: quizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
  };
};

export const getCurriculum = async () => {
  const snap = await getDoc(doc(db, 'system', 'curriculum'));
  return snap.exists() ? snap.data().data : null;
};

export const saveCurriculum = async (data: any) => {
  await setDoc(doc(db, 'system', 'curriculum'), { data });
};
