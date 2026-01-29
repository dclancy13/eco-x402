#!/bin/bash

# @eco/x402 Demo Runner
# This script starts all demo components

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  @eco/x402 Demo Runner                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the eco-x402 directory${NC}"
    echo "  cd eco-x402 && ./demo/run-demo.sh"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check if built
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building project...${NC}"
    npm run build
fi

echo ""
echo -e "${GREEN}Starting demo components...${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $FACILITATOR_PID 2>/dev/null
    kill $SERVER_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start mock facilitator in background
echo "1. Starting mock facilitator on port 4020..."
npx ts-node demo/mock-facilitator.ts &
FACILITATOR_PID=$!
sleep 2

# Start demo server in background
echo "2. Starting demo server on port 3000..."
npx ts-node demo/demo-server.ts &
SERVER_PID=$!
sleep 2

echo ""
echo -e "${GREEN}✅ Demo is running!${NC}"
echo ""
echo "Try these commands in a new terminal:"
echo ""
echo "  # Free endpoint"
echo "  curl http://localhost:3000/api/public"
echo ""
echo "  # Paid endpoint (returns 402)"
echo "  curl -i http://localhost:3000/api/premium/joke"
echo ""
echo "  # Run the test client"
echo "  npx ts-node demo/test-client.ts"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the demo${NC}"
echo ""

# Wait for processes
wait
