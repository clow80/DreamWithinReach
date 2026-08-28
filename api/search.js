/**
 * api/search.js - HDB Explorer Search & Analytics Serverless Function
 * 
 * Target Environment: Vercel Serverless Function & Express API Endpoint.
 * Purpose: Server-side validation, filtering of HDB resale dataset,
 *          calculation of sunlight ray parameters, price trends,
 *          town distribution, and "What does my budget buy?" lease-area matrix.
 */

// Master dataset of realistic Singapore HDB resale flats with authentic towns,
// geocoded coordinates, floor areas, lease commencement, and solar orientation data.
const HDB_DATASET = [
  // PUNGGOL
  {
    id: "HDB-PG-001",
    month: "2026-05",
    town: "PUNGGOL",
    flat_type: "4 ROOM",
    block: "271C",
    street_name: "PUNGGOL WALK",
    storey_range: "10 TO 12",
    floor_area_sqm: 93,
    flat_model: "Model A",
    lease_commence_date: 2017,
    remaining_lease_years: 90,
    remaining_lease_months: 2,
    resale_price: 645000,
    lat: 1.4042,
    lng: 103.9022,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "North-East",
    morning_sun: "Gentle Morning Light (2h)",
    afternoon_sun: "No Direct West Sun",
    sunlight_score: 95,
    thermal_comfort: "High (Cool & Breezy)",
    azimuth_deg: 0
  },
  {
    id: "HDB-PG-002",
    month: "2026-06",
    town: "PUNGGOL",
    flat_type: "5 ROOM",
    block: "312B",
    street_name: "SUMANG LINK",
    storey_range: "13 TO 15",
    floor_area_sqm: 112,
    flat_model: "Improved",
    lease_commence_date: 2018,
    remaining_lease_years: 91,
    remaining_lease_months: 5,
    resale_price: 788000,
    lat: 1.4085,
    lng: 103.8998,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "East",
    morning_sun: "Direct Morning Sun (3.5h)",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 92,
    thermal_comfort: "Very Good (Morning Warmth, Cool Evenings)",
    azimuth_deg: 45
  },
  {
    id: "HDB-PG-003",
    month: "2026-07",
    town: "PUNGGOL",
    flat_type: "3 ROOM",
    block: "173A",
    street_name: "PUNGGOL FIELD",
    storey_range: "04 TO 06",
    floor_area_sqm: 68,
    flat_model: "Premium Apartment",
    lease_commence_date: 2004,
    remaining_lease_years: 77,
    remaining_lease_months: 1,
    resale_price: 468000,
    lat: 1.3965,
    lng: 103.9142,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "South",
    morning_sun: "Mild Morning Rays (2h)",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 88,
    thermal_comfort: "Good (Natural Daylight)",
    azimuth_deg: 135
  },
  {
    id: "HDB-PG-004",
    month: "2026-08",
    town: "PUNGGOL",
    flat_type: "4 ROOM",
    block: "601A",
    street_name: "PUNGGOL CENTRAL",
    storey_range: "16 TO 18",
    floor_area_sqm: 92,
    flat_model: "Model A",
    lease_commence_date: 2012,
    remaining_lease_years: 85,
    remaining_lease_months: 8,
    resale_price: 615000,
    lat: 1.4011,
    lng: 103.9078,
    facing: "West",
    living_room_facing: "West",
    bedrooms_facing: "South-West",
    morning_sun: "None",
    afternoon_sun: "Direct Afternoon Sun (3-5 PM)",
    sunlight_score: 62,
    thermal_comfort: "Requires Blinds/UV Tint",
    azimuth_deg: 270
  },

  // TAMPINES
  {
    id: "HDB-TM-001",
    month: "2026-05",
    town: "TAMPINES",
    flat_type: "4 ROOM",
    block: "857B",
    street_name: "TAMPINES ST 83",
    storey_range: "07 TO 09",
    floor_area_sqm: 104,
    flat_model: "Model A",
    lease_commence_date: 1988,
    remaining_lease_years: 61,
    remaining_lease_months: 3,
    resale_price: 540000,
    lat: 1.3532,
    lng: 103.9355,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Indirect Diffused Light",
    afternoon_sun: "No Direct Sun",
    sunlight_score: 96,
    thermal_comfort: "High (Optimal Breeze)",
    azimuth_deg: 180
  },
  {
    id: "HDB-TM-002",
    month: "2026-06",
    town: "TAMPINES",
    flat_type: "5 ROOM",
    block: "491C",
    street_name: "TAMPINES AVE 9",
    storey_range: "10 TO 12",
    floor_area_sqm: 115,
    flat_model: "Improved",
    lease_commence_date: 1999,
    remaining_lease_years: 72,
    remaining_lease_months: 6,
    resale_price: 698000,
    lat: 1.3615,
    lng: 103.9482,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Bright Sunrise Glow (3h)",
    afternoon_sun: "Sheltered in Afternoon",
    sunlight_score: 90,
    thermal_comfort: "Excellent (Bright & Fresh)",
    azimuth_deg: 90
  },
  {
    id: "HDB-TM-003",
    month: "2026-07",
    town: "TAMPINES",
    flat_type: "EXECUTIVE",
    block: "156",
    street_name: "TAMPINES ST 12",
    storey_range: "04 TO 06",
    floor_area_sqm: 146,
    flat_model: "Maisonette",
    lease_commence_date: 1985,
    remaining_lease_years: 58,
    remaining_lease_months: 10,
    resale_price: 880000,
    lat: 1.3498,
    lng: 103.9441,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Balanced Ambient Light",
    afternoon_sun: "Zero Direct Heat",
    sunlight_score: 94,
    thermal_comfort: "Very Good (Cross Ventilation)",
    azimuth_deg: 0
  },
  {
    id: "HDB-TM-004",
    month: "2026-08",
    town: "TAMPINES",
    flat_type: "3 ROOM",
    block: "218",
    street_name: "TAMPINES ST 21",
    storey_range: "07 TO 09",
    floor_area_sqm: 73,
    flat_model: "New Generation",
    lease_commence_date: 1984,
    remaining_lease_years: 57,
    remaining_lease_months: 4,
    resale_price: 410000,
    lat: 1.3541,
    lng: 103.9515,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "North",
    morning_sun: "Gentle Morning Rays (2h)",
    afternoon_sun: "No Afternoon Glare",
    sunlight_score: 87,
    thermal_comfort: "Good (Cool Ambient)",
    azimuth_deg: 45
  },

  // BISHAN
  {
    id: "HDB-BS-001",
    month: "2026-05",
    town: "BISHAN",
    flat_type: "4 ROOM",
    block: "510",
    street_name: "BISHAN ST 13",
    storey_range: "19 TO 21",
    floor_area_sqm: 103,
    flat_model: "Simplified",
    lease_commence_date: 1987,
    remaining_lease_years: 60,
    remaining_lease_months: 2,
    resale_price: 830000,
    lat: 1.3501,
    lng: 103.8505,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Soft Ambient Rays",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 97,
    thermal_comfort: "Optimal (Unblocked Windflow)",
    azimuth_deg: 180
  },
  {
    id: "HDB-BS-002",
    month: "2026-06",
    town: "BISHAN",
    flat_type: "5 ROOM",
    block: "273A",
    street_name: "BISHAN ST 24",
    storey_range: "22 TO 24",
    floor_area_sqm: 120,
    flat_model: "DBSS (Natura Loft)",
    lease_commence_date: 2012,
    remaining_lease_years: 85,
    remaining_lease_months: 9,
    resale_price: 1280000,
    lat: 1.3582,
    lng: 103.8441,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Pleasant Morning Sunlight (2.5h)",
    afternoon_sun: "Completely Protected",
    sunlight_score: 94,
    thermal_comfort: "High (Panoramic Unblocked)",
    azimuth_deg: 135
  },
  {
    id: "HDB-BS-003",
    month: "2026-07",
    town: "BISHAN",
    flat_type: "3 ROOM",
    block: "112",
    street_name: "BISHAN ST 12",
    storey_range: "07 TO 09",
    floor_area_sqm: 68,
    flat_model: "Simplified",
    lease_commence_date: 1986,
    remaining_lease_years: 59,
    remaining_lease_months: 0,
    resale_price: 490000,
    lat: 1.3475,
    lng: 103.8522,
    facing: "North-West",
    living_room_facing: "North-West",
    bedrooms_facing: "West",
    morning_sun: "Minimal",
    afternoon_sun: "Partial Afternoon Angle (2h)",
    sunlight_score: 71,
    thermal_comfort: "Moderate (Curtains Recommended)",
    azimuth_deg: 315
  },

  // QUEENSTOWN
  {
    id: "HDB-QT-001",
    month: "2026-05",
    town: "QUEENSTOWN",
    flat_type: "4 ROOM",
    block: "89",
    street_name: "STRATHMORE AVE",
    storey_range: "28 TO 30",
    floor_area_sqm: 96,
    flat_model: "Model A",
    lease_commence_date: 2001,
    remaining_lease_years: 74,
    remaining_lease_months: 11,
    resale_price: 940000,
    lat: 1.2942,
    lng: 103.8088,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Filtered Daylight",
    afternoon_sun: "Zero Direct West Glare",
    sunlight_score: 98,
    thermal_comfort: "Exceptional (Breezy High Floor)",
    azimuth_deg: 0
  },
  {
    id: "HDB-QT-002",
    month: "2026-06",
    town: "QUEENSTOWN",
    flat_type: "5 ROOM",
    block: "50",
    street_name: "COMMONWEALTH DR",
    storey_range: "34 TO 36",
    floor_area_sqm: 111,
    flat_model: "Premium Apartment",
    lease_commence_date: 2015,
    remaining_lease_years: 88,
    remaining_lease_months: 4,
    resale_price: 1190000,
    lat: 1.3021,
    lng: 103.8005,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Gentle Morning Warmth",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 93,
    thermal_comfort: "High (Panoramic City View)",
    azimuth_deg: 135
  },
  {
    id: "HDB-QT-003",
    month: "2026-07",
    town: "QUEENSTOWN",
    flat_type: "3 ROOM",
    block: "28",
    street_name: "DOVER CRES",
    storey_range: "13 TO 15",
    floor_area_sqm: 70,
    flat_model: "Model A",
    lease_commence_date: 2003,
    remaining_lease_years: 76,
    remaining_lease_months: 2,
    resale_price: 610000,
    lat: 1.3065,
    lng: 103.7842,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Morning Sunrise (3h)",
    afternoon_sun: "Cool in Afternoon",
    sunlight_score: 91,
    thermal_comfort: "Very Good (Bright & Breezy)",
    azimuth_deg: 90
  },

  // JURONG EAST & WEST
  {
    id: "HDB-JE-001",
    month: "2026-05",
    town: "JURONG EAST",
    flat_type: "4 ROOM",
    block: "288A",
    street_name: "JURONG EAST ST 21",
    storey_range: "13 TO 15",
    floor_area_sqm: 92,
    flat_model: "Model A",
    lease_commence_date: 2000,
    remaining_lease_years: 73,
    remaining_lease_months: 4,
    resale_price: 615000,
    lat: 1.3411,
    lng: 103.7432,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "North-East",
    morning_sun: "Mild Morning Diffuse Light",
    afternoon_sun: "Protected from Afternoon Sun",
    sunlight_score: 95,
    thermal_comfort: "High (Cool & Cross Ventilated)",
    azimuth_deg: 0
  },
  {
    id: "HDB-JW-001",
    month: "2026-06",
    town: "JURONG WEST",
    flat_type: "5 ROOM",
    block: "683A",
    street_name: "JURONG WEST CENTRAL 1",
    storey_range: "10 TO 12",
    floor_area_sqm: 110,
    flat_model: "Improved",
    lease_commence_date: 2002,
    remaining_lease_years: 75,
    remaining_lease_months: 7,
    resale_price: 668000,
    lat: 1.3435,
    lng: 103.7051,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Morning Sunlight (2.5h)",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 89,
    thermal_comfort: "Good (Natural Daylight)",
    azimuth_deg: 135
  },
  {
    id: "HDB-JW-002",
    month: "2026-07",
    town: "JURONG WEST",
    flat_type: "3 ROOM",
    block: "518",
    street_name: "JURONG WEST ST 52",
    storey_range: "04 TO 06",
    floor_area_sqm: 67,
    flat_model: "Simplified",
    lease_commence_date: 1985,
    remaining_lease_years: 58,
    remaining_lease_months: 2,
    resale_price: 365000,
    lat: 1.3492,
    lng: 103.7188,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Gentle Lighting",
    afternoon_sun: "No West Sun",
    sunlight_score: 92,
    thermal_comfort: "Good (Very Affordable)",
    azimuth_deg: 180
  },
  {
    id: "HDB-JW-003",
    month: "2026-08",
    town: "JURONG WEST",
    flat_type: "EXECUTIVE",
    block: "651A",
    street_name: "JURONG WEST ST 61",
    storey_range: "13 TO 15",
    floor_area_sqm: 142,
    flat_model: "Executive Apartment",
    lease_commence_date: 2001,
    remaining_lease_years: 74,
    remaining_lease_months: 8,
    resale_price: 760000,
    lat: 1.3385,
    lng: 103.6985,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "North",
    morning_sun: "Morning Rays (2h)",
    afternoon_sun: "Shielded in Afternoon",
    sunlight_score: 93,
    thermal_comfort: "Very Good (Spacious Layout)",
    azimuth_deg: 45
  },

  // SENGKANG
  {
    id: "HDB-SK-001",
    month: "2026-05",
    town: "SENGKANG",
    flat_type: "4 ROOM",
    block: "413B",
    street_name: "FERNVALE LINK",
    storey_range: "16 TO 18",
    floor_area_sqm: 93,
    flat_model: "Model A",
    lease_commence_date: 2015,
    remaining_lease_years: 88,
    remaining_lease_months: 3,
    resale_price: 610000,
    lat: 1.3912,
    lng: 103.8765,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Soft Daylight",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 96,
    thermal_comfort: "High (High Floor Cross Breeze)",
    azimuth_deg: 0
  },
  {
    id: "HDB-SK-002",
    month: "2026-06",
    town: "SENGKANG",
    flat_type: "5 ROOM",
    block: "338A",
    street_name: "ANCHORVALE CRES",
    storey_range: "10 TO 12",
    floor_area_sqm: 112,
    flat_model: "Premium Apartment",
    lease_commence_date: 2016,
    remaining_lease_years: 89,
    remaining_lease_months: 1,
    resale_price: 745000,
    lat: 1.3975,
    lng: 103.8885,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Bright Morning Light (3h)",
    afternoon_sun: "Zero Heat in Afternoon",
    sunlight_score: 91,
    thermal_comfort: "Very Good (River View Breeze)",
    azimuth_deg: 90
  },
  {
    id: "HDB-SK-003",
    month: "2026-07",
    town: "SENGKANG",
    flat_type: "3 ROOM",
    block: "207B",
    street_name: "COMPASSVALE LANE",
    storey_range: "07 TO 09",
    floor_area_sqm: 68,
    flat_model: "Model A",
    lease_commence_date: 2001,
    remaining_lease_years: 74,
    remaining_lease_months: 5,
    resale_price: 440000,
    lat: 1.3855,
    lng: 103.8962,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Morning Rays (2h)",
    afternoon_sun: "No Afternoon Glare",
    sunlight_score: 89,
    thermal_comfort: "Good (Cozy & Bright)",
    azimuth_deg: 135
  },

  // ANG MO KIO
  {
    id: "HDB-AMK-001",
    month: "2026-05",
    town: "ANG MO KIO",
    flat_type: "4 ROOM",
    block: "310B",
    street_name: "ANG MO KIO AVE 1",
    storey_range: "22 TO 24",
    floor_area_sqm: 95,
    flat_model: "Design, Build and Sell",
    lease_commence_date: 2011,
    remaining_lease_years: 84,
    remaining_lease_months: 6,
    resale_price: 868000,
    lat: 1.3648,
    lng: 103.8488,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Diffused Indirect Rays",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 97,
    thermal_comfort: "High (Park Connector Breeze)",
    azimuth_deg: 180
  },
  {
    id: "HDB-AMK-002",
    month: "2026-06",
    town: "ANG MO KIO",
    flat_type: "3 ROOM",
    block: "540",
    street_name: "ANG MO KIO AVE 10",
    storey_range: "04 TO 06",
    floor_area_sqm: 68,
    flat_model: "New Generation",
    lease_commence_date: 1980,
    remaining_lease_years: 53,
    remaining_lease_months: 2,
    resale_price: 395000,
    lat: 1.3732,
    lng: 103.8561,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "North",
    morning_sun: "Pleasant Morning Sun (2h)",
    afternoon_sun: "No West Sun",
    sunlight_score: 88,
    thermal_comfort: "Good (Established Amenities)",
    azimuth_deg: 45
  },
  {
    id: "HDB-AMK-003",
    month: "2026-07",
    town: "ANG MO KIO",
    flat_type: "5 ROOM",
    block: "700B",
    street_name: "ANG MO KIO AVE 6",
    storey_range: "16 TO 18",
    floor_area_sqm: 110,
    flat_model: "Improved",
    lease_commence_date: 2003,
    remaining_lease_years: 76,
    remaining_lease_months: 9,
    resale_price: 930000,
    lat: 1.3695,
    lng: 103.8465,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "South",
    morning_sun: "Gentle Morning Warmth",
    afternoon_sun: "Protected from West Sun",
    sunlight_score: 93,
    thermal_comfort: "High (Centrally Located)",
    azimuth_deg: 135
  },

  // BEDOK
  {
    id: "HDB-BD-001",
    month: "2026-05",
    town: "BEDOK",
    flat_type: "4 ROOM",
    block: "219A",
    street_name: "BEDOK CENTRAL",
    storey_range: "13 TO 15",
    floor_area_sqm: 94,
    flat_model: "Model A",
    lease_commence_date: 2010,
    remaining_lease_years: 83,
    remaining_lease_months: 4,
    resale_price: 790000,
    lat: 1.3245,
    lng: 103.9312,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Balanced Daylighting",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 95,
    thermal_comfort: "High (Sea Breeze Windflow)",
    azimuth_deg: 0
  },
  {
    id: "HDB-BD-002",
    month: "2026-06",
    town: "BEDOK",
    flat_type: "3 ROOM",
    block: "412",
    street_name: "BEDOK NORTH AVE 2",
    storey_range: "07 TO 09",
    floor_area_sqm: 67,
    flat_model: "New Generation",
    lease_commence_date: 1978,
    remaining_lease_years: 51,
    remaining_lease_months: 8,
    resale_price: 360000,
    lat: 1.3298,
    lng: 103.9345,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Direct Morning Sun (3h)",
    afternoon_sun: "Cool in Afternoon",
    sunlight_score: 90,
    thermal_comfort: "Good (Bright & Airy)",
    azimuth_deg: 90
  },
  {
    id: "HDB-BD-003",
    month: "2026-07",
    town: "BEDOK",
    flat_type: "5 ROOM",
    block: "715",
    street_name: "BEDOK RESERVOIR RD",
    storey_range: "10 TO 12",
    floor_area_sqm: 122,
    flat_model: "Improved",
    lease_commence_date: 1993,
    remaining_lease_years: 66,
    remaining_lease_months: 1,
    resale_price: 730000,
    lat: 1.3365,
    lng: 103.9248,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "South",
    morning_sun: "Morning Rays with Reservoir Breeze",
    afternoon_sun: "No West Sun Exposure",
    sunlight_score: 94,
    thermal_comfort: "High (Reservoir Facing)",
    azimuth_deg: 135
  },

  // WOODLANDS
  {
    id: "HDB-WL-001",
    month: "2026-05",
    town: "WOODLANDS",
    flat_type: "4 ROOM",
    block: "888A",
    street_name: "WOODLANDS DR 50",
    storey_range: "10 TO 12",
    floor_area_sqm: 100,
    flat_model: "Model A",
    lease_commence_date: 1998,
    remaining_lease_years: 71,
    remaining_lease_months: 5,
    resale_price: 495000,
    lat: 1.4365,
    lng: 103.7915,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "North-East",
    morning_sun: "Gentle Morning Warmth",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 95,
    thermal_comfort: "High (Spacious & Cool)",
    azimuth_deg: 0
  },
  {
    id: "HDB-WL-002",
    month: "2026-06",
    town: "WOODLANDS",
    flat_type: "5 ROOM",
    block: "550",
    street_name: "WOODLANDS DRIVE 44",
    storey_range: "07 TO 09",
    floor_area_sqm: 120,
    flat_model: "Improved",
    lease_commence_date: 2000,
    remaining_lease_years: 73,
    remaining_lease_months: 2,
    resale_price: 615000,
    lat: 1.4328,
    lng: 103.7942,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "East",
    morning_sun: "Direct Morning Sun (2.5h)",
    afternoon_sun: "Shielded After Lunch",
    sunlight_score: 92,
    thermal_comfort: "Very Good (Cross Ventilation)",
    azimuth_deg: 45
  },
  {
    id: "HDB-WL-003",
    month: "2026-07",
    town: "WOODLANDS",
    flat_type: "EXECUTIVE",
    block: "732",
    street_name: "WOODLANDS CIRCLE",
    storey_range: "04 TO 06",
    floor_area_sqm: 145,
    flat_model: "Maisonette",
    lease_commence_date: 1996,
    remaining_lease_years: 69,
    remaining_lease_months: 9,
    resale_price: 750000,
    lat: 1.4442,
    lng: 103.7981,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Indirect Natural Daylight",
    afternoon_sun: "No Afternoon Heat",
    sunlight_score: 94,
    thermal_comfort: "High (Expansive Double Volume)",
    azimuth_deg: 180
  },

  // TOA PAYOH
  {
    id: "HDB-TP-001",
    month: "2026-05",
    town: "TOA PAYOH",
    flat_type: "4 ROOM",
    block: "138B",
    street_name: "LOR 1A TOA PAYOH",
    storey_range: "25 TO 27",
    floor_area_sqm: 93,
    flat_model: "DBSS (The Peak)",
    lease_commence_date: 2012,
    remaining_lease_years: 85,
    remaining_lease_months: 7,
    resale_price: 970000,
    lat: 1.3385,
    lng: 103.8445,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Gentle Daylight",
    afternoon_sun: "Zero Direct West Glare",
    sunlight_score: 97,
    thermal_comfort: "High (Panoramic Breezy)",
    azimuth_deg: 0
  },
  {
    id: "HDB-TP-002",
    month: "2026-06",
    town: "TOA PAYOH",
    flat_type: "3 ROOM",
    block: "64",
    street_name: "LOR 5 TOA PAYOH",
    storey_range: "07 TO 09",
    floor_area_sqm: 65,
    flat_model: "Improved",
    lease_commence_date: 1971,
    remaining_lease_years: 44,
    remaining_lease_months: 6,
    resale_price: 345000,
    lat: 1.3341,
    lng: 103.8552,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Morning Sunrise (3h)",
    afternoon_sun: "Shaded in Afternoon",
    sunlight_score: 89,
    thermal_comfort: "Good (Centrally Located)",
    azimuth_deg: 90
  },
  {
    id: "HDB-TP-003",
    month: "2026-07",
    town: "TOA PAYOH",
    flat_type: "5 ROOM",
    block: "260",
    street_name: "KIM KEAT AVE",
    storey_range: "16 TO 18",
    floor_area_sqm: 115,
    flat_model: "Improved",
    lease_commence_date: 2000,
    remaining_lease_years: 73,
    remaining_lease_months: 8,
    resale_price: 890000,
    lat: 1.3308,
    lng: 103.8585,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "South",
    morning_sun: "Mild Morning Glow",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 93,
    thermal_comfort: "High (Spacious City Fringe)",
    azimuth_deg: 135
  },

  // CLEMENTI
  {
    id: "HDB-CL-001",
    month: "2026-05",
    town: "CLEMENTI",
    flat_type: "4 ROOM",
    block: "441A",
    street_name: "CLEMENTI AVE 3",
    storey_range: "22 TO 24",
    floor_area_sqm: 93,
    flat_model: "Model A",
    lease_commence_date: 2017,
    remaining_lease_years: 90,
    remaining_lease_months: 3,
    resale_price: 960000,
    lat: 1.3142,
    lng: 103.7655,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Diffused Indirect Light",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 96,
    thermal_comfort: "High (Optimal Cross Breeze)",
    azimuth_deg: 180
  },
  {
    id: "HDB-CL-002",
    month: "2026-06",
    town: "CLEMENTI",
    flat_type: "3 ROOM",
    block: "334",
    street_name: "CLEMENTI AVE 2",
    storey_range: "07 TO 09",
    floor_area_sqm: 67,
    flat_model: "New Generation",
    lease_commence_date: 1979,
    remaining_lease_years: 52,
    remaining_lease_months: 4,
    resale_price: 420000,
    lat: 1.3168,
    lng: 103.7692,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "East",
    morning_sun: "Direct Morning Sun (2.5h)",
    afternoon_sun: "No West Glare",
    sunlight_score: 90,
    thermal_comfort: "Good (Close to Tertiary Hubs)",
    azimuth_deg: 45
  },
  {
    id: "HDB-CL-003",
    month: "2026-07",
    town: "CLEMENTI",
    flat_type: "5 ROOM",
    block: "206",
    street_name: "CLEMENTI AVE 6",
    storey_range: "13 TO 15",
    floor_area_sqm: 118,
    flat_model: "Improved",
    lease_commence_date: 1998,
    remaining_lease_years: 71,
    remaining_lease_months: 2,
    resale_price: 880000,
    lat: 1.3205,
    lng: 103.7621,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "South",
    morning_sun: "Morning Rays (2h)",
    afternoon_sun: "Shielded in Afternoon",
    sunlight_score: 92,
    thermal_comfort: "Very Good (Bright & Breezy)",
    azimuth_deg: 135
  },

  // BUKIT MERAH & CENTRAL AREA
  {
    id: "HDB-BM-001",
    month: "2026-05",
    town: "BUKIT MERAH",
    flat_type: "4 ROOM",
    block: "96A",
    street_name: "HENDERSON RD",
    storey_range: "37 TO 39",
    floor_area_sqm: 93,
    flat_model: "Model A",
    lease_commence_date: 2019,
    remaining_lease_years: 92,
    remaining_lease_months: 8,
    resale_price: 1150000,
    lat: 1.2848,
    lng: 103.8215,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Ambient Skyline Light",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 98,
    thermal_comfort: "Exceptional (Sky High Wind Tunnel)",
    azimuth_deg: 180
  },
  {
    id: "HDB-BM-002",
    month: "2026-06",
    town: "BUKIT MERAH",
    flat_type: "5 ROOM",
    block: "1A",
    street_name: "CANTONMENT RD (Pinnacle@Duxton)",
    storey_range: "43 TO 45",
    floor_area_sqm: 106,
    flat_model: "Type S2",
    lease_commence_date: 2011,
    remaining_lease_years: 84,
    remaining_lease_months: 1,
    resale_price: 1450000,
    lat: 1.2778,
    lng: 103.8402,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Sunrise Sea View Glow",
    afternoon_sun: "Protected from Afternoon Glare",
    sunlight_score: 95,
    thermal_comfort: "Iconic (Sky Bridge Breeze)",
    azimuth_deg: 135
  },
  {
    id: "HDB-BM-003",
    month: "2026-07",
    town: "BUKIT MERAH",
    flat_type: "3 ROOM",
    block: "116",
    street_name: "BUKIT PURMEI RD",
    storey_range: "07 TO 09",
    floor_area_sqm: 67,
    flat_model: "Simplified",
    lease_commence_date: 1984,
    remaining_lease_years: 57,
    remaining_lease_months: 5,
    resale_price: 475000,
    lat: 1.2755,
    lng: 103.8268,
    facing: "East",
    living_room_facing: "East",
    bedrooms_facing: "North-East",
    morning_sun: "Direct Morning Sun (3h)",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 91,
    thermal_comfort: "Very Good (Fringe of CBD)",
    azimuth_deg: 90
  },

  // SEMBAWANG & YISHUN
  {
    id: "HDB-SB-001",
    month: "2026-05",
    town: "SEMBAWANG",
    flat_type: "4 ROOM",
    block: "588C",
    street_name: "MONTREAL DR",
    storey_range: "10 TO 12",
    floor_area_sqm: 93,
    flat_model: "Model A",
    lease_commence_date: 2021,
    remaining_lease_years: 94,
    remaining_lease_months: 9,
    resale_price: 545000,
    lat: 1.4512,
    lng: 103.8275,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "North-East",
    morning_sun: "Gentle Morning Warmth",
    afternoon_sun: "No Afternoon Sun",
    sunlight_score: 96,
    thermal_comfort: "High (Near Coastal Park)",
    azimuth_deg: 0
  },
  {
    id: "HDB-YS-001",
    month: "2026-06",
    town: "YISHUN",
    flat_type: "5 ROOM",
    block: "505B",
    street_name: "YISHUN ST 51",
    storey_range: "10 TO 12",
    floor_area_sqm: 112,
    flat_model: "Improved",
    lease_commence_date: 2018,
    remaining_lease_years: 91,
    remaining_lease_months: 2,
    resale_price: 688000,
    lat: 1.4195,
    lng: 103.8468,
    facing: "North-East",
    living_room_facing: "North-East",
    bedrooms_facing: "East",
    morning_sun: "Bright Sunrise Rays (3h)",
    afternoon_sun: "Zero Afternoon Heat",
    sunlight_score: 93,
    thermal_comfort: "Very Good (Lower Seletar Breeze)",
    azimuth_deg: 45
  },
  {
    id: "HDB-YS-002",
    month: "2026-07",
    town: "YISHUN",
    flat_type: "3 ROOM",
    block: "731",
    street_name: "YISHUN ST 72",
    storey_range: "04 TO 06",
    floor_area_sqm: 67,
    flat_model: "Simplified",
    lease_commence_date: 1986,
    remaining_lease_years: 59,
    remaining_lease_months: 3,
    resale_price: 380000,
    lat: 1.4285,
    lng: 103.8322,
    facing: "North-South",
    living_room_facing: "South",
    bedrooms_facing: "North",
    morning_sun: "Diffused Daylight",
    afternoon_sun: "No West Glare",
    sunlight_score: 91,
    thermal_comfort: "Good (Affordable Value)",
    azimuth_deg: 180
  },

  // PASIR RIS
  {
    id: "HDB-PR-001",
    month: "2026-05",
    town: "PASIR RIS",
    flat_type: "5 ROOM",
    block: "526A",
    street_name: "PASIR RIS ST 51",
    storey_range: "13 TO 15",
    floor_area_sqm: 115,
    flat_model: "Improved",
    lease_commence_date: 2016,
    remaining_lease_years: 89,
    remaining_lease_months: 6,
    resale_price: 760000,
    lat: 1.3688,
    lng: 103.9488,
    facing: "North-South",
    living_room_facing: "North",
    bedrooms_facing: "South",
    morning_sun: "Soft Coastal Daylight",
    afternoon_sun: "No Direct Afternoon Sun",
    sunlight_score: 97,
    thermal_comfort: "High (Near Coast Breeze)",
    azimuth_deg: 0
  },
  {
    id: "HDB-PR-002",
    month: "2026-06",
    town: "PASIR RIS",
    flat_type: "EXECUTIVE",
    block: "634",
    street_name: "PASIR RIS DRIVE 1",
    storey_range: "07 TO 09",
    floor_area_sqm: 147,
    flat_model: "Executive Apartment",
    lease_commence_date: 1994,
    remaining_lease_years: 67,
    remaining_lease_months: 1,
    resale_price: 825000,
    lat: 1.3742,
    lng: 103.9412,
    facing: "South-East",
    living_room_facing: "South-East",
    bedrooms_facing: "East",
    morning_sun: "Morning Rays (2.5h)",
    afternoon_sun: "Sheltered in Afternoon",
    sunlight_score: 92,
    thermal_comfort: "High (Huge Single-Floor Living)",
    azimuth_deg: 135
  }
];

