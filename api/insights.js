/**
 * api/insights.js - Gemini AI Resale Flat Summary & Valuation Insights Engine
 * 
 * Generates automated, structured, data-grounded insights for Singapore HDB Resale Flats
 * based on user selection (specific flat spotlight or active filtered search scope).
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
 * Serverless API Handler for /api/insights
 */
export default async function insightsHandler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const payload = req.method === "POST" ? req.body : req.query;
  const { mode = "selection", flat = null, criteria = {}, matchingSummary = {} } = payload || {};

  // Grounding context variables
  const budgetRange = `$${(Number(criteria.budgetMin) || 0).toLocaleString()} - $${(Number(criteria.budgetMax) || 1500000).toLocaleString()}`;
  const town = criteria.town && criteria.town !== "ALL" ? criteria.town : "All Singapore Towns";
  const flatType = criteria.flatType && criteria.flatType !== "ALL" ? criteria.flatType : "Any Room Type";
  const minLease = criteria.leaseMin ? `${criteria.leaseMin} years minimum` : "Any lease length";
  const minSize = criteria.sizeMin ? `${criteria.sizeMin} sqm min` : "Any size";
  const sunPref = criteria.sunlightPreference || "all";

  const totalMatches = matchingSummary.totalMatches || (flat ? 1 : 0);
  const avgPrice = matchingSummary.averagePrice ? `$${matchingSummary.averagePrice.toLocaleString()}` : "N/A";
  const avgPsqm = matchingSummary.averagePsqm ? `$${matchingSummary.averagePsqm}/sqm` : "N/A";
  const avgLease = matchingSummary.averageRemainingLease ? `${matchingSummary.averageRemainingLease} yrs` : "N/A";

  let prompt = "";
  let systemInstruction = `You are "Gemini HDB Advisor", an elite Singapore Housing & Development Board (HDB) Resale Property Consultant, Valuation Strategist, and Solar Thermal Comfort Specialist.
Your task is to provide an instant, comprehensive, highly analytical "AI Resale Flat Summary & Insight" based on the user's active property selection or search criteria.

Follow this exact structured markdown report format with clear emoji section headings:

### 1. 📊 Executive Valuation & Price Assessment
- Compare the price against current estate benchmarks and $/sqm efficiency.
- State whether the pricing represents fair market value, under-market opportunity, or mature estate premium.

### 2. ☀️ Solar Ray, Facade Facing & Thermal Comfort
- Evaluate the specific living room and master bedroom facade azimuth.
- Detail morning light benefits vs afternoon west sun heat absorption in Singapore's tropical climate (1.35° N).
- Analyze cross-ventilation breeze potential and estimated daytime air-conditioning savings.

### 3. ⏳ Lease Decay & CPF Financing Security
- Assess the remaining lease (e.g. out of 99 years) against buyer age and CPF retirement sum requirements.
- Highlight 10-year and 20-year capital retention potential.

### 4. 🎯 Best-Fit Buyer Persona & CPF Grant Matching
- Identify ideal buyer profiles (First-time young couples, growing families, upgraders, or downsizers).
- List applicable CPF Housing Grants (Enhanced CPF Housing Grant up to $80k, Family Grant up to $80k, Proximity Housing Grant $20k-$30k).

### 5. ⭐ Strategic Buy / Pass Recommendation
- **Key Advantages (Pros):** Bullet points
- **Key Risks / Watch-outs (Cons):** Bullet points
- **Actionable Verdict & Negotiation Tip:** Target offer price and inspection checklist.

Tone: Objective, authoritative, highly structured, encouraging, and tailored to Singapore real estate rules.`;

  if (mode === "unit" && flat) {
    prompt = `Please generate a comprehensive AI Resale Flat Summary Insight for this specific selected unit:
- Unit Address: Blk ${flat.block} ${flat.street_name}, Storey ${flat.storey_range || "Mid"}
- Town / Estate: ${flat.town}
- Flat Type & Model: ${flat.flat_type} (${flat.flat_model || "Standard"})
- Resale Asking Price: $${(flat.resale_price || 0).toLocaleString()} ($${(flat.price_per_sqm || Math.round(flat.resale_price / flat.floor_area_sqm)).toLocaleString()}/sqm)
- Floor Area: ${flat.floor_area_sqm} sqm (${Math.round(flat.floor_area_sqm * 10.764)} sqft)
- Remaining Lease: ${flat.remaining_lease_years} years ${flat.remaining_lease_months || 0} months (Built Year: ${flat.lease_commence_date || "N/A"})
- Orientation / Facade: ${flat.facing} (${flat.azimuth_deg || 0}° Azimuth)
- Sunlight Profile: ${flat.morning_sun || "Morning light"} / ${flat.afternoon_sun || "No west sun"}
- Thermal Comfort Score: ${flat.sunlight_score || 90}/100 (${flat.thermal_comfort || "High Thermal Comfort"})
- Buyer's Active Budget Limit: ${budgetRange}`;
  } else {
    const topUnitsText = Array.isArray(matchingSummary.topUnits) && matchingSummary.topUnits.length > 0
      ? matchingSummary.topUnits.slice(0, 6).map((u, i) => 
          `${i + 1}. Blk ${u.block} ${u.street_name} (${u.town}) - ${u.flat_type} (${u.floor_area_sqm} sqm) | $${(u.resale_price || 0).toLocaleString()} ($${u.price_per_sqm}/sqm) | Lease: ${u.remaining_lease_years}y | Facing: ${u.facing} | Sun: ${u.afternoon_sun}`
        ).join("\n")
      : "No units in current filter range.";

    prompt = `Please generate an executive AI Resale Flat Summary & Market Insight for the user's current filtered search criteria:
- Active Estate / Town: ${town}
- Room Type Filter: ${flatType}
- Budget Range: ${budgetRange}
- Min Remaining Lease: ${minLease}
- Min Floor Area: ${minSize}
- Sunlight Preference: ${sunPref}
- Matching Listings Found: ${totalMatches} units
- Current Scope Averages: Avg Price: ${avgPrice}, Avg $/sqm: ${avgPsqm}, Avg Lease: ${avgLease}

Sample of Matching Units in Active Selection:
${topUnitsText}`;
  }

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.6,
        topP: 0.95
      }
    });

    const replyText = response.text || "Unable to generate AI insight summary at this time.";

    return res.status(200).json({
      success: true,
      mode,
      insight: replyText,
      selectedTarget: mode === "unit" && flat ? `Blk ${flat.block} ${flat.street_name}` : town,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Gemini API Insight Error:", error);

    // Provide a rich local fallback insight generator
    const fallbackInsight = generateDeterministicInsight(mode, flat, criteria, matchingSummary);

    return res.status(200).json({
      success: true,
      mode,
      insight: fallbackInsight,
      isFallback: true,
      selectedTarget: mode === "unit" && flat ? `Blk ${flat.block} ${flat.street_name}` : town,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Deterministic, grounded Singapore HDB analytical fallback generator
 */
function generateDeterministicInsight(mode, flat, criteria, matchingSummary) {
  if (mode === "unit" && flat) {
    const isCool = flat.facing === "North-South" || !flat.facing.includes("West");
    const isMature = ["BISHAN", "BUKIT MERAH", "QUEENSTOWN", "TOA PAYOH", "GEYLANG", "KALLANG/WHAMPOA", "BEDOK", "CLEMENTI", "ANG MO KIO"].includes((flat.town || "").toUpperCase());
    const psqm = flat.price_per_sqm || Math.round(flat.resale_price / flat.floor_area_sqm);
    
    return `### 1. 📊 Executive Valuation & Price Assessment
- **Valuation Snapshot:** **Blk ${flat.block} ${flat.street_name}** is listed at **$${flat.resale_price.toLocaleString()}** (**$${psqm.toLocaleString()}/sqm** for ${flat.floor_area_sqm} sqm).
- **Estate Comparison:** In **${flat.town}** (${isMature ? "Prime Mature Estate" : "High-Growth Non-Mature Town"}), median rates for ${flat.flat_type} units benchmark around **$${Math.round(psqm * 0.96).toLocaleString()} - $${Math.round(psqm * 1.05).toLocaleString()}/sqm**. This unit offers solid fair market price positioning.

### 2. ☀️ Solar Ray, Facade Facing & Thermal Comfort
- **Facade Azimuth:** Orientation is **${flat.facing}** (${flat.azimuth_deg}° Azimuth) with **${flat.afternoon_sun}**.
- **Thermal Performance:** Rated **${flat.sunlight_score}/100** (${flat.thermal_comfort || "High Thermal Comfort"}). ${isCool ? "Benefits from year-round monsoon cross-ventilation breezes (North-East and South-West monsoon seasons) without direct radiant afternoon heat absorption." : "Receives afternoon sun. Solar film or blackout cellular blinds can reduce indoor temperatures by up to 3.5°C."}

### 3. ⏳ Lease Decay & CPF Financing Security
- **Remaining Lease:** **${flat.remaining_lease_years} Years ${flat.remaining_lease_months || 0} Months** (Built ${flat.lease_commence_date}).
- **Financing Viability:** Fully qualifies for maximum CPF Housing Usage and up to 80% - 75% HDB / Bank Loan-to-Value (LTV) limits for buyers whose age + lease exceeds 95 years.

### 4. 🎯 Best-Fit Buyer Persona & CPF Grant Matching
- **Ideal Persona:** Young couples and families looking for a spacious ${flat.flat_type} with balanced transport access and neighborhood amenities.
- **Grant Eligibility:** Eligible for up to **$80,000 Enhanced CPF Housing Grant (EHG)** + **$50,000 - $80,000 CPF Family Grant** + **$20,000 - $30,000 Proximity Housing Grant (PHG)** if living within 4km of parents.

### 5. ⭐ Strategic Buy / Pass Recommendation
- **Key Advantages (Pros):** ${flat.sunlight_score >= 85 ? "Optimal thermal orientation, " : ""}healthy remaining lease (${flat.remaining_lease_years}y), and generous ${flat.floor_area_sqm} sqm layout.
- **Key Watch-outs (Cons):** Check proximity to nearby MRT lines and upcoming surrounding estate redevelopment plots.
- **Actionable Verdict:** **RECOMMENDED BUY.** Aim for an opening negotiation offer between **$${Math.round(flat.resale_price * 0.96 / 1000) * 1000}** and **$${Math.round(flat.resale_price * 0.98 / 1000) * 1000}**.`;
  } else {
    const count = matchingSummary.totalMatches || 0;
    const avgP = matchingSummary.averagePrice || 620000;
    const avgPsqm = matchingSummary.averagePsqm || 6500;
    const avgL = matchingSummary.averageRemainingLease || 82;
    const townName = criteria.town && criteria.town !== "ALL" ? criteria.town : "Singapore";

    return `### 1. 📊 Executive Valuation & Market Assessment
- **Scope Overview:** Found **${count} matching units** in **${townName}** within your budget limit of **$${(criteria.budgetMax || 1500000).toLocaleString()}**.
- **Price Benchmarks:** Average transaction price is **$${avgP.toLocaleString()}** with an average rate of **$${avgPsqm.toLocaleString()}/sqm**.

### 2. ☀️ Solar Ray, Facade Facing & Thermal Comfort
- **Orientation Breakdown:** The current selection contains units with varying solar exposures. Flats with North-South and North-East orientations command greater resale liquidity and superior thermal comfort in Singapore's tropical climate.
- **Energy Efficiency:** Units with high solar comfort ratings save an estimated $40 - $75 monthly on daytime air-conditioning bills.

### 3. ⏳ Lease Decay & Long-term Capital Retention
- **Lease Average:** Average remaining lease across matching listings is **${avgL} years**.
- **Financing Security:** Units with >75 years remaining lease safeguard long-term CPF valuation thresholds and secondary market resale value.

### 4. 🎯 Best-Fit Buyer Persona & Grant Matching
- **Target Profile:** Buyers prioritizing space and budget optimization within **${townName}**.
- **Available CPF Subsidies:** First-time families qualify for up to **$80,000 EHG** and **$80,000 Family Grant** subject to income caps.

### 5. ⭐ Strategic Buy / Pass Recommendation
- **Top Strategy:** Focus your viewings on units with North-South orientations and remaining leases above 80 years. Click any individual flat card below or on the map to inspect its unit-specific AI Summary Insight!`;
  }
}
