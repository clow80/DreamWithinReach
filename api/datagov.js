/**
 * api/datagov.js - Singapore Data.gov.sg Official HDB Resale API Handler
 * 
 * Dataset Resource ID: d_8b84c4ee58e3cfc0ece0d773c8ca6abc (HDB Resale Prices, Jan 2017 onwards)
 * Official endpoints:
 * 1. Data Query: https://data.gov.sg/api/action/datastore_search?resource_id=d_8b84c4ee58e3cfc0ece0d773c8ca6abc
 * 2. Metadata: https://api-production.data.gov.sg/v2/public/api/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/metadata
 */

export const DATASET_RESOURCE_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const DATASTORE_API_URL = "https://data.gov.sg/api/action/datastore_search";
const METADATA_API_URL = `https://api-production.data.gov.sg/v2/public/api/datasets/${DATASET_RESOURCE_ID}/metadata`;

/**
 * Handles fetching live resale transaction records from data.gov.sg
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export async function handleResaleSearch(req, res) {
  try {
    const resource_id = req.query.resource_id || DATASET_RESOURCE_ID;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = parseInt(req.query.offset, 10) || 0;
    const q = req.query.q ? String(req.query.q) : undefined;
    const sort = req.query.sort ? String(req.query.sort) : undefined;

    // Handle filters: can be passed as raw query params (town, flat_type) or as JSON string / object
    let filters = {};
    if (req.query.filters) {
      if (typeof req.query.filters === "string") {
        try {
          filters = JSON.parse(req.query.filters);
        } catch (e) {
          // Fallback if already decoded or partial
          console.warn("Could not parse filters JSON:", req.query.filters);
        }
      } else if (typeof req.query.filters === "object") {
        filters = req.query.filters;
      }
    }

    // Direct param shorthand overrides: ?town=TAMPINES&flat_type=4 ROOM
    if (req.query.town && req.query.town !== "ALL") {
      filters.town = String(req.query.town).toUpperCase();
    }
    if (req.query.flat_type && req.query.flat_type !== "ALL") {
      filters.flat_type = String(req.query.flat_type).toUpperCase();
    }

    const urlParams = new URLSearchParams();
    urlParams.set("resource_id", resource_id);
    urlParams.set("limit", String(limit));
    if (offset > 0) urlParams.set("offset", String(offset));
    if (q) urlParams.set("q", q);
    if (sort) urlParams.set("sort", sort);
    if (Object.keys(filters).length > 0) {
      urlParams.set("filters", JSON.stringify(filters));
    }

    const targetUrl = `${DATASTORE_API_URL}?${urlParams.toString()}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "HDB-Explorer-Singapore/1.0"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Data.gov.sg API returned status ${response.status}`,
        details: errorText,
        sourceUrl: targetUrl
      });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      source: "data.gov.sg",
      resource_id,
      requestUrl: targetUrl,
      result: data.result || data
    });
  } catch (error) {
    console.error("Error in data.gov.sg resale proxy:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error fetching data.gov.sg API",
      message: error.message
    });
  }
}

/**
 * Handles fetching dataset metadata from data.gov.sg
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export async function handleDatasetMetadata(req, res) {
  try {
    const datasetId = req.query.dataset_id || DATASET_RESOURCE_ID;
    const targetUrl = `https://api-production.data.gov.sg/v2/public/api/datasets/${datasetId}/metadata`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "HDB-Explorer-Singapore/1.0"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Data.gov.sg Metadata API returned status ${response.status}`,
        details: errorText,
        sourceUrl: targetUrl
      });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      source: "api-production.data.gov.sg",
      datasetId,
      requestUrl: targetUrl,
      data: data.data || data
    });
  } catch (error) {
    console.error("Error in data.gov.sg metadata proxy:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error fetching dataset metadata",
      message: error.message
    });
  }
}
