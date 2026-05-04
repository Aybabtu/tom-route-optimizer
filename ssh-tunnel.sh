#!/bin/bash

# SSH Tunnel script for NixiHost MySQL access
# This creates a secure tunnel from your Mac to the remote MySQL server

SSH_USER="bidmyrou"
SSH_HOST="bidmyroute.com"
SSH_PORT="22"
SSH_KEY="/Users/michaelpelletier/.ssh/nixihost_id_rsa"
LOCAL_PORT="3306"
REMOTE_HOST="localhost"
REMOTE_PORT="3306"

echo "Starting SSH tunnel to NixiHost..."
echo "Local: localhost:$LOCAL_PORT -> Remote: $REMOTE_HOST:$REMOTE_PORT"

# Kill any existing tunnel on this port
lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true

# Create the SSH tunnel
# The tunnel forwards local port 3306 to the remote MySQL server through SSH
ssh -i "$SSH_KEY" \
    -L $LOCAL_PORT:$REMOTE_HOST:$REMOTE_PORT \
    $SSH_USER@$SSH_HOST \
    -N

echo "SSH tunnel closed"
