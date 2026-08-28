/**
 * api/index.js - HDB Explorer API Schema Specification Endpoint
 */
export const API_SPEC = {
  name: "HDB Explorer API",
  description: "Fetches HDB flats based on budget, property size, and area.",
  base_url: "https://dream-within-reach.vercel.app/api",
  endpoints: [
    {
      path: "/search",
      method: "GET",
      parameters: [
        {
          name: "budget",
          in: "query",
          required: true,
          type: "number",
          description: "Maximum budget for the flat"
        },
        {
          name: "size",
          in: "query",
          required: true,
          type: "number",
          description: "Floor area in square meters"
        },
        {
          name: "area",
          in: "query",
          required: true,
          type: "string",
          description: "Town or region of the flat"
        }
      ],
      response: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                town: { type: "string" },
                flat_type: { type: "string" },
                floor_area_sqm: { type: "number" },
                remaining_lease: { type: "string" },
                price: { type: "number" }
              }
            }
          }
        }
      }
    },
    {
      path: "/health",
      method: "GET",
      parameters: [],
      response: {
        type: "object",
        properties: {
          status: { type: "string" }
        }
      }
    }
  ]
};

export default function apiHandler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  return res.status(200).json(API_SPEC);
}
