// =====================================================================
// Vocab Hunter — Google Login + Firestore (Week 12)
// ES module (Vite bundle ให้) → รันหลัง classic script ใน public/js เสมอ
// โค้ดเกม (public/js/app.js) ใช้ผ่าน window.VHAuth และฟัง event "vhauth-change"
//
// ข้อมูลบนคลาวด์: userProgress/{uid} = { saveData, totalStars, displayName, updatedAt }
// localStorage ยังเป็นที่เก็บหลักเหมือนเดิม — คลาวด์เป็นสำเนาสำรอง/ย้ายเครื่อง
// ถ้าออฟไลน์หรือ Firebase error ฟังก์ชันทั้งหมดจะ throw/คืนค่า แต่ไม่ทำให้เกมพัง
// =====================================================================
import { auth, googleProvider, db, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc } from "./firebase";

const COLLECTION = "userProgress";
const FETCH_TIMEOUT_MS = 8000; // getDoc ตอนออฟไลน์อาจค้างนาน → ตัดจบเอง

const toPlainUser = (u) =>
  u ? { uid: u.uid, displayName: u.displayName || "นักล่าคำศัพท์", photoURL: u.photoURL || "", email: u.email || "" } : null;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);

const VHAuth = {
  user: null, // { uid, displayName, photoURL, email } หรือ null
  ready: false, // true เมื่อ Firebase บอกสถานะล็อกอินครั้งแรกแล้ว

  login() {
    return signInWithPopup(auth, googleProvider).then((cred) => toPlainUser(cred.user));
  },

  logout() {
    return signOut(auth);
  },

  // อ่าน saveData จากคลาวด์ → object หรือ null (ไม่มีข้อมูล) — error/ออฟไลน์จะ throw
  async loadProgress() {
    const user = auth.currentUser;
    if (!user) return null;
    const snap = await withTimeout(getDoc(doc(db, COLLECTION, user.uid)), FETCH_TIMEOUT_MS);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data && typeof data.saveData === "object" ? data.saveData : null;
  },

  // เหมือน saveProgress แต่รอไม่เกิน timeoutMs — ใช้ตอนออกจากระบบ
  // (ออฟไลน์ setDoc จะไม่ resolve จนกว่าจะกลับมาออนไลน์ จึงต้องตัดจบเอง) → true/false
  saveProgressNow(saveData, timeoutMs = 6000) {
    return withTimeout(VHAuth.saveProgress(saveData), timeoutMs).catch((err) => {
      console.warn("[VHAuth] final save failed", err);
      return false;
    });
  },

  // เขียน saveData ขึ้นคลาวด์ (เขียนทับทั้งเอกสาร)
  saveProgress(saveData) {
    const user = auth.currentUser;
    if (!user) return Promise.resolve(false);
    // JSON round-trip: ตัด undefined/ฟังก์ชันออก เพราะ Firestore ไม่รับค่า undefined
    const clean = JSON.parse(JSON.stringify(saveData));
    return setDoc(doc(db, COLLECTION, user.uid), {
      saveData: clean,
      totalStars: Number(clean.totalStars) || 0,
      displayName: user.displayName || "",
      updatedAt: Date.now()
    }).then(() => true);
  }
};

onAuthStateChanged(auth, (user) => {
  VHAuth.user = toPlainUser(user);
  VHAuth.ready = true;
  window.dispatchEvent(new CustomEvent("vhauth-change", { detail: { user: VHAuth.user } }));
});

window.VHAuth = VHAuth;
