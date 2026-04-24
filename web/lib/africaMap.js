import fs from "fs";
import path from "path";

const GEO_PATH = path.join(process.cwd(), "public", "africa.geo.json");

const NAME_ALIASES = {
  "Ivory Coast": ["Ivory Coast", "Côte d'Ivoire"],
  "DR Congo": ["Democratic Republic of the Congo", "DR Congo", "Congo, Dem. Rep.", "Democratic Republic of Congo"],
  Congo: ["Republic of the Congo", "Congo", "Congo-Brazzaville"],
  Tanzania: ["United Republic of Tanzania", "Tanzania"],
  Somaliland: ["Somaliland", "Somalia"],
};

function namesFor(c) {
  return NAME_ALIASES[c] || [c];
}

// Cylindrical projection. Africa bounds: lon [-18, 52], lat [-35, 37].
function projectPolygon(ring, w, h) {
  const minLon = -18;
  const maxLon = 52;
  const minLat = -36;
  const maxLat = 38;
  const sx = w / (maxLon - minLon);
  const sy = h / (maxLat - minLat);
  return ring
    .map(([lon, lat]) => {
      const x = (lon - minLon) * sx;
      const y = (maxLat - lat) * sy;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function featureToPath(feature, w, h) {
  const g = feature.geometry;
  if (!g) return "";
  const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polygons
    .map((poly) => {
      return poly
        .map((ring) => "M " + projectPolygon(ring, w, h).replace(/\s/g, " L ") + " Z")
        .join(" ");
    })
    .join(" ");
}

let cachedFeatures = null;
function loadFeatures() {
  if (cachedFeatures) return cachedFeatures;
  const raw = fs.readFileSync(GEO_PATH, "utf8");
  cachedFeatures = JSON.parse(raw).features;
  return cachedFeatures;
}

export function buildAfricaMapData(highlightedCountries, width = 280, height = 210) {
  const features = loadFeatures();
  const highlightSet = new Set(
    highlightedCountries.flatMap((c) => namesFor(c).map((n) => n.toLowerCase()))
  );
  return features.map((f) => ({
    name: f.properties?.name || "",
    active: highlightSet.has((f.properties?.name || "").toLowerCase()),
    d: featureToPath(f, width, height),
  }));
}
