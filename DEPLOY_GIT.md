# Deploy via Git to NixiHost

This is the easiest deployment method for shared hosting - just push to git and pull on the server!

## Step 1: Prepare Local Code

Make sure you've installed server dependencies locally:

```bash
cd /Users/michaelpelletier/tom-route-optimizer/server
npm install
```

This creates the `node_modules` folder which will be committed to git.

## Step 2: Commit and Push to GitHub

```bash
cd /Users/michaelpelletier/tom-route-optimizer

# Add all changes
git add -A

# Commit with a message
git commit -m "Add Node.js server and dependencies for deployment"

# Push to GitHub
git push origin main
```

## Step 3: Clone on NixiHost

Use cPanel's Git interface or Terminal (if available) to clone:

```bash
# In your home directory
git clone https://github.com/YOUR-USERNAME/tom-route-optimizer.git
cd tom-route-optimizer/server
```

Or if git clone fails, use the File Manager to download and extract the zip file from GitHub.

## Step 4: Create .env File on NixiHost

Using cPanel File Manager or SSH:

```bash
# Create .env in the server directory
cat > .env << 'EOF'
DB_HOST=localhost
DB_USER=bidmyrou_Claude_Code
DB_PASSWORD=pZ.5[8EUdNbQWIWh
DB_NAME=bidmyrou_Road_Data
DB_PORT=3306
PORT=3001
NODE_ENV=production
EOF
```

Or manually create the file through cPanel File Manager:
1. Navigate to `public_html/tom-route-optimizer/server/`
2. Create new file: `.env`
3. Add the content above

## Step 5: Start the Server

You have a few options depending on what NixiHost provides:

### Option A: Using cPanel Terminal
```bash
cd ~/tom-route-optimizer/server
node index.js
```

### Option B: Using PM2 (if Node.js support includes PM2)
```bash
cd ~/tom-route-optimizer/server
pm2 start index.js --name tom-api
pm2 startup
pm2 save
```

### Option C: Background Process
```bash
cd ~/tom-route-optimizer/server
nohup node index.js > app.log 2>&1 &
```

### Option D: Setup as cPanel Application (if available)
Contact NixiHost support to set up Node.js as a managed application.

## Step 6: Test the API

```bash
curl http://localhost:3001/api/health
```

Should return: `{"status":"ok","message":"Server is running"}`

## Step 7: Update Frontend Configuration

On your Mac, create `.env`:

```bash
cat > .env << 'EOF'
VITE_API_URL=http://bidmyroute.com:3001
EOF
```

Then start the frontend:
```bash
npm run dev
```

## Updating After Changes

To push updates to NixiHost:

```bash
# On your Mac
git add -A
git commit -m "Your changes"
git push origin main

# On NixiHost (via cPanel Terminal or SSH)
cd ~/tom-route-optimizer
git pull origin main

# Restart the server
pm2 restart tom-api
# OR manually restart if using other method
```

## Troubleshooting

**"git: command not found"**
- Use the cPanel File Manager to download/upload files instead
- Or contact NixiHost support to enable git

**Port 3001 already in use**
```bash
# Change PORT in .env to 3002 or another available port
```

**Permission denied on node_modules**
```bash
chmod -R 755 node_modules
```

**Check if server is running**
```bash
curl http://localhost:3001/api/health
curl http://23.187.248.21:3001/api/health
curl http://bidmyroute.com:3001/api/health
```

## Important Notes

- Never push `.env` to git (it's in .gitignore)
- `node_modules` is included in git for shared hosting compatibility
- Keep your database credentials secure in `.env`
- Contact NixiHost if you need help enabling git or Node.js support
