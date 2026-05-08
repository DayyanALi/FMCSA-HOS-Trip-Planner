# FMCSA HOS Trip Planner

Full-stack Django + React assessment project for planning an interstate truck trip and generating FMCSA-style ELD daily logs.

## Features

- Django API computes a property-carrying HOS plan using:
  - 70 hour / 8 day cycle
  - 11 hour driving limit
  - 14 hour driving window
  - 30 minute break after 8 driving hours
  - 10 consecutive off-duty hours between duty periods
  - 34 hour restart when cycle hours are exhausted
  - 1 hour each for pickup and drop-off
  - fuel stop at least every 1,000 miles
- React frontend for trip inputs, route summary, stop list, and generated daily log sheets.
- Free map stack: OpenStreetMap tiles, Nominatim geocoding, and OSRM routing.
- Graceful fallback distance estimate if the public route API is unavailable.

## Run Locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

Open `http://127.0.0.1:8000`.

## Deploy Notes

The app is structured so Django serves the React UI from `static/`. For Vercel, connect the GitHub repository and deploy with the included `vercel.json`.

