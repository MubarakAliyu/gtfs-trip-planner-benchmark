$ErrorActionPreference = 'Stop'

Write-Host "Starting MongoDB and Redis..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
npm install

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

Write-Host "Checking GTFS files..." -ForegroundColor Cyan
npm run check

Write-Host "Ingesting GTFS into MongoDB and Redis..." -ForegroundColor Cyan
npm run ingest

Write-Host "Starting application at http://localhost:5050" -ForegroundColor Green
npm start
