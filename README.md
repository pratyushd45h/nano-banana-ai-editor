# 🍌 Nano-Banana AI Image Editor

An advanced AI-powered image editing application built with React and Flask, powered by Google's Gemini 2.5 Flash model.

## ✨ Features

- **🎨 Smart Mask Editing**: Paint yellow masks to edit specific image regions
- **🖼️ Whole Image Editing**: Apply AI transformations to entire images  
- **🌟 Image Blending**: Seamlessly blend two images with AI guidance
- **⚡ Real-time Canvas**: Interactive drawing with zoom/pan capabilities
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🌓 Dark/Light Themes**: Toggle between UI themes
- **📚 Edit History**: Track and review all your edits

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Nano-banana
   ```

2. **Setup Backend**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   cp .env.example .env
   # Add your Google API key to .env
   python app.py
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Get Google API Key**
   - Visit: https://aistudio.google.com/app/apikey
   - Create new API key
   - Add to `backend/.env` file

### 🌐 Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Render.com deployment instructions.

## 🛠️ Tech Stack

**Frontend:**
- React 19.1.1
- React Konva (Canvas editing)
- React Dropzone (File uploads)
- Modern CSS with glassmorphism effects

**Backend:**
- Flask (Python web framework)
- Google Generative AI (Gemini 2.5 Flash)
- Pillow (Image processing)
- Flask-CORS (Cross-origin requests)

## 📱 How to Use

1. **Upload Image**: Drag & drop or click to select an image
2. **Choose Mode**: 
   - Mask Mode: Paint areas to edit selectively
   - Prompt Mode: Edit the whole image
   - Blend Mode: Add a second image to blend
3. **Describe Changes**: Enter what you want to change/add
4. **Generate**: Let AI work its magic!
5. **Review History**: See all your edits in the timeline

## 🎯 Perfect for Hackathons

- **Free Deployment**: Runs on Render.com free tier
- **Quick Setup**: Deploy in under 30 minutes
- **Demo Ready**: Professional UI perfect for presentations
- **Scalable**: Easy to add new AI features

## 📄 License

MIT License - feel free to use in your hackathon projects!

## 🤝 Contributing

Built for hackathons - fork, modify, and make it your own!

---

**Happy Hacking! 🚀**
