from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


AVG_SPEED_MPH = 50.0
MAX_DRIVE_DAY = 11.0
MAX_DUTY_WINDOW = 14.0
MAX_CYCLE = 70.0
BREAK_TRIGGER = 8.0
PICKUP_HOURS = 1.0
DROPOFF_HOURS = 1.0
FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_HOURS = 0.5
REST_HOURS = 10.0
RESTART_HOURS = 34.0

KNOWN_PLACES = {
    "new york": (40.7128, -74.0060),
    "los angeles": (34.0522, -118.2437),
    "chicago": (41.8781, -87.6298),
    "houston": (29.7604, -95.3698),
    "phoenix": (33.4484, -112.0740),
    "philadelphia": (39.9526, -75.1652),
    "san antonio": (29.4241, -98.4936),
    "san diego": (32.7157, -117.1611),
    "dallas": (32.7767, -96.7970),
    "austin": (30.2672, -97.7431),
    "jacksonville": (30.3322, -81.6557),
    "fort worth": (32.7555, -97.3308),
    "columbus": (39.9612, -82.9988),
    "charlotte": (35.2271, -80.8431),
    "san francisco": (37.7749, -122.4194),
    "indianapolis": (39.7684, -86.1581),
    "seattle": (47.6062, -122.3321),
    "denver": (39.7392, -104.9903),
    "miami": (25.7617, -80.1918),
    "atlanta": (33.7490, -84.3880),
    "boston": (42.3601, -71.0589),
    "detroit": (42.3314, -83.0458),
    "nashville": (36.1627, -86.7816),
    "memphis": (35.1495, -90.0490),
    "louisville": (38.2527, -85.7585),
    "st. louis": (38.6270, -90.1994),
    "kansas city": (39.0997, -94.5786),
    "minneapolis": (44.9778, -93.2650),
    "las vegas": (36.1716, -115.1391),
    "portland": (45.5152, -122.6784),
    "orlando": (28.5383, -81.3792),
    "tampa": (27.9506, -82.4572),
    "cleveland": (41.4993, -81.6944),
    "cincinnati": (39.1031, -84.5120),
    "pittsburgh": (40.4406, -79.9959),
    "baltimore": (39.2904, -76.6122),
    "washington": (38.9072, -77.0369),
    "salt lake city": (40.7608, -111.8910),
    "raleigh": (35.7796, -78.6382),
    "richmond": (37.5407, -77.4360),
    "new orleans": (29.9511, -90.0715),
    "oklahoma city": (35.4676, -97.5164),
    "omaha": (41.2565, -95.9345),
    "albuquerque": (35.0844, -106.6504),
    "el paso": (31.7619, -106.4850),
}


@dataclass
class Location:
    label: str
    lat: float
    lng: float


@dataclass
class Segment:
    start: Location
    end: Location
    distance_miles: float
    duration_hours: float
    geometry: list[list[float]]


def build_trip_plan(payload: dict[str, Any]) -> dict[str, Any]:
    current = clean_required(payload, "currentLocation")
    pickup = clean_required(payload, "pickupLocation")
    dropoff = clean_required(payload, "dropoffLocation")
    current_cycle = float(payload.get("currentCycleUsed", 0) or 0)
    if current_cycle < 0 or current_cycle > 70:
        raise ValueError("Current cycle used must be between 0 and 70 hours.")
    if current_cycle >= 69:
        raise ValueError("Current cycle used is too close to the 70-hour limit; plan a 34-hour restart before dispatch.")
    if normalize_location(current) == normalize_location(pickup):
        raise ValueError("Current location and pickup location must be different.")
    if normalize_location(pickup) == normalize_location(dropoff):
        raise ValueError("Pickup location and drop-off location must be different.")

    start_time_raw = payload.get("startTime")
    start_time = parse_start_time(start_time_raw)

    current_loc = geocode(current)
    pickup_loc = geocode(pickup)
    dropoff_loc = geocode(dropoff)
    segments = [route_segment(current_loc, pickup_loc), route_segment(pickup_loc, dropoff_loc)]

    events = schedule_trip(segments, start_time, current_cycle)
    instructions = build_instructions(events, segments)
    daily_logs = build_daily_logs(events)

    return {
        "locations": {
            "current": current_loc.__dict__,
            "pickup": pickup_loc.__dict__,
            "dropoff": dropoff_loc.__dict__,
        },
        "route": {
            "distanceMiles": round(sum(s.distance_miles for s in segments), 1),
            "driveHours": round(sum(s.duration_hours for s in segments), 2),
            "geometry": [point for segment in segments for point in segment.geometry],
        },
        "summary": summarize(events, current_cycle),
        "events": [event_to_json(event) for event in events],
        "instructions": instructions,
        "dailyLogs": daily_logs,
    }


