/**
 * api/chat.js - Gemini AI Property Advisor for HDB Home Buyers
 * 
 * Provides automated AI Resale Flat Summary & Valuation Insights grounded in the buyer's
 * real-time search criteria, matching listings dataset, financial constraints, and solar orientation.
 */

import insightsHandler from "./insights.js";

/**
 * Serverless API Handler for /api/chat
 */
export default async function chatHandler(req, res) {
  return insightsHandler(req, res);
}
