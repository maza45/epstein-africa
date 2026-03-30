import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import Nav from "../components/Nav";
import { buildGraphData } from "../lib/graph";

const BASE = "https://www.epsteinafrica.com";

export async function getStaticProps() {
  const data = buildGraphData();
  return { props: { precomputedGraph: data } };
}

export default function GraphPage({ precomputedGraph }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const router = useRouter();

  const [d3Ready, setD3Ready] = useState(
    typeof window !== "undefined" && !!window.d3
  );
  const [graphData] = useState(precomputedGraph);
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
    const nodes = graphData.nodes.map((d) => ({ ...d }));
    const links = graphData.edges.map((d) => ({ ...d }));

    // Edge opacity scale
    const weights = links.map((l) => l.weight);
    const maxW = Math.max(...weights, 1);
    const minW = Math.min(...weights, 0);
    const opacityScale = d3.scaleLinear().domain([minW, maxW]).range([0.08, 0.65]).clamp(true);

    // Zoom container
    const g = svg.append("g");

    svg.call(
      d3.zoom()
        .scaleExtent([0.15, 5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

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
      .force("charge", d3.forceManyBody().strength(-600).distanceMax(600))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collide", d3.forceCollide((d) => (d.type === "person" ? 32 : 42)))
      .alphaDecay(0.015);

    simulationRef.current = simulation;

    // Edges
    const maxWeight = Math.max(...links.map((e) => e.weight));
    const link = g
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
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => (d.type === "person" ? 8 : 12))
      .attr("fill", (d) => (d.type === "person" ? "#2e2e2e" : "#c8860a"))
      .attr("stroke", (d) => (d.type === "person" ? "#777" : "#e8a020"))
      .attr("stroke-width", 1.5)
      .attr("cursor", (d) => {
        if (d.type === "person" && d.slug) return "pointer";
        if (d.type === "country") return "pointer";
        return "default";
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.type === "person" && d.slug) {
          routerRef.current.push(`/people/${d.slug}`);
        } else if (d.type === "country") {
          routerRef.current.push(`/?country=${encodeURIComponent(d.label)}`);
        }
      })
      .call(drag);

    // Hover highlight
    node
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .attr("stroke", d.type === "person" ? "#ccc" : "#ffe066")
          .attr("stroke-width", 2.5);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this)
          .attr("stroke", d.type === "person" ? "#777" : "#e8a020")
          .attr("stroke-width", 1.5);
      });

    // Labels
    const label = g
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", (d) => (d.type === "person" ? "10px" : "9px"))
      .attr("font-family", "SF Mono, Fira Code, monospace")
      .attr("fill", (d) => (d.type === "person" ? "#c8c8c8" : "#e8a020"))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.type === "person" ? 20 : 26))
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
  }, [d3Ready, graphData]);

  return (
    <>
      <Head>
        <title>Network Graph — Epstein Africa</title>
        <meta name="description" content="Interactive network graph of persons and countries in Epstein's Africa-related correspondence." />
        <link rel="canonical" href={`${BASE}/graph`} />
        <meta property="og:title" content="Network Graph — Epstein Africa" />
        <meta property="og:description" content="Interactive network graph of persons and countries in Epstein's Africa-related correspondence." />
        <meta property="og:url" content={`${BASE}/graph`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent("Network Graph")}&subtitle=${encodeURIComponent("Persons and countries in the email archive")}`} />
      </Head>

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"
        strategy="afterInteractive"
        onLoad={() => setD3Ready(true)}
      />

      <div className="graph-page">
        <div className="graph-nav">
          <Nav />
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
              Scroll to zoom · Drag nodes · Click to navigate
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
