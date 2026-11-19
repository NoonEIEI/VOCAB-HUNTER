// =====================================================================
// Vocab Hunter — IndexedDB (ผ่าน Dexie)
// localStorage (saveData ใน public/js/app.js) ยังเก็บความคืบหน้าหลักเหมือนเดิม
// ส่วนไฟล์นี้เก็บ "ประวัติ" ที่เพิ่มขึ้นเรื่อย ๆ ลง IndexedDB:
//   - rounds   : ผลทุกรอบที่เล่นจบ
//   - speaking : ทุกครั้งที่ผู้เล่นพูด/พิมพ์ตอบ แล้วถูกประเมิน
//
// ไฟล์นี้เป็น ES module (Vite bundle ให้) ซึ่งรันหลัง classic script ใน index.html
// โค้ดเกมจึงต้องเช็ก window.VHDB?.available ก่อนใช้ทุกครั้ง
// ถ้า IndexedDB ใช้ไม่ได้ (เช่น โหมดส่วนตัวบางเบราว์เซอร์) เกมยังเล่นได้ปกติ แค่ไม่มีประวัติ
// =====================================================================
import Dexie from 'dexie'

export const db = new Dexie('VocabHunterDB')

// Schema: ระบุเฉพาะ primary key + field ที่ต้องใช้ทำ index
// ฟิลด์อื่น ๆ (mapName, stars, misses ฯลฯ) เก็บได้โดยไม่ต้องประกาศ
db.version(1).stores({
  // { id, mapId, mapName, round, mode, stars, misses, radarUses, durationSec, questCount, date }
  rounds: '++id, mapId, date',
  // { id, wordId, word, mapId, score, passed, date }
  speaking: '++id, wordId, date'
})

const VHDB = {
  db,
  available: false,
  // Promise ที่ resolve เป็น true/false — ใช้ await ได้ถ้าต้องการรอ
  ready: null
}

VHDB.ready = db
  .open()
  .then(() => {
    VHDB.available = true
    return true
  })
  .catch((err) => {
    console.warn('[VHDB] IndexedDB ใช้งานไม่ได้ — เกมจะเล่นต่อได้โดยไม่บันทึกประวัติ', err)
    VHDB.available = false
    return false
  })
  .then((ok) => {
    window.dispatchEvent(new CustomEvent('vhdb-ready', { detail: { available: ok } }))
    return ok
  })

window.VHDB = VHDB
