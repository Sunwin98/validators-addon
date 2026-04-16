# Add-on Inspector

> Minecraft Bedrock Add-on Validator — ตรวจสอบทุกอย่างบนเบราว์เซอร์ ไม่มีการอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์

![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)
![Platform](https://img.shields.io/badge/platform-browser-lightgrey?style=flat-square)

---

## Overview

Add-on Inspector คือเครื่องมือตรวจสอบคุณภาพ Minecraft Bedrock Add-on แบบ client-side ทั้งหมด รองรับการลาก-วางไฟล์ `.mcaddon` `.mcpack` หรือ `.zip` โดยตรง จากนั้นแตกไฟล์ วิเคราะห์โครงสร้าง และแสดงผลในรูปแบบ VS Code Workbench ที่คุ้นเคย — พร้อม Monaco Editor สำหรับดูและแก้ไขโค้ดในทันที

---

## Features

| หมวดหมู่ | รายละเอียด |
|---|---|
| **VS Code Workbench** | Monaco Editor 0.52.2, ระบบแท็บหลายไฟล์, syntax highlighting, image preview |
| **File Explorer** | Tree view แสดงโครงสร้างทั้ง BP + RP พร้อมสัญลักษณ์ error/warning ต่อไฟล์ |
| **Problems Panel** | แยกคอลัมน์ขวา แบ่ง category, กดที่ชื่อไฟล์เพื่อ jump ไปยังบรรทัดที่มีปัญหา |
| **10 Validators** | ตรวจสอบครอบคลุมทุกส่วนของ Add-on (ดูรายละเอียดด้านล่าง) |
| **Accessible** | Skip-link, focus ring, keyboard navigation, `prefers-reduced-motion` |
| **Privacy** | ประมวลผลทั้งหมดในเบราว์เซอร์ — ไม่มีการส่งข้อมูลออกนอก |

---

## Validators

```
JSON Syntax          ตรวจ syntax JSON ทุกไฟล์ใน pack
Manifest             UUID, version, dependencies, module type
Item Cross-Reference ตรวจว่า identifier ใน BP ↔ RP ตรงกัน
Texture Path         ตรวจว่า path ใน item_texture.json มีไฟล์จริงอยู่
Model / Geometry     identifier ใน geo file และ attachable ต้องสอดคล้องกัน
Animation            ตรวจ animation reference ใน attachable
Function             ตรวจ mcfunction syntax และ tick.json
Script               ตรวจ import, module type ใน manifest
Language File        ตรวจ key ใน en_US.lang ว่าครบและไม่ซ้ำ
Unused Assets        แจ้งเตือน texture / geometry ที่ไม่ถูกอ้างอิง
```

---

## Getting Started

ไม่ต้องติดตั้งอะไร — เปิดไฟล์ `index.html` ในเบราว์เซอร์ได้เลย

```bash
git clone https://github.com/Sunwin98/validators-addon.git
cd validators-addon
# เปิด index.html ใน browser โดยตรง หรือใช้ live server
```

> **แนะนำ:** ใช้ VS Code + Live Server extension เพื่อประสบการณ์ที่ดีที่สุด (Monaco Editor ต้องการ HTTP server)

---

## Usage

1. ลากไฟล์ `.mcaddon` / `.mcpack` / `.zip` มาวางในพื้นที่ drop zone
2. หรือกดปุ่ม **เลือกไฟล์** (รองรับหลายไฟล์พร้อมกัน)
3. รอระบบแตกไฟล์และตรวจสอบ
4. ดูผลลัพธ์ใน 3-column layout:
   - **ซ้าย** — File Explorer: คลิกไฟล์เพื่อเปิดใน editor
   - **กลาง** — Monaco Editor: ดูและแก้ไขโค้ด
   - **ขวา** — Problems Panel: รายการปัญหาแยกตาม category

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (IIFE modules), CSS Grid, CSS Custom Properties
- **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) 0.52.2
- **ZIP Extraction:** [JSZip](https://stuk.github.io/jszip/) 3.10.1
- **Fonts:** IBM Plex Sans Thai, Outfit, JetBrains Mono (Google Fonts)
- **Dependencies:** ศูนย์ — ไม่มี framework ไม่มี build step

---

## Project Structure

```
validators-addon/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js                  # Main orchestrator, drag & drop
    ├── editor-manager.js       # Monaco Editor wrapper, tab management
    ├── ui-renderer.js          # Dashboard, workbench, issue list
    ├── unzipper.js             # ZIP extraction, file tree builder
    └── validators/
        ├── json-syntax-validator.js
        ├── manifest-validator.js
        ├── item-validator.js
        ├── texture-validator.js
        ├── model-validator.js
        ├── animation-validator.js
        ├── function-validator.js
        ├── script-validator.js
        ├── lang-validator.js
        └── unused-validator.js
```

---

## Browser Support

| Browser | Version |
|---|---|
| Chrome / Edge | 90+ |
| Firefox | 88+ |
| Safari | 15+ |

---

## License

MIT © [Heaven Send](https://github.com/Sunwin98)
