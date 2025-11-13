<div align="center">

# 🤖 CLARA

### AI Receptionist & Comprehensive Staff Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

*A unified monorepo platform combining real-time video communications, AI-powered assistance, and enterprise-grade staff management tools*

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation) • [Demo](#-demo)

</div>

---

## 🌟 Overview

CLARA is a comprehensive enterprise solution that bridges communication gaps between clients and staff while providing powerful management tools for educational institutions and organizations. Built with modern web technologies, it offers:

- **Real-time Video Communication**: WebRTC-powered video calls with low latency
- **AI-Powered Assistant**: Google Gemini integration for intelligent chat support
- **Staff Management Suite**: Complete dashboard for attendance, scheduling, and task management
- **Team Collaboration**: Built-in messaging, meeting coordination, and directory services
- **Attendance System**: Advanced Excel/CSV import with filtering and reporting capabilities

## ✨ Features

### 🎥 Video Calling System
- WebRTC-based peer-to-peer video communication
- Real-time call initiation and management
- Seamless client-to-staff connection
- Call status tracking and history

### 👨‍💼 Staff Dashboard
- **Timetable Management**: View and manage class schedules
- **Attendance Tracking**: Mark and monitor student attendance
- **Appointment System**: Schedule and manage meetings
- **Task Management**: Organize and track assignments
- **AI Chat Assistant**: Get intelligent help and suggestions

### 📊 Attendance Management
- **Excel/CSV Import**: Bulk upload student data
- **Smart Filtering**: Filter by semester (1-8) and section (A-D)
- **Quick Marking**: Radio button interface for present/absent
- **Google Sheets Integration**: Direct import from cloud spreadsheets
- **Validation System**: Ensure data integrity before submission

### 🤖 AI Chat Integration
- Google Gemini-powered conversational AI
- Context-aware responses
- Natural language understanding
- Real-time assistance for staff and clients

### 👥 Team Collaboration
- Team directory with member profiles
- Group chat functionality
- Meeting management and scheduling
- Real-time notifications via Socket.IO

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:
- **Node.js** 18.x or higher
- **npm** or **pnpm** package manager
- **PostgreSQL** (optional - falls back to in-memory database)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aashuthosh10/CLARA_WOW.git
   cd CLARA_WOW/deploy-clara
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` file with your configuration (see [Environment Variables](#-environment-variables))

4. **Start development servers**
   ```bash
   npm run dev
   ```

### 🌐 Access Points

Once running, access the application at:

- **Client Interface**: http://localhost:5173
- **Staff Dashboard**: http://localhost:5174  
- **API Server**: http://localhost:8080

### 🔐 Demo Credentials

**Staff Login:**
- Email: `nagashreen@gmail.com`
- Password: `password`

## 📦 Architecture

### Monorepo Structure

```
CLARA_WOW/
└── deploy-clara/
    ├── apps/
    │   ├── client/          # Client-facing interface (React + Vite)
    │   ├── staff/           # Staff dashboard (React + Vite)
    │   └── server/          # Unified Express + Socket.IO backend
    ├── packages/            # Shared utilities and components
    └── env.example          # Environment configuration template
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for fast development and building
- Socket.IO Client for real-time updates
- Modern CSS for responsive design

**Backend:**
- Node.js with Express
- Socket.IO for WebSocket communication
- PostgreSQL with in-memory fallback
- JWT for authentication
- Google Gemini API for AI features

**Real-time Communication:**
- WebRTC for peer-to-peer video
- Socket.IO for events and notifications
- REST API for data operations

## 🛠️ Development

### Available Scripts

```bash
# Start all services (client + staff + server)
npm run dev

# Start individual services
npm run dev:server-only    # Backend only
npm run dev:client          # Client interface only  
npm run dev:staff           # Staff dashboard only

# Build for production
npm run build

# Start production server
npm start
```

### Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services in development mode |
| `npm run build` | Build production bundles |
| `npm start` | Run production server |
| `npm test` | Run test suite |

## 📡 API Documentation

### Key Endpoints

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

#### Video Calls
```http
POST /api/v1/calls
Authorization: Bearer <token>

{
  "clientId": "client123",
  "staffId": "staff456"
}
```

#### Attendance
```http
# Import students
POST /api/attendance/import
Content-Type: multipart/form-data

# Get students
GET /api/attendance/students?sem=5&section=A

# Mark attendance  
POST /api/attendance/mark
Content-Type: application/json

{
  "studentId": "123",
  "status": "present",
  "date": "2025-11-13"
}
```

#### Health Check
```http
GET /healthz
```

## 🔧 Environment Variables

Create a `.env` file in the `deploy-clara` directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
SERVER_PORT=8080
ENABLE_UNIFIED_MODE=true

# Security
JWT_SECRET=your_secret_key_here

# Database
DATABASE_URL=postgres://user:password@localhost:5432/clara

# AI Integration  
GEMINI_API_KEY=your_gemini_api_key_here

# Client URLs
CLIENT_URL=http://localhost:5173
STAFF_URL=http://localhost:5174
```

See `env.example` for the complete list of configuration options.

## 📝 Attendance Module

### Excel Format Requirements

The attendance system expects Excel files with the following structure:

| Column | Field | Description |
|--------|-------|-------------|
| 0 | SL NO | Serial number |
| 1 | USN | University Seat Number / Student ID |
| 2 | NAME | Student full name |

### Features

- ✅ Import from Excel (.xlsx, .xls) or CSV files
- ✅ Direct import from Google Sheets
- ✅ Filter by semester (1-8) and section (A-D)
- ✅ Mark present/absent with intuitive radio buttons
- ✅ Bulk operations for entire sections
- ✅ Validation before submission
- ✅ Export attendance reports

### Usage

1. Navigate to the Attendance section in Staff Dashboard
2. Click "Import Students" and upload your Excel file
3. Select semester and section filters
4. Mark attendance using radio buttons
5. Submit with validation

## 🚢 Deployment

### Build for Production

```bash
# Build all applications
npm run build

# Start production server
npm start
```

### Docker Deployment (Coming Soon)

```bash
# Build Docker image
docker build -t clara-app .

# Run container
docker run -p 8080:8080 -p 5173:5173 -p 5174:5174 clara-app
```

### Environment Considerations

- Set `NODE_ENV=production`
- Configure proper PostgreSQL database
- Set up SSL certificates for HTTPS
- Configure CORS for production domains
- Set secure JWT secrets

## 🎯 Use Cases

### Educational Institutions
- Manage student attendance across multiple sections
- Schedule and track faculty meetings
- Enable parent-teacher video consultations
- Coordinate administrative tasks

### Corporate Offices
- Virtual reception for client meetings
- Staff task and project management
- Team collaboration and communication
- Meeting room scheduling

### Healthcare Facilities  
- Patient consultation scheduling
- Staff duty roster management
- Departmental coordination
- Emergency response tracking

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- Rate limiting on API endpoints
- SQL injection prevention

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

Built with ❤️ by the CLARA team for hackathon excellence.

## 📧 Contact

For questions, issues, or suggestions:
- Open an issue on GitHub
- Email: nagashreen@gmail.com

## 🙏 Acknowledgments

- Google Gemini AI for intelligent chat capabilities
- WebRTC community for video call technology
- React and Node.js communities
- All open-source contributors

---

<div align="center">

**[⭐ Star this repo](https://github.com/Aashuthosh10/CLARA_WOW)** if you find it helpful!

Made for [Mumbai Hacks 2025](https://mumbaihacks.devfolio.co/) 🚀

</div>
