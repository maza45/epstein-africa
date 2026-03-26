import { buildGraphData } from "../../lib/graph";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = buildGraphData();
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json(data);
}
