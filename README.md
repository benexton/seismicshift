# Seismic Shift Website

Modern React website for Seismic Shift featuring 3D models, interactive animations, and video integration.

## Quick Start

### 1. Install Node.js (if you don't have it)
Download from: https://nodejs.org

### 2. Setup Project
```bash
# Install dependencies (30-60 seconds)
npm install

# Start development server
npm start
```

Website opens automatically at `http://localhost:5173`

I deleted node modules and git because thats apparently good practice but they should be easy downloads/you already have them.

## Recon pipeline and Supabase definitions

The Learning from Earthquakes (LFE) recon data pipeline (the scraper,
triage, report generation, and export scripts under scripts/lfe/), its
GitHub Actions workflows, and the Supabase project definitions (schema,
migrations, and edge functions) now live in a separate, private repository.
This public repo only holds what the site build needs. The public LFE
viewer at /erp/public/ reads its data from Supabase Storage at runtime, not
from anything in this repo.