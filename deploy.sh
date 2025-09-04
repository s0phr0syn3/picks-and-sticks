#!/bin/bash

# Deployment script for Picks and Sticks
# Run this on your Hetzner server to deploy the latest changes

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/picks-and-sticks"
PM2_APP_NAME="picks-and-sticks"
REPO_URL="https://github.com/your-username/picks-and-sticks.git"  # Update this with your actual repo URL

echo -e "${BLUE}📂 Navigating to application directory...${NC}"
cd $APP_DIR

echo -e "${BLUE}📡 Pulling latest changes from GitHub...${NC}"
git pull origin main

echo -e "${BLUE}📦 Installing/updating dependencies...${NC}"
npm install

echo -e "${BLUE}🏗️  Building application...${NC}"
npm run build

echo -e "${BLUE}🔄 Restarting PM2 service...${NC}"
pm2 restart $PM2_APP_NAME

echo -e "${BLUE}📊 Checking PM2 status...${NC}"
pm2 status $PM2_APP_NAME

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your app should be available at: https://carsoncrew.io${NC}"

echo ""
echo -e "${BLUE}📝 Recent commits:${NC}"
git log --oneline -5

echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo -e "  View logs: ${YELLOW}pm2 logs $PM2_APP_NAME${NC}"
echo -e "  Monitor:   ${YELLOW}pm2 monit${NC}"
echo -e "  Restart:   ${YELLOW}pm2 restart $PM2_APP_NAME${NC}"