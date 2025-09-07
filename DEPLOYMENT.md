# Nano-Banana Deployment Guide for Render.com

## 🚀 Quick Deployment Steps

### Backend Deployment (Python Flask)

1. **Create New Web Service on Render:**
   - Go to [render.com](https://render.com) and sign up/login
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

2. **Configure Backend Service:**
   ```
   Name: nano-banana-backend
   Region: Oregon (US West)
   Branch: main
   Root Directory: backend
   Runtime: Python 3 (auto-detected)
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn app:app --bind 0.0.0.0:$PORT
   ```

3. **Set Environment Variables:**
   - Go to Environment tab in your service
   - Add these variables:
     ```
     ENVIRONMENT=production
     GOOGLE_API_KEY=your_actual_google_api_key_here
     ```
   - Get your Google API key from: https://aistudio.google.com/app/apikey

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Copy your backend URL (e.g., `https://nano-banana-backend.onrender.com`)

### Frontend Deployment (React)

1. **Create New Static Site on Render:**
   - Click "New +" → "Static Site"
   - Connect same GitHub repository
   - Select this repository

2. **Configure Frontend Service:**
   ```
   Name: nano-banana-frontend
   Branch: main
   Root Directory: frontend
   Build Command: npm install && npm run build
   Publish Directory: build
   ```

3. **Set Environment Variables:**
   - Go to Environment tab
   - Add:
     ```
     REACT_APP_API_URL=https://your-backend-url.onrender.com
     ```
   - Replace with your actual backend URL from step 1

4. **Deploy:**
   - Click "Create Static Site"
   - Wait for deployment (3-5 minutes)

### ⚠️ Important Notes:

1. **Free Tier Limitations:**
   - Backend services sleep after 15 minutes of inactivity
   - First request after sleep takes 30-60 seconds to wake up
   - 750 hours/month free (enough for hackathons)

2. **CORS Configuration:**
   - Update backend `app.py` line 18 with your frontend URL:
     ```python
     CORS(app, origins=["https://your-frontend-url.onrender.com"])
     ```

3. **API Key Security:**
   - Never commit your Google API key to git
   - Always use environment variables in production
   - Monitor your API usage in Google Cloud Console

## 🔧 Local Development

### Backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python app.py
```

### Frontend:
```bash
cd frontend
npm install
npm start
```

## 🧪 Testing Deployment

1. **Backend Health Check:**
   - Visit: `https://your-backend.onrender.com/health`
   - Should return: `{"status": "healthy", "message": "Nano-Banana API is running"}`

2. **Frontend Access:**
   - Visit: `https://your-frontend.onrender.com`
   - Should load the Nano-Banana interface

3. **Full Integration Test:**
   - Upload an image
   - Try generating/editing
   - Check browser console for API errors

## 🎯 Hackathon Tips

1. **Deploy Early:** Set up deployment infrastructure first day
2. **Monitor Logs:** Use Render dashboard to check logs for errors
3. **Keep URLs Handy:** Save both frontend and backend URLs
4. **Test on Mobile:** Ensure responsive design works on phones
5. **Demo Preparation:** Have backup images ready for demo

## 🔍 Troubleshooting

**Backend Issues:**
- Check environment variables are set correctly
- Verify Google API key is valid and has credits
- Monitor logs in Render dashboard
- If deployment fails with package issues, the requirements.txt contains exact working versions
- For package conflicts, try clearing Render cache in dashboard settings

**Frontend Issues:**
- Ensure REACT_APP_API_URL points to correct backend
- Check CORS errors in browser console
- Verify build process completed successfully

**API Issues:**
- Test endpoints individually using curl/Postman
- Check Google API quotas and billing
- Verify image encoding/decoding pipeline

## 📝 Final Checklist

- [ ] Backend deployed and responding to `/health`
- [ ] Frontend deployed and loading correctly
- [ ] Environment variables configured
- [ ] CORS properly set up
- [ ] Google API key working
- [ ] Image upload/editing flow tested
- [ ] Demo images prepared
- [ ] URLs documented for judging

Good luck with your hackathon! 🏆
