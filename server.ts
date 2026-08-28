import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import searchHandler from "./api/search.js";
import chatHandler from "./api/chat.js";
import { handleResaleSearch, handleDatasetMetadata } from "./api/datagov.js";
import { API_SPEC } from "./api/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for API routes
app.use("/api", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// API Schema / OpenAPI Definition Route
app.get("/api", (req, res) => {
  res.status(200).json(API_SPEC);
});

app.get("/api/spec", (req, res) => {
  res.status(200).json(API_SPEC);
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Serverless API route matching Vercel /api/search.js handler format
app.get("/api/search", async (req, res) => {
  try {
    await searchHandler(req, res);
  } catch (err: any) {
    console.error("API error in /api/search:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    await searchHandler(req, res);
  } catch (err: any) {
    console.error("API error in /api/search:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

// Gemini AI Buyer Advisor route
app.post("/api/chat", async (req, res) => {
  try {
    await chatHandler(req, res);
  } catch (err: any) {
    console.error("API error in /api/chat:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

// Official Data.gov.sg Resale API Route
app.get("/api/datagov/resale", async (req, res) => {
  await handleResaleSearch(req, res);
});

// Direct mirror of Data.gov.sg datastore_search endpoint
app.get("/api/action/datastore_search", async (req, res) => {
  await handleResaleSearch(req, res);
});
app.get("/api/datastore_search", async (req, res) => {
  await handleResaleSearch(req, res);
});

// Official Data.gov.sg Metadata API Route
app.get("/api/datagov/metadata", async (req, res) => {
  await handleDatasetMetadata(req, res);
});
app.get("/api/datasets/:dataset_id/metadata", async (req, res) => {
  req.query.dataset_id = req.params.dataset_id;
  await handleDatasetMetadata(req, res);
});

// Serve static assets (index.html, styles.css, app.js)
app.use(express.static(__dirname));

// Fallback to index.html for SPA behavior
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HDB Explorer server running at http://0.0.0.0:${PORT}`);
});
