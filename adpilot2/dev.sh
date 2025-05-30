#!/bin/bash

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required tools
if ! command_exists docker; then
  echo "Error: Docker is not installed"
  exit 1
fi

if ! command_exists docker-compose; then
  echo "Error: Docker Compose is not installed"
  exit 1
fi

# Function to start services
start_services() {
  echo "Starting services..."
  docker-compose up -d mongo redis
  echo "Waiting for databases to be ready..."
  sleep 5
  docker-compose up -d orchestrator test-engine frontend
}

# Function to stop services
stop_services() {
  echo "Stopping services..."
  docker-compose down
}

# Function to show logs
show_logs() {
  docker-compose logs -f "$1"
}

# Function to rebuild services
rebuild_services() {
  echo "Rebuilding services..."
  docker-compose build "$1"
  docker-compose up -d "$1"
}

# Main script logic
case "$1" in
  "start")
    start_services
    ;;
  "stop")
    stop_services
    ;;
  "logs")
    show_logs "$2"
    ;;
  "rebuild")
    rebuild_services "$2"
    ;;
  *)
    echo "Usage: $0 {start|stop|logs|rebuild}"
    echo "  start           - Start all services"
    echo "  stop            - Stop all services"
    echo "  logs [service]  - Show logs for a specific service"
    echo "  rebuild [service] - Rebuild and restart a specific service"
    exit 1
    ;;
esac 