# Deploying to Render

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repo
3. **MongoDB**: Render doesn't offer MongoDB. You'll need:
   - MongoDB Atlas (free tier available) - Recommended
   - Or another MongoDB hosting service

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Connect your GitHub repo** to Render
2. **Create a new Blueprint** from your repository
3. Render will automatically detect `render.yaml` and create:
   - Web service (your Node.js server)
   - PostgreSQL database

### Option 2: Manual Setup

1. **Create PostgreSQL Database**:
   - Go to Render Dashboard → New → PostgreSQL
   - Name: `clara-postgres`
   - Plan: Free
   - Copy the **Internal Database URL**

2. **Set up MongoDB** (MongoDB Atlas):
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free cluster
   - Get your connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/clara_db`

3. **Create Web Service**:
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Settings:
     - **Name**: `clara-server`
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free

4. **Environment Variables** (in Render dashboard):
   ```
   NODE_ENV=production
   PORT=8080
   ENABLE_UNIFIED_MODE=true
   JWT_SECRET=<generate a secure random string>
   DATABASE_URL=<from PostgreSQL service - Internal Database URL>
   MONGODB_URI=<from MongoDB Atlas>
   MONGODB_DB_NAME=clara_db
   CORS_ORIGINS=https://your-app-name.onrender.com
   CLIENT_PUBLIC_PATH=/
   STAFF_PUBLIC_PATH=/staff
   SOCKET_PATH=/socket
   RING_TIMEOUT_MS=45000
   GEMINI_API_KEY=<optional, if using Gemini features>
   ```

## Important Notes

- **MongoDB**: Render doesn't provide MongoDB. Use MongoDB Atlas (free tier available)
- **Build Time**: First build may take 5-10 minutes
- **Free Tier Limits**: 
  - Services spin down after 15 minutes of inactivity
  - First request after spin-down takes ~30 seconds
- **CORS**: Update `CORS_ORIGINS` with your actual Render URL after deployment

## After Deployment

1. Your app will be available at: `https://your-app-name.onrender.com`
2. Client interface: `https://your-app-name.onrender.com/`
3. Staff interface: `https://your-app-name.onrender.com/staff`
4. API: `https://your-app-name.onrender.com/api/*`
5. Health check: `https://your-app-name.onrender.com/healthz`

## Troubleshooting

- **Build fails**: Check build logs in Render dashboard
- **Database connection issues**: Verify DATABASE_URL is using Internal Database URL
- **MongoDB connection**: Ensure MongoDB Atlas IP whitelist includes Render IPs (0.0.0.0/0 for testing)
- **Static files not loading**: Ensure build completed successfully (check dist folders exist)

