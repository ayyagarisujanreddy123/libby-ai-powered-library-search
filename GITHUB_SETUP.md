# Steps to Push Code to GitHub

## Step 1: Initialize Git Repository (if not already done)

Open your terminal in the project directory and run:

```bash
cd /Users/sujanreddyayyagari/Desktop/libby-—-ai-powered-library-search
git init
```

## Step 2: Add All Files to Git

```bash
git add .
```

This will add all files except those in `.gitignore` (like `.env`, `node_modules`, etc.)

## Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: Libby AI-powered library search chatbot"
```

## Step 4: Create a New Repository on GitHub

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `libby-ai-powered-library-search` (or your preferred name)
   - **Description**: "AI-powered library search chatbot using OpenAI and Pinecone"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## Step 5: Connect Local Repository to GitHub

After creating the repo, GitHub will show you commands. Use these:

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/libby-ai-powered-library-search.git

# Or if you prefer SSH (if you have SSH keys set up):
# git remote add origin git@github.com:YOUR_USERNAME/libby-ai-powered-library-search.git
```

## Step 6: Push Your Code

```bash
# Push to the main branch
git branch -M main
git push -u origin main
```

If prompted, enter your GitHub username and password (or use a Personal Access Token if 2FA is enabled).

## Step 7: Verify

Go to your GitHub repository page and verify all files are uploaded.

---

## Important Notes:

✅ **Your `.env` file is already in `.gitignore`** - it won't be pushed (this is good for security!)

✅ **Make sure to update `env.example`** with placeholder values so others know what environment variables are needed

✅ **If you get authentication errors**, you may need to:
   - Use a Personal Access Token instead of password
   - Or set up SSH keys for GitHub

---

## Quick Command Summary:

```bash
# Navigate to project
cd /Users/sujanreddyayyagari/Desktop/libby-—-ai-powered-library-search

# Initialize git (if needed)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Libby AI-powered library search chatbot"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/libby-ai-powered-library-search.git

# Push
git branch -M main
git push -u origin main
```

---

## Troubleshooting:

**If you get "remote origin already exists":**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/libby-ai-powered-library-search.git
```

**If you need to update the remote URL:**
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/libby-ai-powered-library-search.git
```

**If authentication fails:**
- Create a Personal Access Token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Use the token as your password when pushing
