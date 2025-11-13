
# CLARA - AI Receptionist & Staff Management SystemA unified monorepo platform for real-time video calls, AI-powered chat assistance, staff management, and productivity tools.## 🚀 Quick Start### Prerequisites- Node.js 18+- npm or pnpm- PostgreSQL (optional - falls back to in-memory)### Installation# Clone repositorygit clone https://github.com/Aashuthosh10/CLARA_WOW.gitcd CLARA_WOW/deploy-clara# Install dependenciesnpm install# Set up environmentcp env.example .env# Start development serversnpm run dev**Access:**- Client: http://localhost:5173- Staff: http://localhost:5174- Server: http://localhost:8080**Demo Login (Staff):**- Email: `nagashreen@gmail.com`- Password: `password`## 📦 Architecture
Access:
Client: http://localhost:5173
Staff: http://localhost:5174
Server: http://localhost:8080
Demo Login (Staff):
Email: nagashreen@gmail.com
Password: password
📦 Architecture
apps/├── client/     # Client interface (React + Vite)├── staff/      # Staff dashboard (React + Vite)└── server/     # Unified Express + Socket.IO sents, Tasks, AI Assistant- **Attendance Management**: Excel import, semester/section filtering, present/absent marking- **AI Chat**: Google Gemini-powered conversational assistant- **Team Collaboration**: Team directory, group chat, meeting management- **Real-time Notifications**: Socket.IO-based notification system## 🛠️ Developmentnpm run dev              # Start all servicesnpm run dev:server-only # Backend onlynpm run dev:client      # Client onlynpm run dev:staff       # Staff onlynpm run build           # Production buildnpm start               # Start production server## 📡 Key API Endpoints- `POST /api/auth/login` - Staff login- `POST /api/v1/calls` - Initiate video call- `POST /api/attendance/import` - Import students- `GET /api/attendance/students?sem=X&section=Y` - Get students- `POST /api/attendance/mark` - Mark attendance- `GET /healthz` - Health check## 🔧 Environment VariablesKey variables (see `env.example` for full list):NODE_ENV=developmentSERVER_PORT=8080ENABLE_UNIFIED_MODE=trueJWT_SECRET=your_secretDATABASE_URL=postgres://user:pass@localhost:5432/claraGEMINI_API_KEY=your_key## 📝 Attendance Module**Excel Format:**- Column 0: SL NO- Column 1: USN- Column 2: NAME**Features:**- Import from Excel/CSV or Google Sheets- Filter by semester (1-8) and section (A-D)- Mark present/absent with radio buttons- Submit attendance with validation## 🚢 Deploymentash# Buildnpm run build# Start productionnpm start## 📄 LicensePrivate---**Repository**: https://github.com/Aashuthosh10/CLARA_WOW.git
✨ Features
Video Calling: WebRTC-based real-time video calls between clients and staff
Staff Dashboard: Timetable, Attendance, Appointments, Tasks, AI Assistant
Attendance Management: Excel import, semester/section filtering, present/absent marking
AI Chat: Google Gemini-powered conversational assistant
Team Collaboration: Team directory, group chat, meeting management
Real-time Notifications: Socket.IO-based notification system
🛠️ Development
npm run dev              # Start all servicesnpm run dev:server-only # Backend onlynpm run dev:client      # Client onlynpm run dev:staff       # Staff onlynpm run build           # Production buildnpm start               # Start production server
📡 Key API Endpoints
POST /api/auth/login - Staff login
POST /api/v1/calls - Initiate video call
POST /api/attendance/import - Import students
GET /api/attendance/students?sem=X&section=Y - Get students
POST /api/attendance/mark - Mark attendance
GET /healthz - Health check
🔧 Environment Variables
Key variables (see env.example for full list):
NODE_ENV=developmentSERVER_PORT=8080ENABLE_UNIFIED_MODE=trueJWT_SECRET=your_secretDATABASE_URL=postgres://user:pass@localhost:5432/claraGEMINI_API_KEY=your_key
📝 Attendance Module
Excel Format:
Column 0: SL NO
Column 1: USN
Column 2: NAME
Features:
Import from Excel/CSV or Google Sheets
Filter by semester (1-8) and section (A-D)
Mark present/absent with radio buttons
Submit attendance with validation
🚢 Deployment
# Buildnpm run build# Start productionnpm start
📄 License
Private
