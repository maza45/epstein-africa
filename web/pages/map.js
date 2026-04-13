import { useEffect, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import Nav from "../components/Nav";
import { buildMapData } from "../lib/mapData";
import {
  BASE,
  MAP_COPY,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getOgLocale,
  hasFrenchStaticPage,
  normalizeLocale,
} from "../lib/i18n";

export function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("map");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const { countryData } = buildMapData(normalizedLocale);
  const countryCount = Object.keys(countryData).filter(
    (k) => countryData[k].emailCount > 0 || countryData[k].storyCount > 0 || countryData[k].peopleCount > 0
  ).length;
  return { props: { countryData, countryCount, locale: normalizedLocale, frAvailable } };
}

function CountryPanel({ country, data, onClose, locale, copy }) {
  if (!country) return null;
  const countryLabel = getLocalizedCountryLabel(country, locale);

  return (
    <div className="map-panel">
      <button className="map-panel-close" onClick={onClose} aria-label={copy.closePanel}>
        &times;
      </button>
      <h2>{countryLabel}</h2>

      <div className="map-panel-stats">
        <div className="map-stat">
          <span className="map-stat-num">{data.emailCount.toLocaleString()}</span>
          <span className="map-stat-label">{copy.emails}</span>
        </div>
        <div className="map-stat">
          <span className="map-stat-num">{data.storyCount}</span>
          <span className="map-stat-label">{copy.stories}</span>
        </div>
        <div className="map-stat">
          <span className="map-stat-num">{data.peopleCount}</span>
          <span className="map-stat-label">{copy.people}</span>
        </div>
      </div>

      {data.stories.length > 0 && (
        <div className="map-panel-section">
          <h3>{copy.storiesHeading}</h3>
          <ul>
            {data.stories.map((s) => (
              <li key={s.slug}>
                <Link href={`/stories/${s.slug}`} locale={locale}>{s.title}</Link>
                <span className="map-panel-meta">{s.date_range}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.people.length > 0 && (
        <div className="map-panel-section">
          <h3>{copy.peopleHeading}</h3>
          <ul>
            {data.people.map((p) => (
              <li key={p.slug}>
                <Link href={`/people/${p.slug}`} locale={locale}>{p.name}</Link>
                <span className="map-panel-meta">{p.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.topSenders.length > 0 && (
        <div className="map-panel-section">
          <h3>{copy.topSenders}</h3>
          <ul>
            {data.topSenders.map((s, i) => (
              <li key={i}>
                {s.name} <span className="map-panel-meta">({s.count})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="map-panel-section">
        <Link href={`/?country=${encodeURIComponent(country)}`} locale={locale} className="map-panel-link">
          {copy.viewAll.replace("{country}", countryLabel)} &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function MapPage({ countryData, countryCount, locale, frAvailable }) {
  const copy = MAP_COPY[locale] || MAP_COPY.en;
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [d3Ready, setD3Ready] = useState(
    typeof window !== "undefined" && !!window.d3
  );
  const [geoData, setGeoData] = useState(null);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);

  const handleSelect = useCallback((countryName) => {
    setSelected(countryName);
    selectedRef.current = countryName;
  }, []);

  // Load GeoJSON from static file
  useEffect(() => {
    fetch("/africa.geo.json")
      .then((r) => r.json())
      .then(setGeoData);
  }, []);

  // Render map when both D3 and GeoJSON are ready
  useEffect(() => {
    if (!d3Ready || !geoData || !svgRef.current || !containerRef.current) return;

    const d3 = window.d3;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("width", width).attr("height", height);

    // Projection centered on Africa
    const projection = d3.geoMercator()
      .center([20, 2])
      .scale(Math.min(width, height) * 0.55)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Color scale based on email count
    const maxEmails = Math.max(
      ...Object.values(countryData).map((d) => d.emailCount),
      1
    );
    const colorScale = d3.scaleLog()
      .domain([1, maxEmails])
      .range(["#1a2332", "#c9a227"])
      .clamp(true);

    // Zoom
    const g = svg.append("g");
    svg.call(
      d3.zoom()
        .scaleExtent([0.5, 8])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Detect touch device — no tooltip on mobile
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // A country is "covered" if it has any emails, stories, or people.
    // Previously this gated only on emailCount > 0, which made story-only
    // countries (e.g. Equatorial Guinea after the 2026-04-08 lead) invisible.
    const hasContent = (data) =>
      data && (data.emailCount > 0 || data.storyCount > 0 || data.peopleCount > 0);

    // Draw countries
    const paths = g.selectAll("path")
      .data(geoData.features)
      .join("path")
      .attr("d", path)
      .attr("fill", (d) => {
        const name = d.properties.name;
        const data = countryData[name];
        if (!hasContent(data)) return "#0d1117";
        if (data.emailCount === 0) return "#5a4a1a"; // story-only fallback (dim gold)
        return colorScale(data.emailCount);
      })
      .attr("stroke", "#2a3a4a")
      .attr("stroke-width", 0.5)
      .attr("cursor", (d) => {
        const name = d.properties.name;
        const data = countryData[name];
        return hasContent(data) ? "pointer" : "default";
      })
      .on("click", (event, d) => {
        const name = d.properties.name;
        const data = countryData[name];
        if (hasContent(data)) {
          handleSelect(name);
          g.selectAll("path")
            .attr("stroke", "#2a3a4a")
            .attr("stroke-width", 0.5);
          d3.select(event.currentTarget)
            .attr("stroke", "#c9a227")
            .attr("stroke-width", 2)
            .raise();
          if (isTouch) tooltip.style("display", "none");
        }
      });

    // Desktop only: hover tooltip
    if (!isTouch) {
      paths
        .on("mouseenter", function (event, d) {
          const name = d.properties.name;
          const data = countryData[name];
          if (hasContent(data)) {
            d3.select(this).attr("stroke", "#c9a227").attr("stroke-width", 1.5);
            tooltip
              .style("display", "block")
              .html(`<strong>${getLocalizedCountryLabel(name, locale)}</strong><br>${data.emailCount} ${copy.emails}, ${data.storyCount} ${copy.stories}`);
          }
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseleave", function (event, d) {
          const name = d.properties.name;
          if (name !== selectedRef.current) {
            d3.select(this).attr("stroke", "#2a3a4a").attr("stroke-width", 0.5);
          }
          tooltip.style("display", "none");
        });
    }

    // Island nations too small for 110m polygons — render as dots
    const ISLANDS = [
      { name: "Mauritius", lon: 57.55, lat: -20.35 },
      { name: "Seychelles", lon: 55.45, lat: -4.68 },
      { name: "Comoros", lon: 43.87, lat: -11.87 },
      { name: "Cape Verde", lon: -23.63, lat: 16.0 },
      { name: "Sao Tome and Principe", lon: 6.61, lat: 0.19 },
    ].filter((d) => hasContent(countryData[d.name]));

    const islandDots = g.selectAll(".island-dot")
      .data(ISLANDS)
      .join("circle")
      .attr("class", "island-dot")
      .attr("cx", (d) => projection([d.lon, d.lat])[0])
      .attr("cy", (d) => projection([d.lon, d.lat])[1])
      .attr("r", 5)
      .attr("fill", (d) => {
        const data = countryData[d.name];
        return data.emailCount > 0 ? colorScale(data.emailCount) : "#5a4a1a";
      })
      .attr("stroke", "#2a3a4a")
      .attr("stroke-width", 0.5)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        handleSelect(d.name);
        g.selectAll("path").attr("stroke", "#2a3a4a").attr("stroke-width", 0.5);
        islandDots.attr("stroke", "#2a3a4a").attr("stroke-width", 0.5);
        d3.select(event.currentTarget)
          .attr("stroke", "#c9a227")
          .attr("stroke-width", 2);
        if (isTouch) tooltip.style("display", "none");
      });

    if (!isTouch) {
      islandDots
        .on("mouseenter", function (event, d) {
          d3.select(this).attr("stroke", "#c9a227").attr("stroke-width", 1.5);
          const data = countryData[d.name];
          tooltip
            .style("display", "block")
            .html(`<strong>${getLocalizedCountryLabel(d.name, locale)}</strong><br>${data.emailCount} ${copy.emails}, ${data.storyCount} ${copy.stories}`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseleave", function (event, d) {
          if (d.name !== selectedRef.current) {
            d3.select(this).attr("stroke", "#2a3a4a").attr("stroke-width", 0.5);
          }
          tooltip.style("display", "none");
        });
    }

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "map-tooltip")
      .style("display", "none");

    return () => {
      tooltip.remove();
    };
  }, [copy.emails, copy.stories, countryData, d3Ready, geoData, handleSelect, locale]);

  const selectedData = selected ? countryData[selected] : null;

  return (
    <>
      <Head>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={getCanonicalUrl("/map", locale)} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.description} />
        <meta property="og:url" content={getCanonicalUrl("/map", locale)} />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta
          property="og:image"
          content={`${BASE}/api/og?title=${encodeURIComponent(copy.title)}`}
        />
        <meta property="og:type" content="website" />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/map", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/map", "en")} />
        )}
      </Head>

      <Script
        src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"
        strategy="afterInteractive"
        onLoad={() => setD3Ready(true)}
      />

      <Nav pagePath="/map" frAvailable={frAvailable} />

      <main className="map-page">
        <div className="map-header">
          {copy.heading.replace("{count}", countryCount.toLocaleString())}
        </div>
        <div className="map-body">
          <div className="map-container" ref={containerRef}>
            <svg
              ref={svgRef}
              style={{ width: "100%", height: "100%", touchAction: "none" }}
            />
          </div>
          <CountryPanel
            country={selected}
            data={selectedData}
            locale={locale}
            copy={copy}
            onClose={() => {
              setSelected(null);
              selectedRef.current = null;
              if (svgRef.current) {
                const d3 = window.d3;
                if (d3) {
                  d3.select(svgRef.current)
                    .selectAll("path")
                    .attr("stroke", "#2a3a4a")
                    .attr("stroke-width", 0.5);
                }
              }
            }}
          />
        </div>
      </main>

    </>
  );
}
