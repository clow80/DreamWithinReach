/**
 * api/health.js - HDB Explorer Health Check Endpoint
 */
export default function healthHandler(req, res) {
  return res.status(200).json({ status: "ok" });
}
