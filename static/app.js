const { useEffect, useMemo, useRef, useState } = React;

const STATUS_ROWS = {
  "Off Duty": 0,
  "Sleeper Berth": 1,
  Driving: 2,
  "On Duty": 3,
};

const SAMPLE = {
  currentLocation: "Chicago, IL",
  pickupLocation: "Indianapolis, IN",
  dropoffLocation: "Atlanta, GA",
  currentCycleUsed: 12,
  startTime: new Date(new Date().setHours(8, 0, 0, 0)).toISOString().slice(0, 16),
};

const LOCATION_OPTIONS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "Austin, TX",
  "Jacksonville, FL",
  "Fort Worth, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "San Francisco, CA",
  "Indianapolis, IN",
  "Seattle, WA",
  "Denver, CO",
  "Miami, FL",
  "Atlanta, GA",
  "Boston, MA",
  "Detroit, MI",
  "Nashville, TN",
  "Memphis, TN",
  "Louisville, KY",
  "St. Louis, MO",
  "Kansas City, MO",
  "Minneapolis, MN",
  "Las Vegas, NV",
  "Portland, OR",
  "Orlando, FL",
  "Tampa, FL",
  "Cleveland, OH",
  "Cincinnati, OH",
  "Pittsburgh, PA",
  "Baltimore, MD",
  "Washington, DC",
  "Salt Lake City, UT",
  "Raleigh, NC",
  "Richmond, VA",
  "New Orleans, LA",
  "Oklahoma City, OK",
  "Omaha, NE",
  "Albuquerque, NM",
  "El Paso, TX",
];

function App() {
  const [form, setForm] = useState(SAMPLE);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const validation = validateTripForm(form);
    if (validation.length) {
      setError(validation.join(" "));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Planner failed");
      setPlan(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    submit({ preventDefault() {} });
  }, []);

  return (
    <main>
      <section className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Property-carrying CMV</p>
            <h1>FMCSA HOS Trip Planner</h1>
            <p className="lede">
              Plan a route, schedule required rests and stops, and generate daily log sheets from trip inputs.
            </p>
          </div>
          <TruckScene />
        </header>

        <section className="workspace">
          <TripForm form={form} loading={loading} update={update} submit={submit} />
          <div className="results">
            {error && <div className="alert">{error}</div>}
            {plan ? <PlanView plan={plan} /> : <EmptyState loading={loading} />}
          </div>
        </section>
      </section>
    </main>
  );
}

function TripForm({ form, loading, update, submit }) {
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Trip Inputs</h2>
      <LocationField label="Current location" value={form.currentLocation} onChange={(value) => update("currentLocation", value)} />
      <LocationField label="Pickup location" value={form.pickupLocation} onChange={(value) => update("pickupLocation", value)} />
      <LocationField label="Drop-off location" value={form.dropoffLocation} onChange={(value) => update("dropoffLocation", value)} />
      <div className="split">
        <label>
          Current cycle used
          <input
            type="number"
            min="0"
            max="70"
            step="0.25"
            value={form.currentCycleUsed}
            onChange={(e) => update("currentCycleUsed", e.target.value)}
          />
        </label>
        <label>
          Start time
          <input type="datetime-local" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={loading}>{loading ? "Planning..." : "Build HOS Plan"}</button>
      <p className="fineprint">Uses OpenStreetMap, Nominatim, and OSRM. If routing is unavailable, the app falls back to a conservative distance estimate.</p>
    </form>
  );
}

function validateTripForm(form) {
  const errors = [];
  const current = form.currentLocation.trim().toLowerCase();
  const pickup = form.pickupLocation.trim().toLowerCase();
  const dropoff = form.dropoffLocation.trim().toLowerCase();
  const cycle = Number(form.currentCycleUsed);

  if (!current || !pickup || !dropoff) {
    errors.push("Current, pickup, and drop-off locations are required.");
  }
  if (current && pickup && current === pickup) {
    errors.push("Current location and pickup location must be different.");
  }
  if (pickup && dropoff && pickup === dropoff) {
    errors.push("Pickup location and drop-off location must be different.");
  }
  if (!Number.isFinite(cycle) || cycle < 0 || cycle > 70) {
    errors.push("Current cycle used must be between 0 and 70 hours.");
  }
  if (cycle >= 69) {
    errors.push("Current cycle used is too close to the 70-hour limit; enter less than 69 hours or plan a 34-hour restart before dispatch.");
  }
  if (!form.startTime) {
    errors.push("Start time is required.");
  }

  return errors;
}

function LocationField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const fieldId = `${label.toLowerCase().replace(/[^a-z]+/g, "-")}-field`;
  const normalized = value.trim().toLowerCase();
  const matches = LOCATION_OPTIONS.filter((option) => option.toLowerCase().includes(normalized));
  const visibleOptions = showAll ? LOCATION_OPTIONS : matches.length ? matches : LOCATION_OPTIONS;

  function choose(option) {
    onChange(option);
    setOpen(false);
  }

  return (
    <label className="comboLabel" htmlFor={fieldId}>
      {label}
      <div className="combo">
        <input
          id={fieldId}
          value={value}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setShowAll(false);
            setOpen(true);
          }}
          onFocus={() => {
            setShowAll(true);
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <button
          type="button"
          className="comboToggle"
          aria-label={`Show ${label} options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setShowAll(true);
            setOpen((current) => !current);
          }}
        >
          <span />
        </button>
        {open && (
          <div className="comboMenu" role="listbox">
            {visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={option === value ? "comboOption selected" : "comboOption"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                role="option"
                aria-selected={option === value}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

function PlanView({ plan }) {
  const [activeTab, setActiveTab] = useState("instructions");

  return (
    <>
      <RouteRibbon plan={plan} />
      <SummaryCards plan={plan} />
      <RouteMap plan={plan} />
      <TabbedResults plan={plan} activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}

function DayOverview({ plan }) {
  return (
    <section className="panel dayOverview">
      <div className="sectionHead">
        <h2>Multi-Day Overview</h2>
        <span>{plan.dailyLogs.length} day plan</span>
      </div>
      <div className="dayGrid">
        {plan.dailyLogs.map((log, index) => {
          const miles = Math.round(log.events.reduce((sum, item) => sum + (item.miles || 0), 0));
          const hasReset = log.events.some((event) => event.title.toLowerCase().includes("reset") || event.title.toLowerCase().includes("restart"));
          return (
            <article className="dayCard" key={log.date}>
              <div className="dayTop">
                <span>Day {index + 1}</span>
                <strong>{formatDateLabel(log.date)}</strong>
              </div>
              <div className="dayStats">
                <span><b>{Number(log.totals.Driving || 0).toFixed(2)}</b> drive hrs</span>
                <span><b>{(Number(log.totals.Driving || 0) + Number(log.totals["On Duty"] || 0)).toFixed(2)}</b> on-duty hrs</span>
                <span><b>{miles}</b> miles</span>
              </div>
              <p>{hasReset ? "Includes required reset/off-duty recovery." : "Within standard daily HOS limits."}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TabbedResults({ plan, activeTab, setActiveTab }) {
  const tabs = [
    { id: "overview", label: "Multi-Day Overview", count: `${plan.dailyLogs.length} days` },
    { id: "instructions", label: "Route Instructions", count: `${plan.instructions.length} steps` },
    { id: "events", label: "Duty Events", count: `${plan.events.length} entries` },
    { id: "logs", label: "Daily Log Sheets", count: `${plan.dailyLogs.length} sheets` },
  ];

  return (
    <section className="panel tabPanel">
      <div className="tabs" role="tablist" aria-label="Trip plan views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab active" : "tab"}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.count}</small>
          </button>
        ))}
      </div>

      <div className="tabContent">
        {activeTab === "overview" && (
          <div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab" className="tabPane">
            <DayOverview plan={plan} inTab />
          </div>
        )}

        {activeTab === "instructions" && (
          <div id="instructions-panel" role="tabpanel" aria-labelledby="instructions-tab" className="tabPane">
            <div className="sectionHead">
              <h2>Route Instructions</h2>
              <span>{plan.instructions.length} steps</span>
            </div>
            <ol className="instructions">
              {plan.instructions.map((item, index) => <li key={index}>{item}</li>)}
            </ol>
          </div>
        )}

        {activeTab === "events" && (
          <div id="events-panel" role="tabpanel" aria-labelledby="events-tab" className="tabPane">
            <div className="sectionHead">
              <h2>Duty Events</h2>
              <span>{plan.events.length} entries</span>
            </div>
            <div className="timeline">
              {plan.events.map((event, index) => <EventRow key={index} event={event} />)}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div id="logs-panel" role="tabpanel" aria-labelledby="logs-tab" className="tabPane logs">
            <div className="sectionHead">
              <h2>Daily Log Sheets</h2>
              <div className="sectionActions">
                <span>{plan.dailyLogs.length} sheet{plan.dailyLogs.length === 1 ? "" : "s"}</span>
                <button type="button" className="printButton" onClick={printDailyLogs}>Print / Save PDF</button>
              </div>
            </div>
            <div className="printHint">Use the print dialog destination “Save as PDF” to export the daily log sheets.</div>
            <div className="printArea">
              {plan.dailyLogs.map((log) => <DailyLog key={log.date} log={log} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TruckScene() {
  return (
    <aside className="truckScene" aria-label="Animated truck route">
      <div className="sun" />
      <div className="skyLine skyLineOne" />
      <div className="skyLine skyLineTwo" />
      <div className="road">
        <div className="lane laneOne" />
        <div className="lane laneTwo" />
        <div className="truck">
          <div className="trailer" />
          <div className="cab">
            <span className="window" />
          </div>
          <span className="wheel wheelBack" />
          <span className="wheel wheelFront" />
        </div>
      </div>
      <div className="assumptions">
        <span>70 hrs / 8 days</span>
        <span>Fuel every 1,000 miles</span>
        <span>1 hr pickup/drop-off</span>
      </div>
    </aside>
  );
}

function RouteRibbon({ plan }) {
  return (
    <section className="routeRibbon">
      <div>
        <span>Current</span>
        <strong>{plan.locations.current.label}</strong>
      </div>
      <div className="routeLine"><span /></div>
      <div>
        <span>Pickup</span>
        <strong>{plan.locations.pickup.label}</strong>
      </div>
      <div className="routeLine"><span /></div>
      <div>
        <span>Drop-off</span>
        <strong>{plan.locations.dropoff.label}</strong>
      </div>
    </section>
  );
}

function SummaryCards({ plan }) {
  const items = [
    ["Route miles", plan.route.distanceMiles],
    ["Driving hours", plan.summary.totalDrivingHours],
    ["On-duty hours", plan.summary.totalOnDutyHours],
    ["Log sheets", plan.summary.days],
  ];
  return (
    <section className="metrics">
      {items.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function RouteMap({ plan }) {
  const mapRef = useRef(null);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (!window.L || !nodeRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    if (nodeRef.current._leaflet_id) {
      delete nodeRef.current._leaflet_id;
    }
    const map = L.map(nodeRef.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const route = plan.route.geometry;
    if (route.length) {
      const line = L.polyline(route, { color: "#0f766e", weight: 5, opacity: 0.9 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    }
    const points = [
      ["Current", plan.locations.current],
      ["Pickup", plan.locations.pickup],
      ["Drop-off", plan.locations.dropoff],
    ];
    points.forEach(([label, location]) => {
      L.marker([location.lat, location.lng]).addTo(map).bindPopup(`<strong>${label}</strong><br>${location.label}`);
    });
    return () => {
      map.remove();
      if (mapRef.current === map) {
        mapRef.current = null;
      }
      if (nodeRef.current && nodeRef.current._leaflet_id) {
        delete nodeRef.current._leaflet_id;
      }
    };
  }, [plan]);

  return (
    <section className="panel mapPanel">
      <div className="sectionHead">
        <h2>Route Map</h2>
        <span>{plan.route.driveHours} drive hrs</span>
      </div>
      <div className="map" ref={nodeRef} />
    </section>
  );
}

function EventRow({ event }) {
  return (
    <article className="event">
      <span className={`dot ${classNameFor(event.status)}`} />
      <div>
        <strong>{event.title}</strong>
        <p>{event.status} · {formatRange(event.start, event.end)} · {event.hours} hrs</p>
        <small>{event.location}{event.miles ? ` · ${event.miles} miles` : ""}</small>
      </div>
    </article>
  );
}

function DailyLog({ log }) {
  const paths = useMemo(() => buildLogPaths(log.events, log.date), [log]);
  const totals = ["Off Duty", "Sleeper Berth", "Driving", "On Duty"];

  return (
    <article className="logSheet">
      <div className="logHeader">
        <div>
          <h3>Driver's Daily Log</h3>
          <p>{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="logMeta">
          <span>Total miles driving today</span>
          <strong>{Math.round(log.events.reduce((sum, item) => sum + (item.miles || 0), 0))}</strong>
        </div>
      </div>
      <svg className="grid" viewBox="0 0 960 260" role="img" aria-label={`Daily log for ${log.date}`}>
        <rect x="100" y="40" width="800" height="144" fill="#fff" stroke="#1f2937" strokeWidth="1.5" />
        {Array.from({ length: 97 }).map((_, i) => {
          const x = 100 + (i * 800) / 96;
          const long = i % 4 === 0;
          const dayPart = i % 48 === 0;
          return <line key={i} x1={x} y1="40" x2={x} y2="184" stroke={dayPart ? "#111827" : long ? "#64748b" : "#cbd5e1"} strokeWidth={dayPart ? 1.3 : long ? 0.9 : 0.5} />;
        })}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = 40 + i * 36;
          return <line key={i} x1="100" y1={y} x2="900" y2={y} stroke="#111827" strokeWidth="1" />;
        })}
        {["Mid-night", "3", "6", "9", "Noon", "3", "6", "9", "Mid-night"].map((label, i) => (
          <text key={i} x={100 + i * 100} y="28" textAnchor="middle" className="svgLabel">{label}</text>
        ))}
        {totals.map((status, i) => (
          <g key={status}>
            <text x="16" y={63 + i * 36} className="svgStatus">{i + 1}. {status}</text>
            <text x="916" y={63 + i * 36} className="svgTotal">{Number(log.totals[status] || 0).toFixed(2)}</text>
          </g>
        ))}
        {paths.map((path, index) => (
          <polyline key={index} points={path} fill="none" stroke="#111827" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <text x="16" y="218" className="svgStatus">Remarks</text>
        <line x1="100" y1="216" x2="900" y2="216" stroke="#111827" strokeWidth="1" />
      </svg>
      <div className="remarks">
        {log.remarks.length ? log.remarks.map((remark, index) => <span key={index}>{remark}</span>) : <span>No on-duty remarks</span>}
      </div>
    </article>
  );
}

function buildLogPaths(events, date) {
  const dayStart = new Date(`${date}T00:00:00Z`).getTime();
  return events.map((event) => {
    const start = Math.max(0, (new Date(event.start).getTime() - dayStart) / 36e5);
    const end = Math.min(24, (new Date(event.end).getTime() - dayStart) / 36e5);
    const row = STATUS_ROWS[event.status] ?? 0;
    const y = 58 + row * 36;
    const x1 = 100 + (start / 24) * 800;
    const x2 = 100 + (end / 24) * 800;
    return `${x1},${y} ${x2},${y}`;
  });
}

function EmptyState({ loading }) {
  return <section className="panel empty">{loading ? "Building the trip plan..." : "Enter trip details to generate a plan."}</section>;
}

function classNameFor(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function formatRange(start, end) {
  return `${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}`;
}

function formatDateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function printDailyLogs() {
  const printArea = document.querySelector(".printArea");
  if (!printArea) return;

  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Daily Log Sheets</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
          }
          .printArea {
            width: 100%;
          }
          .logSheet {
            width: 10.2in;
            min-height: 7.2in;
            margin: 0 auto;
            padding: 0.28in;
            background: #fff;
            break-after: page;
            page-break-after: always;
          }
          .logSheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .logHeader {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 2px solid #111827;
            padding-bottom: 10px;
          }
          h3 {
            margin: 0 0 4px;
            font-size: 20px;
          }
          p {
            margin: 0;
          }
          .logMeta {
            min-width: 180px;
            text-align: right;
          }
          .logMeta span {
            display: block;
            color: #475569;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .logMeta strong {
            display: block;
            margin-top: 5px;
            font-size: 22px;
          }
          .grid {
            display: block;
            width: 100%;
            margin-top: 14px;
            border: 1px solid #111827;
            background: #fff;
          }
          .svgLabel,
          .svgStatus,
          .svgTotal {
            fill: #111827;
            font-size: 12px;
            font-weight: 700;
          }
          .svgStatus,
          .svgTotal {
            font-size: 11px;
          }
          .remarks {
            display: grid;
            gap: 5px;
            margin-top: 10px;
            color: #334155;
            font-size: 12px;
          }
          @page {
            size: landscape;
            margin: 0.25in;
          }
        </style>
      </head>
      <body>${printArea.outerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 350);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
