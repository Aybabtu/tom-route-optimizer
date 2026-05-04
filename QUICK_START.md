# Quick Start Guide

## For Local Development (Before Deploying)

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install server dependencies
npm run server:install
```

### 2. Create Environment File

```bash
cp .env.example .env
# Leave it as is for local development
```

### 3. Start Everything

In one terminal, start the server:
```bash
npm run dev:server
```

In another terminal, start the frontend:
```bash
npm run dev
```

Visit: `http://localhost:5173`

---

## For Remote Deployment (On NixiHost)

### 1. Deploy Server to NixiHost

Follow the steps in `DEPLOYMENT.md` to:
- Upload server files to NixiHost
- Install dependencies
- Start the API server

### 2. Update Frontend Configuration

Create `.env` in project root:

```bash
# For NixiHost domain:
VITE_API_URL=http://bidmyroute.com:3001

# OR for IP address:
VITE_API_URL=http://23.187.248.21:3001
```

### 3. Run Frontend

```bash
npm run dev
```

The app will now connect to your remote API on NixiHost!

---

## Workflow

**Local Development:**
1. Update code
2. `npm run dev:all` (runs both server and frontend)
3. Test locally

**Deploy to NixiHost:**
1. Push to git: `git push`
2. On NixiHost, pull changes: `git pull`
3. Restart API: `pm2 restart tom-api`
4. Update your local `.env` with NixiHost URL
5. Frontend automatically connects to remote API

---

## Switching Between Local and Remote

**Use local API:**
- Remove or comment out `VITE_API_URL` in `.env`

**Use remote API:**
- Set `VITE_API_URL=http://bidmyroute.com:3001` in `.env`
- Restart frontend: `npm run dev`
