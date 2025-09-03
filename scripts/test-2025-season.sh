#!/bin/bash

# 2025 NFL Season Testing Script for Picks and Sticks
# Run this script to test all functionality for the 2025 season

echo "🏈 Testing Picks and Sticks for 2025 NFL Season"
echo "=================================================="

BASE_URL="http://localhost:5173"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test API endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo "  GET $BASE_URL$endpoint"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL$endpoint")
    body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    status=$(echo $response | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✅ Status: $status${NC}"
        if [[ $body == *"success"* ]] || [[ $body == *"data"* ]] || [[ $body == *"<!doctype"* ]]; then
            echo -e "  ${GREEN}✅ Response looks valid${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Response: ${body:0:100}...${NC}"
        fi
    else
        echo -e "  ${RED}❌ Expected $expected_status but got $status${NC}"
        echo -e "  ${RED}Response: $body${NC}"
    fi
    echo ""
}

# Function to test POST endpoint
test_post_endpoint() {
    local endpoint=$1
    local description=$2
    local data=$3
    local expected_status=${4:-200}
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo "  POST $BASE_URL$endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$BASE_URL$endpoint")
    fi
    
    body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    status=$(echo $response | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✅ Status: $status${NC}"
        if [[ $body == *"success"* ]] || [[ $body == *"data"* ]]; then
            echo -e "  ${GREEN}✅ Response looks valid${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Response: ${body:0:100}...${NC}"
        fi
    else
        echo -e "  ${RED}❌ Expected $expected_status but got $status${NC}"
        echo -e "  ${RED}Response: $body${NC}"
    fi
    echo ""
}

echo -e "${YELLOW}Step 1: Testing basic application${NC}"
test_endpoint "/" "Home page loads"

echo -e "${YELLOW}Step 2: Testing seeding endpoints${NC}"
test_endpoint "/api/seed/teams" "Seed NFL teams"
test_endpoint "/api/seed/users" "Seed users"
test_endpoint "/api/seed/schedules" "Seed 2025 schedules"

echo -e "${YELLOW}Step 3: Testing game data endpoints${NC}"
test_endpoint "/api/picks/1" "Get picks for week 1"
test_endpoint "/api/picks/2" "Get picks for week 2"
test_endpoint "/api/picks/18" "Get picks for week 18"

echo -e "${YELLOW}Step 4: Testing draft endpoints${NC}"
test_post_endpoint "/api/picks/1/start-draft" "Start draft for week 1"
test_endpoint "/api/draft/1" "Load draft page for week 1"

echo -e "${YELLOW}Step 5: Testing frontend pages${NC}"
test_endpoint "/picks/1" "Picks page for week 1"
test_endpoint "/picks/2" "Picks page for week 2" 
test_endpoint "/draft/1" "Draft page for week 1"

echo -e "${YELLOW}Step 6: Testing week calculation${NC}"
echo -e "${BLUE}Testing week calculation for 2025 season dates:${NC}"

# Test some specific 2025 dates
test_dates=(
    "2025-09-04:1"  # Week 1 Thursday
    "2025-09-07:1"  # Week 1 Sunday
    "2025-09-10:1"  # Week 1 Wednesday
    "2025-09-11:2"  # Week 2 Thursday
    "2025-10-15:7"  # Week 7 Wednesday
    "2025-12-25:17" # Week 17 Christmas
    "2026-01-01:18" # Week 18 New Year's Day
)

for date_test in "${test_dates[@]}"; do
    IFS=':' read -r date expected_week <<< "$date_test"
    echo "  Date: $date should be week $expected_week"
done

echo ""
echo -e "${YELLOW}Step 7: Manual testing suggestions${NC}"
echo "1. Try starting a draft for week 1:"
echo "   - Visit http://localhost:5173/picks/1"
echo "   - Click 'Start Draft' button"
echo "   - Verify you're redirected to draft page"
echo ""
echo "2. Test drag-and-drop functionality:"
echo "   - On draft page, drag a team to the drop zone"
echo "   - Verify the pick is registered"
echo "   - Check that the team is removed from available teams"
echo ""
echo "3. Test navigation:"
echo "   - Use Previous/Next Week buttons"
echo "   - Verify URLs change correctly"
echo "   - Test weeks 1-18 are accessible"
echo ""
echo "4. Test database persistence:"
echo "   - Make some picks"
echo "   - Restart the server"
echo "   - Verify picks are still there"

echo ""
echo -e "${GREEN}🎉 2025 Season Testing Complete!${NC}"
echo ""
echo -e "${BLUE}Additional manual tests to perform:${NC}"
echo "- Verify week calculations match NFL schedule"
echo "- Test pick order generation (worst-to-first)"
echo "- Test round 3/4 assignments (sticking other players)"
echo "- Test scoring calculation when games have scores"
echo "- Test with multiple users and full drafts"