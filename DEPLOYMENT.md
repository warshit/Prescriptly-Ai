# Vercel Deployment Guide

## Prerequisites
1. Install Vercel CLI: `npm i -g vercel`
2. Create a Vercel account at https://vercel.com

## Environment Variables Setup

### 1. Local Development
Copy `.env.example` to `.env.local` and fill in your actual API keys:
```bash
cp .env.example .env.local
```

### 2. Vercel Environment Variables
Add these environment variables in your Vercel dashboard or via CLI:

**Required Variables:**
- `VITE_GEMINI_API_KEY` - Your Google Gemini API key
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_DATABASE_URL` - Firebase database URL
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID

## Deployment Steps

### Option 1: Vercel CLI
```bash
# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

### Option 2: GitHub Integration
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

## Adding Environment Variables via CLI
```bash
vercel env add VITE_GEMINI_API_KEY
vercel env add VITE_FIREBASE_API_KEY
# ... add all other variables
```

## Security Notes
- Never commit `.env.local` or any file containing actual API keys
- All environment variables are prefixed with `VITE_` for Vite compatibility
- Firebase config is safe to expose on client-side (it's designed for it)
- Keep your Gemini API key secure and monitor usage

## Build Configuration
The project uses:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite
- Node.js version: 18.x (recommended)