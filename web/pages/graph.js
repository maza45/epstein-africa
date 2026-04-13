import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import Nav from "../components/Nav";
import { buildGraphData } from "../lib/graph";
import { BASE, getCanonicalUrl, hasFrenchStaticPage, normalizeLocale } from "../lib/i18n";

export async function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("graph");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const data = buildGraphData();
  return { props: { precomputedGraph: data, locale: normalizedLocale, frAvailable } };
}

export default function GraphPage({ precomputedGraph, locale, frAvailable }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const router = useRouter();

  const [d3Ready, setD3Ready] = useState(
    typeof window !== "undefined" && !!window.d3
  );
  const [graphData] = useState(precomputedGraph);
  const [exploreMode, setExploreMode] = useState(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  // Initialise D3 when both script and data are ready
  useEffect(() => {
    if (!d3Ready || !graphData || !svgRef.current || !containerRef.current) return;

    const d3 = window.d3;

    // Stop any previous simulation
    if (simulationRef.current) simulationRef.current.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    svg.attr("width", width).attr("height", height);

    // Deep-copy so D3 mutations don't affect state
    let nodes = graphData.nodes.map((d) => ({ ...d }));
    let allLinks = graphData.edges.map((d) => ({ ...d }));

    if (!exploreMode) {
      // Default: only published profiles + countries
      const kept = new Set();
      nodes = nodes.filter((n) => {
        if (n.type === "country") { kept.add(n.id); return true; }
        if (n.slug) { kept.add(n.id); return true; }
        return false;
      });
      allLinks = allLinks.filter(
        (l) => kept.has(l.source) && kept.has(l.target)
      );
    }

    // Cull low-weight edges when graph is large to prevent browser freeze
    const edgeThreshold = allLinks.length > 600 ? 2 : allLinks.length > 300 ? 1 : 0;
    let links = edgeThreshold > 0
      ? allLinks.filter((l) => l.weight > edgeThreshold)
      : allLinks;

    // Remove orphan nodes (no remaining edges) after culling
    {
      const connected = new Set();
      links.forEach((l) => { connected.add(l.source); connected.add(l.target); });
      nodes = nodes.filter((n) => connected.has(n.id));
    }

    // Edge opacity scale
    const weights = links.map((l) => l.weight);
    const maxW = Math.max(...weights, 1);
    const minW = Math.min(...weights, 0);
    const opacityScale = d3.scaleLinear().domain([minW, maxW]).range([0.08, 0.65]).clamp(true);

    // Node radius scale based on email count
    const maxEmails = Math.max(...nodes.filter((n) => n.type === "person").map((n) => n.emailCount || 1), 1);
    const radiusScale = d3.scaleSqrt().domain([1, maxEmails]).range([6, 20]).clamp(true);

    // Zoom container
    const g = svg.append("g");

    svg.call(
      d3.zoom()
        .scaleExtent([0.15, 5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Scale simulation parameters to graph size
    const isLarge = nodes.length > 100;
    const chargeStrength = isLarge ? -300 : -500;
    const chargeMax = isLarge ? 400 : 600;
    const decay = isLarge ? 0.04 : 0.02;

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => (d.type === "person-person" ? 180 : 140))
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength).distanceMax(chargeMax))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collide", d3.forceCollide((d) => {
        if (d.type === "country") return 42;
        return (radiusScale(d.emailCount || 1)) + 12;
      }))
      .alphaDecay(decay);

    simulationRef.current = simulation;

    // Pre-build adjacency map for O(1) highlight lookups
    const neighbors = new Map();
    links.forEach((l) => {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      if (!neighbors.has(sid)) neighbors.set(sid, new Set());
      if (!neighbors.has(tid)) neighbors.set(tid, new Set());
      neighbors.get(sid).add(tid);
      neighbors.get(tid).add(sid);
    });

    // Highlight state
    let highlightedId = null;
    const settled = { value: false };
    simulation.on("end", () => { settled.value = true; });

    // Declared here, assigned after SVG elements are created
    let link, node, label;

    function highlightNode(id) {
      const neighborIds = neighbors.get(id) || new Set();
      const isConn = (nid) => nid === id || neighborIds.has(nid);

      const dur = settled.value ? 200 : 0;

      node.transition().duration(dur)
        .attr("opacity", (d) => isConn(d.id) ? 1 : 0.08);
      label.transition().duration(dur)
        .attr("opacity", (d) => isConn(d.id) ? 1 : 0.08);
      link.transition().duration(dur)
        .attr("stroke-opacity", (d) => {
          const sid = typeof d.source === "object" ? d.source.id : d.source;
          const tid = typeof d.target === "object" ? d.target.id : d.target;
          return (sid === id || tid === id) ? Math.min(opacityScale(d.weight) * 2.5, 1) : 0.02;
        });
    }

    function resetHighlight() {
      const dur = settled.value ? 200 : 0;
      node.transition().duration(dur).attr("opacity", 1);
      label.transition().duration(dur).attr("opacity", 1);
      link.transition().duration(dur)
        .attr("stroke-opacity", (d) => opacityScale(d.weight));
    }

    // Edges
    const maxWeight = Math.max(...links.map((e) => e.weight));
    link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#555")
      .attr("stroke-width", (d) => (Math.log(d.weight + 1) / Math.log(maxWeight + 1)) * 6 + 0.8)
      .attr("stroke-opacity", (d) => opacityScale(d.weight));

    // Drag behaviour
    const drag = d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        settled.value = false;
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Nodes
    node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => (d.type === "country" ? 12 : radiusScale(d.emailCount || 1)))
      .attr("fill", (d) => (d.type === "person" ? "#2e2e2e" : "#c8860a"))
      .attr("stroke", (d) => (d.type === "person" ? "#777" : "#e8a020"))
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (highlightedId === d.id) {
          // Second click on same node: navigate
          highlightedId = null;
          resetHighlight();
          if (d.type === "person" && d.slug) {
            routerRef.current.push(`/people/${d.slug}`);
          } else if (d.type === "country") {
            routerRef.current.push(`/?country=${encodeURIComponent(d.label)}`);
          }
        } else {
          // First click: highlight connections
          highlightedId = d.id;
          highlightNode(d.id);
        }
      })
      .call(drag);

    // Background click: reset highlight
    svg.on("click", () => {
      if (highlightedId) {
        highlightedId = null;
        resetHighlight();
      }
    });

    // Labels
    label = g
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", (d) => {
        if (d.type === "country") return "9px";
        const r = radiusScale(d.emailCount || 1);
        return r > 12 ? "11px" : "9px";
      })
      .attr("font-family", "SF Mono, Fira Code, monospace")
      .attr("fill", (d) => (d.type === "person" ? "#c8c8c8" : "#e8a020"))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => {
        if (d.type === "country") return 26;
        return radiusScale(d.emailCount || 1) + 12;
      })
      .attr("pointer-events", "none");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    return () => simulation.stop();
  }, [d3Ready, graphData, exploreMode]);

  return (
    <>
      <Head>
        <title>Network Graph — Epstein Africa</title>
        <meta name="description" content="Interactive network graph of persons and countries in Epstein's Africa-related correspondence." />
        <link rel="canonical" href={getCanonicalUrl("/graph", locale)} />
        <meta property="og:title" content="Network Graph — Epstein Africa" />
        <meta property="og:description" content="Interactive network graph of persons and countries in Epstein's Africa-related correspondence." />
        <meta property="og:url" content={getCanonicalUrl("/graph", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent("Network Graph")}&subtitle=${encodeURIComponent("Persons and countries in the email archive")}`} />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/graph", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/graph", "en")} />
        )}
      </Head>

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"
        strategy="afterInteractive"
        onLoad={() => setD3Ready(true)}
      />

      <div className="graph-page">
        <div className="graph-nav">
          <Nav pagePath="/graph" frAvailable={frAvailable} />
        </div>

        {!graphData && (
          <p className="loading-msg" style={{ padding: "1rem" }}>Loading…</p>
        )}

        <div className="graph-container" ref={containerRef}>
          <svg ref={svgRef} className="graph-svg" />

          <div className="graph-legend">
            <div className="legend-item">
              <svg width="16" height="16">
                <circle cx="8" cy="8" r="6" fill="#2e2e2e" stroke="#777" strokeWidth="1.5" />
              </svg>
              <span>Person (click → profile)</span>
            </div>
            <div className="legend-item">
              <svg width="16" height="16">
                <circle cx="8" cy="8" r="7" fill="#c8860a" stroke="#e8a020" strokeWidth="1.5" />
              </svg>
              <span>Country (click → filter emails)</span>
            </div>
            <div className="legend-item legend-hint">
              Scroll to zoom · Drag nodes · Click to highlight · Click again to visit
            </div>
            <button
              className="graph-mode-toggle"
              onClick={() => setExploreMode((prev) => !prev)}
            >
              {exploreMode ? "Show profiles only" : "Explore all connections"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
