# Frontend Vercel Deployment Setup Guide

## ⚠️ Important: Environment Variables Must Be Set in Vercel Dashboard

The environment variables **CANNOT** be set in `vercel.json` for Vite projects. They must be set in the Vercel dashboard.

---

## Step-by-Step Setup

### 1. Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Select your frontend project: **vet-hub-enterprise** (or your project name)
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar

---

### 2. Add Environment Variables

Add the following environment variables:

#### Required Variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `VITE_API_URL` | `https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1` | Production, Preview, Development |
| `VITE_GEMINI_API_KEY` | `AIzaSyCp0l871c0QDaHngU2m-9wYC_mmqQHbGJo` | Production, Preview, Development |

#### How to Add:

1. Click **Add New** button
2. Enter **Variable Name**: `VITE_API_URL`
3. Enter **Value**: `https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1`
4. Select environments: ✅ Production, ✅ Preview, ✅ Development
5. Click **Save**

6. Repeat for `VITE_GEMINI_API_KEY`

---

### 3. Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **⋯** (three dots menu)
4. Click **Redeploy**
5. Make sure **Use existing Build Cache** is **UNCHECKED**
6. Click **Redeploy**

**Important:** You must redeploy for the environment variables to take effect!

---

## Verification

### Check Build Logs

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click on **Building** to see build logs
4. Look for: `VITE_API_URL` in the logs (it should show the production URL)

### Test in Browser

1. Open your deployed site: https://vet-hub-enterprise.vercel.app
2. Open browser console (F12)
3. Run this command:

```javascript
// Check API URL
console.log('API URL:', import.meta.env.VITE_API_URL);
```

**Expected Output:**
```
API URL: https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1
```

If it shows `http://localhost:5001/api/v1`, the environment variables are not set correctly.

### Test API Connection

In browser console:

```javascript
fetch('https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1/health')
  .then(r => r.json())
  .then(console.log);
```

**Expected Output:**
```json
{
  "success": true,
  "message": "VetHub Enterprise API is running",
  "timestamp": "2026-01-13T..."
}
```

---

## Troubleshooting

### Issue: Still using localhost URL

**Cause:** Environment variables not set or deployment not rebuilt

**Solution:**
1. Verify environment variables are set in Vercel dashboard
2. Redeploy with **Use existing Build Cache** UNCHECKED
3. Wait for deployment to complete
4. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: CORS errors

**Cause:** Backend not allowing frontend URL

**Solution:**
1. Check backend `ALLOWED_ORIGINS` includes `https://vet-hub-enterprise.vercel.app`
2. Redeploy backend if needed

### Issue: Environment variable not showing in build logs

**Cause:** Variable not set for correct environment

**Solution:**
1. Go to Settings → Environment Variables
2. Make sure variable is checked for **Production** environment
3. Redeploy

---

## Environment Variable Reference

### Development (Local)

File: `.env`
```bash
VITE_API_URL=http://localhost:5001/api/v1
VITE_GEMINI_API_KEY=AIzaSyCp0l871c0QDaHngU2m-9wYC_mmqQHbGJo
```

### Production (Vercel)

Set in Vercel Dashboard:
```bash
VITE_API_URL=https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1
VITE_GEMINI_API_KEY=AIzaSyCp0l871c0QDaHngU2m-9wYC_mmqQHbGJo
```

---

## Why Not Use vercel.json?

The `env` field in `vercel.json` is for **runtime** environment variables (server-side).

Vite requires **build-time** environment variables (they are embedded in the built JavaScript).

Therefore, you **must** set `VITE_*` variables in the Vercel dashboard, not in `vercel.json`.

---

## Quick Checklist

- [ ] Environment variables added in Vercel dashboard
  - [ ] `VITE_API_URL` set to production backend URL
  - [ ] `VITE_GEMINI_API_KEY` set
  - [ ] Variables enabled for Production, Preview, Development
- [ ] Redeployed without build cache
- [ ] Verified in browser console
- [ ] Tested API connection
- [ ] No CORS errors

---

## Production URLs

| Service | URL |
|---------|-----|
| Frontend | https://vet-hub-enterprise.vercel.app |
| Backend | https://vet-hub-enterprise-backend-aog7.vercel.app |
| API Base | https://vet-hub-enterprise-backend-aog7.vercel.app/api/v1 |

---

## Next Steps

1. ✅ Set environment variables in Vercel dashboard
2. ✅ Redeploy frontend
3. ✅ Verify API URL in browser console
4. ✅ Test login/signup functionality
5. ✅ Verify no CORS errors

🎉 **Your frontend will now use the production backend URL!**