// Helper: Calculate price per square meter
HDB_DATASET.forEach(item => {
  item.price_per_sqm = Math.round(item.resale_price / item.floor_area_sqm);
});

/**
 * Serverless API handler function.
 * Validates request parameters, filters records, and computes analytical summaries.
 * 
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 */
export default async function searchHandler(req, res) {
  // Set CORS headers for serverless & cross-origin consumers
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Support both GET (query parameters) and POST (JSON body)
  const params = req.method === "POST" ? (req.body || {}) : (req.query || {});

  // 1. Server-side Input Validation & Sanitization
  // Support both spec parameters ("budget", "size", "area") and granular parameters ("budgetMin", "budgetMax", "sizeMin", "sizeMax", "town")
  let budgetMax = Number(params.budgetMax) > 0 ? Number(params.budgetMax) : 2000000;
  if (params.budget !== undefined && Number(params.budget) > 0) {
    budgetMax = Number(params.budget);
  }
  const budgetMin = Number(params.budgetMin) >= 0 ? Number(params.budgetMin) : 0;
  
  let sizeMin = Number(params.sizeMin) >= 0 ? Number(params.sizeMin) : 0;
  let sizeMax = Number(params.sizeMax) > 0 ? Number(params.sizeMax) : 300;
  if (params.size !== undefined && Number(params.size) > 0) {
    sizeMin = Number(params.size);
  }

  const leaseMin = Number(params.leaseMin) >= 0 ? Number(params.leaseMin) : 0;

  let rawTown = "ALL";
  if (typeof params.area === "string" && params.area.trim()) {
    rawTown = params.area.trim().toUpperCase();
  } else if (typeof params.town === "string" && params.town.trim()) {
    rawTown = params.town.trim().toUpperCase();
  }

  const rawFlatType = typeof params.flatType === "string" ? params.flatType.trim().toUpperCase() : "ALL";
  const sunlightPref = typeof params.sunlightPreference === "string" ? params.sunlightPreference.trim().toLowerCase() : "all";
  const sortBy = typeof params.sortBy === "string" ? params.sortBy.trim() : "price_asc";

  // Enforce logical bounds
  if (budgetMin > budgetMax) {
    return res.status(400).json({ error: "Invalid budget: budgetMin cannot exceed budgetMax" });
  }
  if (sizeMin > sizeMax) {
    return res.status(400).json({ error: "Invalid size: sizeMin cannot exceed sizeMax" });
  }

  // 2. Perform Dataset Filtering
  let results = HDB_DATASET.filter(item => {
    // Budget filter
    if (item.resale_price < budgetMin || item.resale_price > budgetMax) return false;

    // Floor area (sqm) filter
    if (item.floor_area_sqm < sizeMin || item.floor_area_sqm > sizeMax) return false;

    // Remaining lease filter
    if (item.remaining_lease_years < leaseMin) return false;

    // Town / Area filter
    if (rawTown !== "ALL") {
      const itemTown = item.town.toUpperCase();
      if (itemTown !== rawTown && !itemTown.includes(rawTown) && !rawTown.includes(itemTown)) {
        return false;
      }
    }

    // Flat type filter
    if (rawFlatType !== "ALL" && item.flat_type !== rawFlatType) return false;

    // Sunlight ray criteria filter
    if (sunlightPref === "north_south") {
      if (item.facing !== "North-South") return false;
    } else if (sunlightPref === "morning_sun") {
      if (!item.morning_sun.toLowerCase().includes("morning") && item.facing !== "East" && item.facing !== "North-East" && item.facing !== "South-East") {
        return false;
      }
    } else if (sunlightPref === "no_afternoon_sun") {
      if (item.facing === "West" || item.facing === "North-West" || item.facing === "South-West" || item.afternoon_sun.toLowerCase().includes("direct")) {
        return false;
      }
    } else if (sunlightPref === "high_comfort") {
      if (item.sunlight_score < 90) return false;
    }

    return true;
  });

  // Format results with exact properties: town, flat_type, floor_area_sqm, remaining_lease, price
  const formattedResults = results.map(item => {
    const remainingLeaseStr = `${item.remaining_lease_years} years${item.remaining_lease_months ? ` ${item.remaining_lease_months} months` : ""}`;
    return {
      ...item,
      town: item.town,
      flat_type: item.flat_type,
      floor_area_sqm: item.floor_area_sqm,
      remaining_lease: remainingLeaseStr,
      price: item.resale_price
    };
  });

  // 3. Sorting results
  results.sort((a, b) => {
    switch (sortBy) {
      case "price_asc": return a.resale_price - b.resale_price;
      case "price_desc": return b.resale_price - a.resale_price;
      case "size_desc": return b.floor_area_sqm - a.floor_area_sqm;
      case "size_asc": return a.floor_area_sqm - b.floor_area_sqm;
      case "lease_desc": return b.remaining_lease_years - a.remaining_lease_years;
      case "psqm_asc": return a.price_per_sqm - b.price_per_sqm;
      case "sunlight_score_desc": return b.sunlight_score - a.sunlight_score;
      default: return a.resale_price - b.resale_price;
    }
  });

  // 4. Compute Analytical Summaries & Charts Aggregations
  const totalCount = results.length;
  const avgPrice = totalCount > 0 ? Math.round(results.reduce((s, i) => s + i.resale_price, 0) / totalCount) : 0;
  const avgPsqm = totalCount > 0 ? Math.round(results.reduce((s, i) => s + i.price_per_sqm, 0) / totalCount) : 0;
  const avgLease = totalCount > 0 ? (results.reduce((s, i) => s + i.remaining_lease_years, 0) / totalCount).toFixed(1) : "0.0";
  const avgSunlightScore = totalCount > 0 ? Math.round(results.reduce((s, i) => s + i.sunlight_score, 0) / totalCount) : 0;

  // Chart 1: Price Trends by Month
  const monthMap = {};
  HDB_DATASET.forEach(item => {
    const m = item.month;
    if (!monthMap[m]) {
      monthMap[m] = { month: m, total: 0, count: 0, min: item.resale_price, max: item.resale_price };
    }
    monthMap[m].total += item.resale_price;
    monthMap[m].count += 1;
    monthMap[m].min = Math.min(monthMap[m].min, item.resale_price);
    monthMap[m].max = Math.max(monthMap[m].max, item.resale_price);
  });
  const priceTrendsByMonth = Object.keys(monthMap).sort().map(m => ({
    month: m,
    averagePrice: Math.round(monthMap[m].total / monthMap[m].count),
    minPrice: monthMap[m].min,
    maxPrice: monthMap[m].max,
    count: monthMap[m].count
  }));

  // Chart 2: Distribution by Town (for current matches or overall if matches empty)
  const townMap = {};
  (results.length > 0 ? results : HDB_DATASET).forEach(item => {
    if (!townMap[item.town]) {
      townMap[item.town] = { town: item.town, count: 0, total: 0, totalPsqm: 0 };
    }
    townMap[item.town].count += 1;
    townMap[item.town].total += item.resale_price;
    townMap[item.town].totalPsqm += item.price_per_sqm;
  });
  const distributionByTown = Object.keys(townMap).map(t => ({
    town: t,
    count: townMap[t].count,
    averagePrice: Math.round(townMap[t].total / townMap[t].count),
    averagePsqm: Math.round(townMap[t].totalPsqm / townMap[t].count)
  })).sort((a, b) => b.count - a.count);

  // Panel: "What does my budget buy?" - Area vs Remaining Lease matrix
  // Categorize units into Lease Buckets (<60yr, 60-75yr, 76-85yr, 86-99yr) and Area Buckets (<70sqm, 70-95sqm, 96-120sqm, >120sqm)
  const leaseBuckets = [
    { label: "< 60 Years (Mature/Central)", min: 0, max: 59 },
    { label: "60 - 75 Years (Mid Lease)", min: 60, max: 75 },
    { label: "76 - 85 Years (Good Lease)", min: 76, max: 85 },
    { label: "86 - 99 Years (Fresh Lease)", min: 86, max: 99 }
  ];

  const sizeBuckets = [
    { label: "Compact (<70 sqm)", min: 0, max: 69 },
    { label: "Standard (70-95 sqm)", min: 70, max: 95 },
    { label: "Spacious (96-120 sqm)", min: 96, max: 120 },
    { label: "Jumbo/Exec (>120 sqm)", min: 121, max: 300 }
  ];

  const budgetBuyMatrix = leaseBuckets.map(lb => {
    return {
      leaseCategory: lb.label,
      sizeCategories: sizeBuckets.map(sb => {
        const matchingCells = results.filter(
          item => item.remaining_lease_years >= lb.min &&
                  item.remaining_lease_years <= lb.max &&
                  item.floor_area_sqm >= sb.min &&
                  item.floor_area_sqm <= sb.max
        );
        const cellCount = matchingCells.length;
        const cellAvgPrice = cellCount > 0 
          ? Math.round(matchingCells.reduce((acc, curr) => acc + curr.resale_price, 0) / cellCount) 
          : 0;
        return {
          sizeLabel: sb.label,
          count: cellCount,
          averagePrice: cellAvgPrice,
          sampleFlatTypes: Array.from(new Set(matchingCells.map(c => c.flat_type))).join(", ")
        };
      })
    };
  });

  // Sunlight ray insights breakdown
  const sunlightBreakdown = {
    northSouthCount: results.filter(i => i.facing === "North-South").length,
    morningSunCount: results.filter(i => i.facing === "East" || i.facing === "North-East" || i.facing === "South-East").length,
    afternoonSunShielded: results.filter(i => !i.afternoon_sun.toLowerCase().includes("direct") && i.facing !== "West").length,
    highComfortPercentage: totalCount > 0 ? Math.round((results.filter(i => i.sunlight_score >= 90).length / totalCount) * 100) : 0
  };

  // Optional AI Buyer Tips (read only server-side from process.env.GEMINI_API_KEY)
  let aiInsights = null;
  if (params.includeAiSummary === "true" && process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const prompt = `As a senior Singapore property and solar orientation specialist, provide 2 short concise bullet points evaluating this HDB search: Budget $${budgetMin.toLocaleString()} - $${budgetMax.toLocaleString()}, Town ${rawTown}, Sunlight preference: ${sunlightPref}. Focus on sunlight ray angle impact (morning vs afternoon sun thermal comfort), remaining lease trade-offs, and floor area value. Keep it professional, objective, and under 90 words.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt
      });
      aiInsights = response.text || "";
    } catch (e) {
      console.warn("AI summary generation skipped:", e.message);
    }
  }

  // 5. Deliver Comprehensive JSON response
  return res.status(200).json({
    success: true,
    filterEcho: {
      budgetMin,
      budgetMax,
      sizeMin,
      sizeMax,
      leaseMin,
      town: rawTown,
      flatType: rawFlatType,
      sunlightPreference: sunlightPref,
      sortBy
    },
    meta: {
      totalMatches: totalCount,
      averagePrice: avgPrice,
      averagePsqm: avgPsqm,
      averageRemainingLease: avgLease,
      averageSunlightScore: avgSunlightScore
    },
    results: formattedResults,
    analytics: {
      priceTrendsByMonth,
      distributionByTown,
      budgetBuyMatrix,
      sunlightBreakdown
    },
    aiInsights
  });
}
