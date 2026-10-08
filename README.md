# Telecalling Lead-Management CRM

Mobile-first telecalling lead-management CRM system.

## Project Structure

```
├── /server          # Express + TypeScript backend API
└── /mobile          # React Native + Expo mobile application
```

## Getting Started

### 1. Server Setup (`/server`)

#### Prerequisites
- Node.js (v20+)
- MongoDB (running locally or MongoDB Atlas connection string)

#### Installation
```bash
cd server
npm install
```

#### Environment Configuration
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/tele_app
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

#### Running the Server
- **Development mode**:
  ```bash
  npm run dev
  ```
- **Build**:
  ```bash
  npm run build
  ```
- **Production mode**:
  ```bash
  npm run start
  ```
- **Lint**:
  ```bash
  npm run lint
  ```

#### Health Check
Verify the server is running by opening:
```bash
curl http://localhost:5000/api/health
```
Response:
```json
{ "status": "ok" }
```

---

### 2. Mobile Setup (`/mobile`)

#### Prerequisites
- Node.js (v20+)
- Expo CLI
- Android Studio / Xcode (for development builds) or Expo Go compatible development client

#### Installation
```bash
cd mobile
npm install
```

#### Running the Mobile App
- **Start development server**:
  ```bash
  npx expo start
  ```
- **Run on Android**:
  ```bash
  npx expo run:android
  ```
- **Run on iOS**:
  ```bash
  npx expo run:ios
  ```
