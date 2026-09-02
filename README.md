# TA Wave Hub

โปรแกรมวิเคราะห์ทางเทคนิค (Technical Analysis) สำหรับหุ้น สินค้าโภคภัณฑ์ และคริปโต โดยเน้นการนับคลื่นเอลเลียต (Elliott Wave) แบบอัตโนมัติ พร้อมอินดิเคเตอร์พื้นฐาน, ตัวสแกนหาโอกาสเข้า Wave 3, และระบบ Backtest ย้อนหลัง

โครงสร้างโปรเจกต์เป็นแบบ 2 ส่วนแยกกัน:

- **server/** — Express + TypeScript API ที่ดึงราคาจาก Binance (คริปโต) และ Yahoo Finance (หุ้น/สินค้าโภคภัณฑ์) มาคำนวณอินดิเคเตอร์และนับคลื่น
- **client/** — React + Vite + TypeScript หน้าเว็บแสดงกราฟ (lightweight-charts), แผงคลื่น, ตัวสแกนเนอร์ และ Backtest

## สิ่งที่ต้องมีก่อนเริ่ม

- Node.js เวอร์ชัน 18 ขึ้นไป (แนะนำ 20+)
- npm (ติดมากับ Node.js)
- ไม่ต้องใช้ API key ใด ๆ — ระบบดึงข้อมูลราคาจาก Binance public API และ Yahoo Finance public endpoint โดยตรง

## การติดตั้ง

ติดตั้ง dependency ของทั้งสองฝั่งแยกกัน:

```bash
cd server && npm install
```

```bash
cd client && npm install
```

## วิธีรันโปรแกรม (โหมดพัฒนา)

ต้องรันทั้ง server และ client พร้อมกัน คนละ terminal:

**1) รัน API server** (พอร์ต 4000 ตามค่าเริ่มต้น)

```bash
cd server && npm run dev
```

**2) รัน client** (พอร์ต 5173 ตามค่าเริ่มต้นของ Vite)

```bash
cd client && npm run dev
```

จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:5173`

> Vite ตั้งค่า proxy ให้ path `/api` ชี้ไปที่ `http://localhost:4000` อัตโนมัติ (ดูใน `client/vite.config.ts`) จึงต้องรัน server ให้ติดก่อนถึงจะเรียกข้อมูลได้

หากต้องการเปลี่ยนพอร์ตของ server ให้ตั้งค่า environment variable `PORT` ก่อนรัน เช่น:

```bash
PORT=5000 npm run dev --prefix server
```

(ถ้าเปลี่ยนพอร์ต server ต้องแก้ `target` ใน `client/vite.config.ts` ให้ตรงกันด้วย)

## การใช้งานหน้าเว็บ

หน้าเว็บแบ่งเป็น 3 มุมมอง เลือกได้จากแท็บด้านบน:

1. **กราฟ** — เลือกตลาด (หุ้น/สินค้าโภคภัณฑ์/คริปโต) และสัญลักษณ์จาก sidebar ด้านซ้าย ตั้งค่า Timeframe (1H/1D/1W) และความไวของ Zigzag (ใช้กำหนดว่าคลื่นจะ "หัก" เมื่อราคาสวิงกี่เปอร์เซ็นต์) จากแถบด้านบน แล้วเปิด/ปิด overlay ต่าง ๆ ได้ เช่น SMA, EMA, Bollinger Bands, เส้นคลื่นเอลเลียตที่ดีที่สุด, แผนที่คลื่นเต็มรูปแบบ, Fibonacci Retracement, Volume และ CDC Action Zone
   - แผงด้านขวาจะแสดงผลการนับคลื่นและผล Multi-timeframe check
   - กดไอคอนดาว ★ เพื่อเพิ่ม/นำสัญลักษณ์ออกจาก Watchlist ส่วนตัว
2. **Wave 3 Scanner** — สแกนหาสัญลักษณ์ทั้งหมดในตลาดที่เลือก (หรือเฉพาะ Watchlist) ว่าตัวไหนกำลังอยู่ในช่วงคลื่น 2 กำลังจะขึ้นคลื่น 3 พร้อมบอกระดับความมั่นใจและว่ามี CDC Action Zone ยืนยันทิศทางเดียวกันหรือไม่
3. **Backtest** — ทดสอบย้อนหลังว่าสัญญาณคลื่น 3 ที่ระบบหาเจอ ทำผลตอบแทนจริงเป็นอย่างไรในอดีต (5/10/20 แท่งข้างหน้า) ทั้งแบบรวมทุกสัญญาณและแยกตามว่ามี CDC confluence หรือไม่

การตั้งค่า (Timeframe, ความไว Zigzag, overlay ที่เปิดไว้) และ Watchlist/รายการที่เพิ่งดูล่าสุด จะถูกบันทึกไว้ใน localStorage ของเบราว์เซอร์ ครั้งหน้าเปิดมาจะจำค่าล่าสุดให้อัตโนมัติ

## การ build สำหรับ production

**Server:**

```bash
cd server
npm run build   # คอมไพล์ TypeScript ไปที่ dist/
npm start       # รันจาก dist/index.js
```

**Client:**

```bash
cd client
npm run build   # ได้ไฟล์ static ใน client/dist/
npm run preview # พรีวิว build ที่ได้ก่อน deploy จริง
```

เมื่อ deploy จริง ต้องตั้งค่าเซิร์ฟเวอร์ (reverse proxy หรือ Vite build config) ให้ path `/api` ของฝั่ง client ชี้ไปยัง URL ของ server ที่ deploy ไว้จริง เพราะ proxy ใน `vite.config.ts` ใช้ได้เฉพาะตอนรัน dev server เท่านั้น

## คำสั่งอื่น ๆ ที่มีประโยชน์

```bash
cd client && npm run lint   # ตรวจโค้ดฝั่ง client ด้วย oxlint
```

## โครงสร้างไฟล์คร่าว ๆ

```
server/src/
  index.ts              # จุดเริ่ม Express app
  routes/api.ts         # /api/symbols, /api/search, /api/analyze, /api/mtf, /api/backtest, /api/scan/wave3
  services/
    binance.ts           # ดึงแท่งเทียนคริปโตจาก Binance
    yahoo.ts              # ดึงแท่งเทียนหุ้น/สินค้าโภคภัณฑ์จาก Yahoo Finance
    marketData.ts         # รวมแหล่งข้อมูล + cache
    indicators.ts         # SMA, EMA, RSI, MACD, Bollinger, CDC Action Zone
    elliottWave.ts         # อัลกอริทึมนับคลื่นเอลเลียต
    backtest.ts            # คำนวณสัญญาณย้อนหลังและสถิติ

client/src/
  App.tsx                 # เชื่อมทุกส่วนเข้าด้วยกัน + จัดการ state/localStorage
  api.ts                   # เรียก API ของ server
  components/              # PriceChart, Sidebar, WavePanel, MtfPanel, Wave3Scanner, BacktestPanel, SymbolLogo
```
