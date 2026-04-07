// Fix: Use namespace import for firebase/app to resolve named export error
import * as firebase from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const { initializeApp } = firebase as any;

const firebaseConfig = {
  apiKey: "AIzaSyCWFxGttlPGUX9-BPfl1H0p6CN_zRKEuCU",
  authDomain: "councilcrack.firebaseapp.com",
  projectId: "councilcrack",
  storageBucket: "councilcrack.firebasestorage.app",
  messagingSenderId: "325806144910",
  appId: "1:325806144910:web:e983123e993a8e5a6e78df"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);