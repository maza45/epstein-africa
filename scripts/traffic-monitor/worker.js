const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// Thresholds
const COUNTRY_PAGEVIEW_THRESHOLD = 50; // per hour per country
const HIGH_REQUEST_THRESHOLD = 100; // per hour total
const LOW_UNIQUE_THRESHOLD = 5; // unique IPs

async function queryAnalytics(env, start, end) {
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${env.CF_ZONE_ID}" }) {
        httpRequests1hGroups(
          limit: 24,
          orderBy: [datetime_DESC],
          filter: {
            datetime_geq: "${start}",
            datetime_leq: "${end}"
          }
        ) {
          dimensions { datetime }
          sum {
            requests
            pageViews
            countryMap { clientCountryName requests pageViews }
            browserMap { uaBrowserFamily pageViews }
          }
          uniq { uniques }
        }
      }
    }
  }`;

  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) {
    throw new Error(`GraphQL request failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data.viewer.zones[0]?.httpRequests1hGroups || [];
}

function detectAnomalies(hourlyData) {
  const anomalies = [];
  const now = new Date().toISOString();

  for (const hour of hourlyData) {
    const dt = hour.dimensions.datetime;
    const requests = hour.sum.requests;
    const pageViews = hour.sum.pageViews;
    const uniques = hour.uniq.uniques;
    const countries = hour.sum.countryMap || [];
    const browsers = hour.sum.browserMap || [];

    // Check 1: single country >50 page views in one hour
    for (const c of countries) {
      if (c.pageViews > COUNTRY_PAGEVIEW_THRESHOLD) {
        anomalies.push({
          detected_at: now,
          anomaly_hour: dt,
          type: "country_concentration",
          country: c.clientCountryName,
          country_page_views: c.pageViews,
          country_requests: c.requests,
          total_page_views: pageViews,
          total_requests: requests,
          unique_ips: uniques,
          top_browsers: browsers
            .filter((b) => b.pageViews > 0)
            .map((b) => `${b.uaBrowserFamily}:${b.pageViews}`)
            .join(", "),
        });
      }
    }

    // Check 2: >100 requests from <=5 unique IPs
    if (requests > HIGH_REQUEST_THRESHOLD && uniques <= LOW_UNIQUE_THRESHOLD) {
      anomalies.push({
        detected_at: now,
        anomaly_hour: dt,
        type: "low_ip_high_request",
        total_requests: requests,
        total_page_views: pageViews,
        unique_ips: uniques,
        top_countries: countries
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 3)
          .map((c) => `${c.clientCountryName}:${c.requests}`)
          .join(", "),
        top_browsers: browsers
          .filter((b) => b.pageViews > 0)
          .map((b) => `${b.uaBrowserFamily}:${b.pageViews}`)
          .join(", "),
      });
    }
  }

  return anomalies;
}

async function writeAnomalies(env, anomalies) {
  // Read existing index
  const indexRaw = await env.TRAFFIC_ANOMALIES.get("index");
  const index = indexRaw ? JSON.parse(indexRaw) : [];

  for (const anomaly of anomalies) {
    const key = `anomaly:${anomaly.anomaly_hour}:${anomaly.type}`;

    // Skip if already recorded
    if (index.includes(key)) continue;

    await env.TRAFFIC_ANOMALIES.put(key, JSON.stringify(anomaly));
    index.push(key);
  }

  // Trim to 500 entries max (remove oldest)
  while (index.length > 500) {
    const oldest = index.shift();
    await env.TRAFFIC_ANOMALIES.delete(oldest);
  }

  await env.TRAFFIC_ANOMALIES.put("index", JSON.stringify(index));
  return index.length;
}

export default {
  // Cron trigger: runs daily at 08:00 UTC
  async scheduled(event, env, ctx) {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const hourlyData = await queryAnalytics(
      env,
      start.toISOString(),
      end.toISOString()
    );
    const anomalies = detectAnomalies(hourlyData);

    if (anomalies.length > 0) {
      const total = await writeAnomalies(env, anomalies);
      console.log(
        `Recorded ${anomalies.length} anomalies (${total} total in log)`
      );
    }
  },

  // GET route: read the anomaly log (requires X-Auth header)
  async fetch(request, env) {
    if (request.headers.get("X-Auth") !== env.LOG_SECRET) {
      return new Response("Not found", { status: 404 });
    }

    const indexRaw = await env.TRAFFIC_ANOMALIES.get("index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];

    const entries = [];
    for (const key of index) {
      const val = await env.TRAFFIC_ANOMALIES.get(key);
      if (val) entries.push(JSON.parse(val));
    }

    return new Response(JSON.stringify(entries, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
