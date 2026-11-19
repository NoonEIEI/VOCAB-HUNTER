import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// เกม Vocab Hunter เป็น HTML/JS ธรรมดา (ไม่ใช้ React)
// โค้ดเกมทั้งหมดอยู่ใน public/ — Vite จะคัดลอกไปไว้ใน dist/ ตามเดิม
export default defineConfig({
  // ต้องตรงกับชื่อ repo บน GitHub (ตัวพิมพ์ใหญ่-เล็กต้องตรงกันด้วย)
  base: '/VOCAB-HUNTER/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // deploy ใหม่แล้ว แอปในมือถืออัปเดตเองเมื่อเปิดครั้งถัดไป
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vocab Hunter — ล่าคำศัพท์',
        short_name: 'Vocab Hunter',
        description: 'เกมค้นหาคำศัพท์ ฝึกฟังและพูดภาษาอังกฤษ',
        lang: 'th',
        theme_color: '#c9a6f5',
        background_color: '#f3d6f0',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // เก็บไฟล์เกม รูปแผนที่ และไอคอนไว้ในเครื่อง → เล่นได้แม้ไม่มีเน็ต
        globPatterns: ['**/*.{html,js,css,png,webp,ico,svg,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
})
