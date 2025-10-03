#!/bin/bash

# VistaSign Stop Script
# This script stops the VistaSign development environment

echo "🛑 Stopping VistaSign Development Environment..."

# Stop services
docker-compose down

echo "✅ VistaSign development environment stopped!"
