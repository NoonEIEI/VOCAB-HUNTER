import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAtVF9PO_HG2WEFo8uwaGM6qh4ARHdx6Jw",
  authDomain: "vocab-hunter-3bc43.firebaseapp.com",
  projectId: "vocab-hunter-3bc43",
  storageBucket: "vocab-hunter-3bc43.firebasestorage.app",
  messagingSenderId: "521347090482",
  appId: "1:521347090482:web:4d992a62111f534752942b",
  measurementId: "G-CQRNWLT3CZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
// บังคับให้ขึ้นหน้าเลือกบัญชี Google ทุกครั้ง (ไม่ล็อกอินบัญชีเดิมให้อัตโนมัติ)
googleProvider.setCustomParameters({ prompt: "select_account" });
export { signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };