/**
 * Glanceable weather products for Alexa+ chat (same contract as DOC ChatVisuals).
 * Live NOAA / IEM / WPC / SPC URLs — no third-party LLM.
 */
export type ChatVisual = {
  id: string;
  type: "image" | "image_loop" | "chart" | "map" | "metrics" | "link_card";
  title: string;
  caption?: string | null;
  source?: string | null;
  fetched_at: string;
  url?: string | null;
  urls?: string[] | null;
  chart_kind?: string | null;
  chart_data?: Record<string, unknown> | null;
  lat?: number | null;
  lon?: number | null;
  zoom?: number | null;
  metrics?: { label: string; value: string }[] | null;
  href?: string | null;
  product: string;
};

const ALIASES: { product: string; re: RegExp }[] = [
  { product: "radar", re: /\bradar\b|\bnexrad\b|\breflectivity\b/i },
  { product: "radar_velocity", re: /\bvelocity\b|\bcouplet|\bsrv\b/i },
  { product: "satellite", re: /\bsatellite\b|\bgoes\b|\bgeocolor\b|\binfrared\b|\bwater\s+vapor\b/i },
  { product: "skew_t", re: /\bskew[-\s]?t\b|\bsounding\b|\batmospheric\s+profile\b/i },
  { product: "hodograph", re: /\bhodograph\b|\bwind\s+profile\b/i },
  { product: "spc_outlook", re: /\bspc\b|\boutlook\b|\bday\s*[123]\s+risk\b|\bconvective\s+outlook\b/i },
  { product: "surface_map", re: /\bsurface\s+(?:map|analysis|chart)\b|\bwpc\b|\bfronts?\b/i },
  { product: "upper_air", re: /\bupper[-\s]?air\b|\b500\s*mb\b|\b850\s*mb\b|\b300\s*mb\b/i },
  { product: "forecast_chart", re: /\bforecast\s+chart\b|\btemp(?:erature)?\s+chart\b|\b7[-\s]?day\b|\bhourly\s+chart\b|\bmeteogram\b|\bgraph\b/i },
  { product: "map", re: /\bmap\b|\bglobe\b|\bopenstreetmap\b/i },
  { product: "alerts_map", re: /\balert(?:s)?\s+map\b|\bhazards?\s+map\b/i },
  { product: "qpf", re: /\bqpf\b|\bprecip(?:itation)?\s+(?:map|forecast|chart)\b/i },
  { product: "hurricane", re: /\bhurricane\b|\btropical\b|\bnhc\b|\bcone\b/i },
  { product: "threat_shield", re: /\bthreat\s+shield\b|\bdti\b/i },
  { product: "scri", re: /\bscri\b|\bsupercell\s+composite\b/i },
  { product: "composite", re: /\bcape\b|\bstp\b|\bscp\b|\bparameters?\b/i },
  { product: "fire", re: /\bwildfire\b|\bfirms\b|\bhotspot/i },
];

const VISUAL_VERB =
  /\b(show|display|plot|draw|generate|render|pull|fetch|get|open|load|see|view|give\s+me|send\s+me|bring\s+up|chart|map|loop|graphic|visual|image|picture|diagram)\b/i;

function nowIso() {
  return new Date().toISOString();
}

function bust(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

function item(partial: Omit<ChatVisual, "fetched_at"> & { fetched_at?: string }): ChatVisual {
  const v: ChatVisual = {
    caption: null,
    source: null,
    url: null,
    urls: null,
    chart_kind: null,
    chart_data: null,
    lat: null,
    lon: null,
    zoom: null,
    metrics: null,
    href: null,
    fetched_at: nowIso(),
    ...partial,
  };
  if (v.url) v.url = bust(v.url);
  if (v.urls) v.urls = v.urls.map(bust);
  return v;
}

export function detectProducts(message: string): string[] {
  const text = message || "";
  const found: string[] = [];
  for (const a of ALIASES) {
    if (a.re.test(text) && !found.includes(a.product)) found.push(a.product);
  }
  if (VISUAL_VERB.test(text) && !found.length) {
    found.push("radar", "satellite", "map");
  }
  if (/\b(weather|temp|forecast|conditions|humidity|wind|brief|hose|grill)\b/i.test(text) && !found.length) {
    found.push("forecast_chart");
  }
  return found;
}

function nearestRadar(lat: number, lon: number): string {
  const sites: [string, number, number][] = [
    ["KBUF", 42.9489, -78.7369],
    ["KTYX", 43.7558, -75.68],
    ["KBGM", 42.1997, -75.9847],
    ["KENX", 42.5864, -74.0644],
    ["KCLE", 41.4131, -81.8597],
  ];
  let best = "KBUF";
  let bestD = Infinity;
  for (const [id, slat, slon] of sites) {
    const d = (lat - slat) ** 2 + (lon - slon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function buildVisuals(opts: {
  message: string;
  lat: number;
  lon: number;
  locationName: string;
  toolName?: string;
  toolData?: Record<string, unknown>;
}): { visuals: ChatVisual[]; products: string[] } {
  const products = detectProducts(opts.message);
  const { lat, lon, locationName, toolData } = opts;
  const site = nearestRadar(lat, lon);
  const visuals: ChatVisual[] = [];

  const reading = (toolData?.reading || (toolData?.current as { reading?: unknown } | undefined)?.reading) as
    | { tempF?: number; humidityPct?: number; windMph?: number; text?: string }
    | undefined;
  const decision = toolData?.decision as string | undefined;
  const forecastRows = (toolData?.forecast ||
    (toolData as { forecast?: { forecast?: unknown } })?.forecast?.forecast) as
    | Array<{ observedAt?: string; tempF?: number; text?: string; precipIn?: number }>
    | undefined;

  if (reading || decision) {
    const metrics: { label: string; value: string }[] = [];
    if (reading?.tempF != null) metrics.push({ label: "Temp", value: `${reading.tempF}°F` });
    if (reading?.humidityPct != null) metrics.push({ label: "RH", value: `${reading.humidityPct}%` });
    if (reading?.windMph != null) metrics.push({ label: "Wind", value: `${reading.windMph} mph` });
    if (reading?.text) metrics.push({ label: "Sky", value: String(reading.text) });
    if (decision) metrics.push({ label: "Call", value: String(decision) });
    if (metrics.length) {
      visuals.push(
        item({
          id: "metrics-now",
          type: "metrics",
          title: `Now — ${locationName}`,
          product: "metrics",
          source: "Open-Meteo + Doc AI",
          metrics,
        })
      );
    }
  }

  const wantForecast =
    products.includes("forecast_chart") ||
    opts.toolName === "get_forecast" ||
    opts.toolName === "chat_summary" ||
    opts.toolName === "should_i" ||
    opts.toolName === "get_current_weather";
  if (Array.isArray(forecastRows) && forecastRows.length && (wantForecast || products.length > 0)) {
    visuals.push(
      item({
        id: "chart-forecast",
        type: "chart",
        title: `Forecast chart — ${locationName}`,
        product: "forecast_chart",
        source: "Open-Meteo",
        chart_kind: "series",
        chart_data: {
          periods: forecastRows.slice(0, 8).map((r) => ({
            name: String(r.observedAt || "").slice(0, 10),
            temperature: r.tempF,
            shortForecast: r.text,
          })),
        },
      })
    );
  } else if (wantForecast && !forecastRows?.length) {
    products.push("forecast_chart");
  }

  const wantRadar = products.includes("radar") || products.includes("radar_velocity") || products.includes("alerts_map");
  if (wantRadar) {
    const frames = [0, 1, 2, 3, 4].map(
      (i) => `https://mesonet.agron.iastate.edu/data/gis/images/4326/USCOMP/n0q_${i}.png`
    );
    visuals.push(
      item({
        id: "radar-us",
        type: "image",
        title: "US composite reflectivity",
        product: "radar",
        source: "IEM USCOMP",
        caption: "Live CONUS base reflectivity",
        url: "https://mesonet.agron.iastate.edu/data/gis/images/4326/USCOMP/n0q_0.png",
        href: `https://radar.weather.gov/?center=${lat},${lon}&zoom=7`,
      }),
      item({
        id: "radar-site",
        type: "image",
        title: `${site} base reflectivity`,
        product: "radar",
        source: "IEM ridge",
        url: `https://mesonet.agron.iastate.edu/data/gis/images/4326/ridge/${site}/N0Q_0.png`,
      }),
      item({
        id: "radar-loop",
        type: "image_loop",
        title: "Radar loop (US composite)",
        product: "radar",
        source: "IEM USCOMP",
        urls: frames,
      })
    );
  }

  if (products.includes("radar_velocity")) {
    visuals.push(
      item({
        id: "radar-n0u",
        type: "image",
        title: `${site} base velocity`,
        product: "radar_velocity",
        source: "IEM ridge",
        url: `https://mesonet.agron.iastate.edu/data/gis/images/4326/ridge/${site}/N0U_0.png`,
      })
    );
  }

  if (products.includes("satellite")) {
    visuals.push(
      item({
        id: "sat-ne",
        type: "image",
        title: "GOES-19 Northeast GeoColor",
        product: "satellite",
        source: "NOAA NESDIS",
        url: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ne/GEOCOLOR/latest.jpg",
      }),
      item({
        id: "sat-conus",
        type: "image",
        title: "GOES-19 CONUS GeoColor",
        product: "satellite",
        source: "NOAA NESDIS",
        url: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/latest.jpg",
      })
    );
  }

  if (products.includes("upper_air") || products.includes("surface_map")) {
    visuals.push(
      item({
        id: "ua-sfc",
        type: "image",
        title: "WPC Surface Analysis",
        product: "upper_air",
        source: "NOAA/NWS WPC",
        caption: "Live surface analysis",
        url: "https://www.wpc.ncep.noaa.gov/sfc/namussfcwbg.gif",
        href: "https://www.wpc.ncep.noaa.gov/sfc/sfc_conus.php",
      }),
      item({
        id: "ua-basic",
        type: "image",
        title: "WPC Basic Weather",
        product: "upper_air",
        source: "NOAA/NWS WPC",
        url: "https://www.wpc.ncep.noaa.gov/basicwx/92fwbg.gif",
        href: "https://www.wpc.ncep.noaa.gov/basicwx/basicwx_ndfd.php",
      }),
      item({
        id: "ua-rap-500",
        type: "link_card",
        title: "RAP 500 mb height/vorticity (MAG)",
        product: "upper_air",
        source: "NCEP MAG",
        caption: "Model guidance for 500 mb",
        href: "https://mag.ncep.noaa.gov/model-guidance-model-parameter.php?group=Model%20Guidance&model=RAP&area=Namer&param=500_ht_abs_vort",
      })
    );
  }

  if (products.includes("skew_t") || products.includes("hodograph") || products.includes("composite")) {
    visuals.push(
      item({
        id: "skew-spc",
        type: "link_card",
        title: "SPC observed soundings",
        product: "skew_t",
        source: "SPC",
        caption: "Interactive radiosonde explorer",
        href: "https://www.spc.noaa.gov/exper/soundings/",
      }),
      item({
        id: "skew-doc",
        type: "link_card",
        title: "DOC Skew-T / tools",
        product: "skew_t",
        source: "whatsupdoc.fyi",
        href: `https://whatsupdoc.fyi/tools`,
      })
    );
  }

  if (products.includes("spc_outlook")) {
    visuals.push(
      item({
        id: "spc-d1",
        type: "image",
        title: "SPC Day 1 convective outlook",
        product: "spc_outlook",
        source: "NWS SPC",
        url: "https://www.spc.noaa.gov/products/outlook/day1otlk_sm.png",
        href: "https://www.spc.noaa.gov/products/outlook/",
      })
    );
  }

  if (products.includes("qpf")) {
    visuals.push(
      item({
        id: "qpf-wpc",
        type: "image",
        title: "WPC QPF",
        product: "qpf",
        source: "NOAA/NWS WPC",
        url: "https://www.wpc.ncep.noaa.gov/qpf/fill_94qwbg.gif",
        href: "https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml",
      })
    );
  }

  if (products.includes("hurricane")) {
    visuals.push(
      item({
        id: "nhc-cone",
        type: "image",
        title: "NHC Atlantic cone",
        product: "hurricane",
        source: "NHC",
        url: "https://www.nhc.noaa.gov/xgtwo/two_atl_5d0.png",
        href: "https://www.nhc.noaa.gov/",
      })
    );
  }

  if (products.includes("map") || products.includes("alerts_map")) {
    visuals.push(
      item({
        id: "map-point",
        type: "map",
        title: `Map — ${locationName}`,
        product: "map",
        source: "OpenStreetMap",
        lat,
        lon,
        zoom: 7,
        href: `https://www.openstreetmap.org/#map=7/${lat.toFixed(4)}/${lon.toFixed(4)}`,
      }),
      item({
        id: "map-rainviewer",
        type: "link_card",
        title: "RainViewer animated radar",
        product: "map",
        source: "RainViewer",
        href: `https://www.rainviewer.com/map.html?loc=${lat},${lon},7`,
      })
    );
  }

  if (products.includes("threat_shield") || products.includes("scri")) {
    visuals.push(
      item({
        id: "doc-threat",
        type: "link_card",
        title: "DOC Threat Shield",
        product: "threat_shield",
        source: "whatsupdoc.fyi",
        href: "https://whatsupdoc.fyi/threat-shield",
      }),
      item({
        id: "doc-globe",
        type: "link_card",
        title: "DOC Globe",
        product: "map",
        source: "whatsupdoc.fyi",
        href: "https://whatsupdoc.fyi/doc",
      })
    );
  }

  const delivered = [...new Set(visuals.map((v) => v.product))];
  return { visuals, products: delivered.length ? delivered : products };
}
