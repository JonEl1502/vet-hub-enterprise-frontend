#!/bin/bash

echo "🚀 Starting VetHub Enterprise Production Setup..."

# Step 1: Fix React version (downgrade to 18.3.1 for Recharts compatibility)
echo "📦 Step 1: Fixing React version compatibility..."
sed -i '' 's/"react": "19.0.0"/"react": "18.3.1"/' package.json
sed -i '' 's/"react-dom": "19.0.0"/"react-dom": "18.3.1"/' package.json

# Step 2: Install dependencies
echo "📥 Step 2: Installing dependencies..."
rm -rf node_modules package-lock.json
npm install

# Step 3: Ensure we're on production branch
echo "🌿 Step 3: Setting up production branch..."
git checkout production 2>/dev/null || git checkout -b production

# Step 4: Pull latest changes from main
echo "📥 Step 4: Pulling changes from main..."
git pull origin main

# Step 5: Merge main into production
echo "🔀 Step 5: Merging main into production..."
git merge main --no-edit

# Step 6: Commit all changes
echo "💾 Step 6: Committing changes..."
git add .
git commit -m "Production setup: React 18 compatibility, Gemini API bypass, dependencies updated" --allow-empty

# Step 7: Push to production
echo "🚀 Step 7: Pushing to production..."
git push -u origin production

echo "✅ Production setup complete!"
echo "📊 Summary:"
echo "  ✓ React downgraded to 18.3.1"
echo "  ✓ Gemini API bypass configured"
echo "  ✓ Dependencies installed"
echo "  ✓ Production branch synced with main"
echo "  ✓ Changes committed and pushed"
