import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBzYwd-wdKB5hYAtO-A-gqKOoU9iy4LSFY",
  authDomain: "next-input-list.firebaseapp.com",
  projectId: "next-input-list",
  storageBucket: "next-input-list.firebasestorage.app",
  messagingSenderId: "603805748518",
  appId: "1:603805748518:web:dc32c0a26a546b8ace05e7",
};

// avoid re-initialising in dev
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