def clean_required(payload: dict[str, Any], key: str) -> str:
    value = str(payload.get(key, "")).strip()
    if not value:
        raise ValueError(f"{key} is required.")
    return value


def normalize_location(value: str) -> str:
    return " ".join(value.lower().replace(",", " ").split())


def parse_start_time(value: str | None) -> datetime:
    if value:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    return now.replace(hour=8, minute=0, second=0, microsecond=0)


def geocode(label: str) -> Location:
    key = label.lower().split(",")[0].strip()
    if key in KNOWN_PLACES:
        lat, lng = KNOWN_PLACES[key]
        return Location(label=label, lat=lat, lng=lng)

    query = urlencode({"q": label, "format": "json", "limit": 1, "countrycodes": "us"})
    url = f"https://nominatim.openstreetmap.org/search?{query}"
    data = fetch_json(url)
    if data:
        return Location(label=label, lat=float(data[0]["lat"]), lng=float(data[0]["lon"]))

    raise ValueError(f"Could not geocode '{label}'. Try a U.S. city and state.")


def route_segment(start: Location, end: Location) -> Segment:
    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start.lng},{start.lat};{end.lng},{end.lat}?overview=full&geometries=geojson"
    )
    data = fetch_json(url)
    if data and data.get("routes"):
        route = data["routes"][0]
        distance_miles = route["distance"] / 1609.344
        duration_hours = route["duration"] / 3600
        geometry = [[lat, lng] for lng, lat in route["geometry"]["coordinates"]]
        return Segment(start, end, distance_miles, duration_hours, geometry)

    miles = haversine_miles(start.lat, start.lng, end.lat, end.lng) * 1.2
    return Segment(start, end, miles, miles / AVG_SPEED_MPH, [[start.lat, start.lng], [end.lat, end.lng]])


def fetch_json(url: str) -> Any | None:
    try:
        request = Request(url, headers={"User-Agent": "FMCSA-HOS-Planner-Assessment/1.0"})
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 3958.8
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def schedule_trip(segments: list[Segment], start_time: datetime, current_cycle: float) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    clock = start_time
    day_drive = 0.0
    day_on_duty = 0.0
    drive_since_break = 0.0
    cycle_used = current_cycle
    miles_since_fuel = 0.0

    def add(status: str, hours: float, title: str, location: str, miles: float = 0.0) -> None:
        nonlocal clock
        if hours <= 0:
            return
        start = clock
        clock = clock + timedelta(hours=hours)
        events.append(
            {
                "status": status,
                "start": start,
                "end": clock,
                "hours": hours,
                "title": title,
                "location": location,
                "miles": miles,
            }
        )

    def ensure_cycle(hours_needed: float) -> None:
        nonlocal cycle_used, day_drive, day_on_duty, drive_since_break
        if cycle_used + hours_needed <= MAX_CYCLE:
            return
        add("Off Duty", RESTART_HOURS, "34-hour restart", "Safe parking")
        cycle_used = 0.0
        day_drive = 0.0
        day_on_duty = 0.0
        drive_since_break = 0.0

    def reset_day(reason: str) -> None:
        nonlocal day_drive, day_on_duty, drive_since_break
        add("Off Duty", REST_HOURS, reason, "Sleeper berth / off duty")
        day_drive = 0.0
        day_on_duty = 0.0
        drive_since_break = 0.0

    def on_duty(hours: float, title: str, location: str) -> None:
        nonlocal day_on_duty, cycle_used
        ensure_cycle(hours)
        if day_on_duty + hours > MAX_DUTY_WINDOW:
            reset_day("10-hour reset before more on-duty work")
        add("On Duty", hours, title, location)
        day_on_duty += hours
        cycle_used += hours

    remaining = [
        {"segment": segments[0], "kind": "to pickup", "miles_left": segments[0].distance_miles},
        {"segment": segments[1], "kind": "to drop-off", "miles_left": segments[1].distance_miles},
    ]

    for index, item in enumerate(remaining):
        segment: Segment = item["segment"]
        miles_left = item["miles_left"]
        while miles_left > 0.05:
            if day_drive >= MAX_DRIVE_DAY or day_on_duty >= MAX_DUTY_WINDOW:
                reset_day("10-hour off-duty reset")

            if drive_since_break >= BREAK_TRIGGER:
                add("Off Duty", 0.5, "30-minute rest break", "Rest area")
                drive_since_break = 0.0

            if miles_since_fuel >= FUEL_INTERVAL_MILES:
                on_duty(FUEL_STOP_HOURS, "Fuel stop", "Truck stop")
                miles_since_fuel = 0.0

            available_drive = min(
                MAX_DRIVE_DAY - day_drive,
                MAX_DUTY_WINDOW - day_on_duty,
                BREAK_TRIGGER - drive_since_break,
                (MAX_CYCLE - cycle_used),
                miles_left / AVG_SPEED_MPH,
            )
            if available_drive <= 0.01:
                ensure_cycle(1)
                if MAX_CYCLE - cycle_used <= 0.01:
                    continue
                reset_day("10-hour off-duty reset")
                continue

            miles = min(miles_left, available_drive * AVG_SPEED_MPH)
            drive_hours = miles / AVG_SPEED_MPH
            add("Driving", drive_hours, f"Drive {item['kind']}", f"{segment.start.label} to {segment.end.label}", miles)
            day_drive += drive_hours
            day_on_duty += drive_hours
            drive_since_break += drive_hours
            cycle_used += drive_hours
            miles_since_fuel += miles
            miles_left -= miles

        if index == 0:
            on_duty(PICKUP_HOURS, "Pickup loading", segment.end.label)
        else:
            on_duty(DROPOFF_HOURS, "Drop-off unloading", segment.end.label)

    return events


