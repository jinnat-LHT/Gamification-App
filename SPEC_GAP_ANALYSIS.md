# Leadership Quest Admin Portal — Spec Gap Analysis

วันที่ตรวจ: 14 สิงหาคม 2026

ไฟล์อ้างอิง:

- Spec: `source/Admin Portal Spec.docx`
- HTML เดิม: `source/Leadership_quest_Admin.html`
- HTML ที่พัฒนาต่อ: `Leadership_quest_Admin_Enhanced.html`

## สรุปผล

HTML เดิมครอบคลุมแกนหลักของสเปกแล้ว ได้แก่โครงสร้าง Program → Batch → Group, Persistent Context Bar, Quest Gatekeeper, การจัดการกลุ่ม/ผู้เรียน/คะแนน, Quiz Bank, CSV Export และ Projector Arena แต่ยังขาดความครบถ้วนในโครงสร้างเมนู Admin, Executive Analytics และ Quick Role Switcher

## Comparison Matrix

| หมวดตาม Spec | สถานะใน HTML เดิม | ช่องว่างที่พบ | สิ่งที่พัฒนาต่อ |
|---|---|---|---|
| 3-Tier Hierarchy | มี | ไม่มีช่องว่างหลัก | คงโครงสร้าง Program → Batch → Group และการแยกข้อมูลตาม Batch |
| Persistent Context Bar | มี | ไม่มีช่องว่างหลัก | คง Cascading Dropdown, Quick Creator และสถิติกลุ่ม/สมาชิก/XP |
| Quest Gatekeeper | มีครบ 8 สวิตช์ | ไม่มีช่องว่างหลัก | คง Default State และผลล็อกใน Learner View |
| Admin Control Panel 4 เมนู | มีเพียง 2 เมนู โดยรวมทุกอย่างไว้ใน Management | ไม่ตรง IA ตามสเปก | แยกเป็น Setup Center, Quiz Bank, Users & Scores และ Executive Reports |
| Setup Center | มี | UI ปะปนกับฟังก์ชันอื่น | แสดงเฉพาะ Program, Batch, Gatekeeper และ Group Management ตามเมนู |
| Master Quiz Bank | มี | อยู่ท้ายหน้า Management | แยกเป็นเมนู Quiz Bank พร้อม Knowledge/Behavioral sub-tab |
| Users & Scores | มี | อยู่รวมกับ Setup/Quiz | แยกเป็นเมนู Users & Scores พร้อม Rapid Group Score, Roster, Attendance และ Live XP |
| Executive Analytics KPI | มี 3 ค่า และ 2 ค่าเป็นข้อความคงที่ | ขาดจำนวนผู้เรียนและการคำนวณจริง | เพิ่ม KPI 4 ค่าและคำนวณจาก Batch ปัจจุบันทั้งหมด |
| Executive Analytics Charts | มีเฉพาะ Radar 1 กราฟ และใช้ข้อมูลคงที่ | ขาด 5 กราฟและข้อมูลจริง | เพิ่มครบ 6 กราฟ: Knowledge, Radar, Attendance, Assignments, Level Distribution และ Group Average XP |
| CSV Export | มีเฉพาะข้อมูลพื้นฐานและ Total XP | ขาดคะแนน/สถิติรายคน | เพิ่ม Pre/Post, Growth %, Attendance, Assignment, Behavior Average และ Total XP พร้อม UTF-8 BOM |
| Quick Role Switcher | มีการสลับบัญชีผ่าน modal | ไม่มีปุ่ม Admin → Learner View แบบคลิกเดียว | เพิ่ม Preview Learner และปุ่มกลับ Admin ทั้ง Desktop/Mobile |
| Projector Arena Top 10 | มี | ไม่มีช่องว่างหลัก | คง Single-screen Top 10 |

## ข้อจำกัดที่ยังเหลือสำหรับ Production

ไฟล์นี้ยังเป็น standalone prototype ที่เก็บข้อมูลด้วย `localStorage` และโหลดไลบรารีจาก CDN จึงยังไม่ใช่ระบบ Enterprise แบบหลายผู้ใช้จริง งานระยะถัดไปควรเพิ่ม Backend/API, ฐานข้อมูลกลาง, Authentication/Role-Based Access Control, Audit Log, การตรวจสอบข้อมูลซ้ำ และการทดสอบแบบ end-to-end ก่อนนำขึ้น Production
