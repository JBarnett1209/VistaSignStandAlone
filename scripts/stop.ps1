# VistaSign Stop Script for Windows
# This script stops the VistaSign development environment

Write-Host "🛑 Stopping VistaSign Development Environment..." -ForegroundColor Yellow

# Stop services
docker-compose down

Write-Host "✅ VistaSign development environment stopped!" -ForegroundColor Green
