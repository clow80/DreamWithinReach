/**
 * api/chat.js - Gemini AI Property Advisor for HDB Home Buyers
 * 
 * Provides expert conversational advisory grounded in the buyer's real-time
 * search criteria, matching listings dataset, financial constraints, and solar orientation.
 */

import { GoogleGenAI } from "@google/genai";

let aiClient = null;

function getGenAI() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

/**
 * Serverless API Handler for /api/chat
 */
export default async function chatHandler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { message, history = [], criteria = {}, matchingSummary = {} } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  // Format criteria and context for prompt grounding
  const budgetRange = `$${(Number(criteria.budgetMin) || 0).toLocaleString()} - $${(Number(criteria.budgetMax) || 1500000).toLocaleString()}`;
  const town = criteria.town && criteria.town !== "ALL" ? criteria.town : "All Singapore Towns";
  const flatType = criteria.flatType && criteria.flatType !== "ALL" ? criteria.flatType : "Any Room Type";
  const minLease = criteria.leaseMin ? `${criteria.leaseMin} years minimum` : "Any lease length";
  const minSize = criteria.sizeMin ? `${criteria.sizeMin} sqm min` : "Any size";
  const sunPref = criteria.sunlightPreference || "all";

  const totalMatches = matchingSummary.totalMatches || 0;
  const avgPrice = matchingSummary.averagePrice ? `$${matchingSummary.averagePrice.toLocaleString()}` : "N/A";
  const avgPsqm = matchingSummary.averagePsqm ? `$${matchingSummary.averagePsqm}/sqm` : "N/A";
  const avgLease = matchingSummary.averageRemainingLease ? `${matchingSummary.averageRemainingLease} yrs` : "N/A";

  const topUnitsText = Array.isArray(matchingSummary.topUnits) && matchingSummary.topUnits.length > 0
    ? matchingSummary.topUnits.map((u, idx) => 
        `${idx + 1}. [${u.id || "Unit"}] ${u.block} ${u.street_name} (${u.town}) - ${u.flat_type} (${u.floor_area_sqm} sqm), Price: $${(u.resale_price || 0).toLocaleString()} ($${u.price_per_sqm || Math.round(u.resale_price/u.floor_area_sqm)}/sqm), Lease: ${u.remaining_lease_years}y, Facing: ${u.facing}, Sun: ${u.morning_sun} / ${u.afternoon_sun}, Thermal Comfort: ${u.thermal_comfort || "Good"}`
      ).join("\n")
    : "No units currently match these strict filters. Provide general guidance or recommend relaxing specific criteria.";

  const systemInstruction = `You are "Gemini HDB Advisor", an elite Singapore Housing & Development Board (HDB) Resale Property Consultant, Valuation Strategist, and Solar Thermal Comfort Specialist.

Your goal is to give home buyers clear, highly actionable, personalized advice on the best HDB flat to buy based on their real-time input criteria, budget, family stage, and financial goals.

CURRENT HOME BUYER'S ACTIVE SEARCH CRITERIA:
- Budget Range: ${budgetRange}
- Preferred Town: ${town}
- Flat Type: ${flatType}
- Minimum Remaining Lease: ${minLease}
- Minimum Floor Area: ${minSize}
- Sunlight & Orientation Preference: ${sunPref}
- Matching Flats in Database: ${totalMatches} units
- Market Snapshot for Active Query: Avg Price: ${avgPrice}, Avg Rate: ${avgPsqm}, Avg Remaining Lease: ${avgLease}

AVAILABLE MATCHING UNITS IN CURRENT DATASET:
${topUnitsText}

GUIDELINES FOR YOUR ADVICE:
1. **Directly Answer the Buyer's Question**: Ground your response in the user's specific query and their active criteria.
2. **Specific Unit Recommendations**: When recommending best buys, quote specific units from the provided dataset (mention Block, Street, Town, Price, $/sqm, and Lease).
3. **Sunlight & Thermal Comfort Impact**: Highlight why unit orientation matters in tropical Singapore (e.g. North-South facing for year-round cross-breeze and no direct sun heat; East facing for gentle morning light; avoiding unshielded West-facing afternoon sun heat traps that spike air-con electric bills).
4. **Lease Decay vs Space vs Location Trade-offs**:
   - Mature Estates (e.g., Bishan, Queenstown, Toa Payoh): High convenience and price retention, but older leases (50-70y) or premium million-dollar tags.
   - Non-Mature / Growth Estates (e.g., Punggol, Sengkang, Woodlands, Sembawang): Fresh 85-94 year leases, modern layouts, higher value-for-money $/sqm.
5. **Singapore CPF Housing Grant Awareness**: Mention relevant grants when budget optimization is discussed (e.g., Enhanced CPF Housing Grant up to $80k, Family Grant up to $80k, Proximity Housing Grant up to $30k for buying within 4km of parents).
6. **Formatting**: Use clean Markdown with bold headings, scannable bullet points, comparison tables when relevant, and an actionable "⭐ Advisor's Recommendation" summary box. Keep tone enthusiastic, analytical, warm, and highly professional.`;

  try {
    const ai = getGenAI();

    // Build the conversation contents
    const contents = [];

    // Add prior conversation history
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item && item.text) {
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text }]
          });
        }
      }
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.95
      }
    });

    const replyText = response.text || "I was unable to generate advice at this moment. Please check your criteria and try again.";

    return res.status(200).json({
      success: true,
      reply: replyText,
      groundedCriteria: {
        budgetRange,
        town,
        flatType,
        totalMatches
      }
    });
  } catch (error) {
    console.error("Gemini API Chat Error:", error);
    
    // Fallback if API key is not configured or rate limited
    return res.status(500).json({
      error: "Failed to generate AI advice.",
      message: error.message || "An unexpected error occurred while communicating with Gemini."
    });
  }
}
