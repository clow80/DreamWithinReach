/**
 * api/health.js - HDB Explorer Health Check Endpoint
 */
export default function healthHandler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  return res.status(200).json({ status: "ok" });
}
