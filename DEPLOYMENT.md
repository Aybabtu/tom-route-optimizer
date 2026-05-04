# Deploying to NixiHost

This guide covers deploying the Node.js API server to your NixiHost shared hosting account.

## Prerequisites

- SSH access to NixiHost (username: bidmyrou)
- Node.js support on NixiHost (check with their support)
- Your database credentials

## Step 1: Check Node.js Installation

SSH into your NixiHost account and check if Node.js is installed:

```bash
ssh bidmyrou@23.187.248.21
node --version
npm --version
```

If not installed, contact NixiHost support to enable Node.js.

## Step 2: Create Application Directory

Create a directory for your application:

```bash
mkdir -p ~/tom-route-optimizer
cd ~/tom-route-optimizer
```

## Step 3: Upload Server Files

Upload the `/server` directory to `~/tom-route-optimizer/server` on NixiHost. You can use:
- FTP/SFTP
- Git (if available)
- File manager in cPanel

Files needed:
```
server/
  ├── package.json
  ├── index.js
  └── .env (CREATE THIS - see Step 4)
```

## Step 4: Create .env File on NixiHost

SSH into NixiHost and create the `.env` file:

```bash
cat > ~/tom-route-optimizer/server/.env << 'EOF'
DB_HOST=localhost
DB_USER=bidmyrou_Claude_Code
DB_PASSWORD=pZ.5[8EUdNbQWIWh
DB_NAME=bidmyrou_Road_Data
DB_PORT=3306
PORT=3001
NODE_ENV=production
EOF
```

## Step 5: Install Dependencies

```bash
cd ~/tom-route-optimizer/server
npm install
```

## Step 6: Start the Server

### Option A: Run in Background

```bash
npm start &
```

### Option B: Use PM2 (Recommended for Stability)

```bash
npm install -g pm2
pm2 start index.js --name tom-api
pm2 startup
pm2 save
```

## Step 7: Verify It's Running

```bash
curl http://localhost:3001/api/health
```

You should see: `{"status":"ok","message":"Server is running"}`

## Step 8: Update Local Development

Update your frontend to point to the remote API. In your Mac development environment, create a `.env` file in the project root:

```
VITE_API_URL=http://bidmyroute.com:3001
```

Or if using IP:
```
VITE_API_URL=http://23.187.248.21:3001
```

Then update `src/utils/api.js`:

```javascript
const API_BASE = import.meta.env.VITE_API_URL || '/api'
```

## Step 9: Set Up a Proxy (Optional)

If you want the API on a subdomain like `api.bidmyroute.com`, configure it in cPanel:
- Create an Addon Domain
- Point it to the Node.js application
- Configure a proxy to port 3001

## Troubleshooting

**Port 3001 already in use:**
```bash
lsof -i :3001
kill -9 <PID>
```

**Permission denied errors:**
```bash
chmod +x ~/tom-route-optimizer/server/index.js
```

**Check logs:**
```bash
pm2 logs tom-api
```

## Important Security Notes

- Never commit `.env` to git
- Keep passwords secure
- Use HTTPS if possible (configure in cPanel/WHM)
- Consider firewall rules to limit API access

## Updating the API

To update the API on NixiHost:

1. Upload new files via FTP/SFTP or Git
2. Restart: `pm2 restart tom-api`
3. Check logs: `pm2 logs tom-api`