def build_instructions(events: list[dict[str, Any]], segments: list[Segment]) -> list[str]:
    instructions = [
        f"Start at {segments[0].start.label} and drive toward pickup at {segments[0].end.label}.",
        "Complete 1 hour on duty for pickup loading.",
        f"Continue from {segments[1].start.label} to drop-off at {segments[1].end.label}.",
        "Complete 1 hour on duty for drop-off unloading.",
    ]
    for event in events:
        if event["title"] in {"Fuel stop", "30-minute rest break", "34-hour restart"}:
            instructions.append(f"{event['title']} at {format_dt(event['start'])}.")
    return instructions


def build_daily_logs(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    days: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        start = event["start"]
        end = event["end"]
        cursor = start
        while cursor < end:
            day_end = cursor.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            split_end = min(day_end, end)
            date_key = cursor.date().isoformat()
            days.setdefault(date_key, []).append(
                {
                    **event,
                    "start": cursor,
                    "end": split_end,
                    "hours": (split_end - cursor).total_seconds() / 3600,
                }
            )
            cursor = split_end

    logs = []
    for date_key, day_events in sorted(days.items()):
        totals = {status: 0.0 for status in ["Off Duty", "Sleeper Berth", "Driving", "On Duty"]}
        for event in day_events:
            totals[event["status"]] += event["hours"]
        logs.append(
            {
                "date": date_key,
                "events": [event_to_json(event) for event in day_events],
                "totals": {key: round(value, 2) for key, value in totals.items()},
                "remarks": [
                    f"{format_time(event['start'])}-{format_time(event['end'])}: {event['title']} ({event['location']})"
                    for event in day_events
                    if event["status"] != "Off Duty"
                ],
            }
        )
    return logs


def summarize(events: list[dict[str, Any]], current_cycle: float) -> dict[str, Any]:
    driving = sum(e["hours"] for e in events if e["status"] == "Driving")
    on_duty = sum(e["hours"] for e in events if e["status"] in {"Driving", "On Duty"})
    off_duty = sum(e["hours"] for e in events if e["status"] == "Off Duty")
    miles = sum(e.get("miles", 0) for e in events)
    return {
        "totalDrivingHours": round(driving, 2),
        "totalOnDutyHours": round(on_duty, 2),
        "totalOffDutyHours": round(off_duty, 2),
        "totalMiles": round(miles, 1),
        "projectedCycleUsed": round(min(MAX_CYCLE, current_cycle + on_duty), 2),
        "days": len(build_daily_logs(events)),
        "startsAt": events[0]["start"].isoformat() if events else None,
        "endsAt": events[-1]["end"].isoformat() if events else None,
    }


def event_to_json(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": event["status"],
        "start": event["start"].isoformat(),
        "end": event["end"].isoformat(),
        "hours": round(event["hours"], 2),
        "title": event["title"],
        "location": event["location"],
        "miles": round(event.get("miles", 0), 1),
    }


def format_dt(value: datetime) -> str:
    return value.strftime("%b %d, %I:%M %p UTC")


def format_time(value: datetime) -> str:
    return value.strftime("%H:%M")
