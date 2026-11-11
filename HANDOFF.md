# HANDOFF — Leadership Quest (Gamification App)

> **Active Sprint (2026-11-11):** Phase 2 — LHT Ecosystem Integration (Step 1: Inbound SSO, Batch Provisioning, LIFF Learner Gateway, Reflection XP Bridge, and Completion Callback)
> เอกสารฉบับนี้เขียนขึ้นเพื่อให้ทีมพัฒนา/AI ทำงานต่อได้ทันที โดยอิงตาม `MASTER_PRODUCT_SPEC.md` Section 13

---

## 1. ผลิตภัณฑ์โดยย่อ (Product Summary)
Leadership Quest คือ Web Application สำหรับใช้จัดกิจกรรม Gamification สดในห้องเรียนสัมมนาของ Learning Hub Thailand (LHT):
- **กลุ่มผู้ใช้หลัก:** ผู้เรียนหลักสูตรผู้นำ (ผ่านมือถือ/LIFF/แท็บเล็ต), วิทยากร (Facilitator), และแอดมิน (Operation Team)
- **ฟังก์ชันหลักที่เสร็จแล้ว (Phase 1):**
  - บันทึกการเข้าเรียน Attendance 1–20 sessions ต่อ Batch (ค่าเริ่มต้น 5 sessions)
  - Setup Center: กำหนดชื่อกิจกรรม, XP เกณฑ์, คำสั่งการบ้านราย Batch
  - Quest & XP Engine: กิจกรรมตอบคำถาม, สะสมแต้ม, เลื่อน Level 1–5
  - Real-time Leaderboard: Top 3 Podium และระบบ Tie-breaker
  - Facilitator Review Queue: ตรวจงาน/การบ้านสดในห้องเรียน พร้อมแนบไฟล์ PDF/รูปภาพ
  - ระบบ Audit Log และ RLS Security ป้องกันการแก้ไขข้าม Batch

---

## 2. แผนงานที่ต้องทำทันที (Active Tasks — Step 1: Inbound Integration)

เพื่อให้ระบบเชื่อมโยงเข้ากับ **LHT Training Operations OS (`lht-training-os`)** และ **AI Leadership Companion (`Ai-Leadership-Companion`)** ได้อย่างสมบูรณ์:

### 2.1 Admin SSO Inbound Endpoint (`/api/public/sso/ops`)
- **วัตถุประสงค์:** รองรับปุ่มเมนู "Leadership Quest" จากแถบเมนูด้านซ้ายของ Training Ops เพื่อให้ทีมงานข้ามมาจัดการ Setup Center / Review Queue ได้โดยไม่ต้องล็อกอินซ้ำ
- **สเปกความปลอดภัย:**
  - รับพารามิเตอร์ `email`, `exp`, `sig`
  - ตรวจสอบ HMAC-SHA256(`OPS_SYNC_SECRET`, `${email}|${exp}`) แบบ timing-safe
  - ปฏิเสธคำขอที่หมดอายุ (`exp < now`) หรือล่วงหน้าเกิน 5 นาที
  - แมปผู้ใช้เข้ากับสิทธิ์ `facilitator` หรือ `admin` ในระบบ Gamification และสร้าง Supabase Session อัตโนมัติ

### 2.2 Batch & Roster Provisioning Endpoint (`POST /api/public/ops-sync/batch`)
- **วัตถุประสงค์:** สร้างห้องเรียนเควสต์และรายชื่อผู้เรียนอัตโนมัติเมื่อ Training Ops คอนเฟิร์มงานอบรม
- **Request Format:**
  - Header: `x-api-key: $OPS_SYNC_SECRET` หรือ HMAC Signature
  - Body:
    ```json
    {
      "job_ref": "2026-09-001",
      "batch_code": "OPS-2026-09-001",
      "batch_name": "Leadership Excellence - Batch 1",
      "client_name": "ACME Corp",
      "course_title": "Agile Leadership Quest",
      "session_count": 5,
      "roster": [
        {
          "email": "somchai@acme.com",
          "display_name": "สมชาย ใจดี",
          "line_user_id": "U1234567890abcdef...",
          "group_no": 1
        }
      ]
    }
    ```
- **การประมวลผล:**
  - Upsert ลงตาราง `batches` (รหัส Batch คือ `OPS-{job_ref}`)
  - สร้างกลุ่มตาม `group_no` และลงทะเบียนผู้เรียนลงในตาราง `participants`

### 2.3 LIFF Learner Gateway (`/auth/liff-callback`)
- **วัตถุประสงค์:** ผู้เรียนกดปุ่ม `Quest & Ranking` ใน LINE OA ลินน์ แล้วเปิด Web App เควสต์ได้ทันที
- **สเปก:**
  - รับ Query: `line_user_id`, `cohort`, `sig`, `exp`
  - ตรวจสอบลายเซ็น HMAC-SHA256
  - ค้นหาผู้เรียนในรุ่นที่มี `line_user_id` ตรงกัน แล้วเข้าสู่หน้า Dashboard / Leaderboard ของรุ่นตนเองทันที

### 2.4 Reflection XP Webhook Receiver (`POST /api/public/quest-xp/reflection`)
- **วัตถุประสงค์:** รับคะแนนสะท้อนคิดเมื่อผู้เรียนคุยหรือทำเช็กอินรายสัปดาห์กับลินน์สำเร็จ
- **Payload:** `{ "job_ref": "...", "line_user_id": "...", "action": "ai_reflection_completed", "xp_amount": 50 }`
- **การประมวลผล:** บันทึก XP ลงตาราง `xp_transactions` ทันที

### 2.5 Completion Event Callback to Training Ops
- **วัตถุประสงค์:** เมื่อผู้เรียนสะสม Attendance ครบตามเกณฑ์ (เช่น >= 80%) และ XP ผ่าน Gate
- **Action:** ยิง Webhook กลับไปยัง Training Ops (`POST /api/public/v1/events`) เพื่อปลดล็อก e-Certificate ให้นักเรียนดาวน์โหลดในปุ่ม `Assess & Cert`

---

## 3. Environment Variables & Secrets ที่ต้องตั้งค่า
- `OPS_SYNC_SECRET`: Shared secret สำหรับ HMAC-SHA256 ระหว่าง Training Ops, Linn, และ Gamification App
- `TRAINING_OPS_BASE_URL`: ค่าเริ่มต้น `https://training-ops.lovable.app`
- `COMPANION_BASE_URL`: ค่าเริ่มต้น `https://ai-leadership-companion.lovable.app`
