import type { CityRestaurant } from "@/config/city-restaurants";

export type TaxiProvider = "uber" | "lyft" | "bolt" | "gett";

export type LandmarkAgeTag = "toddler" | "child" | "tween" | "teen";
export type LandmarkIntensity = "low" | "medium" | "high";

/** Wizard interest categories — keep in sync with interest-map + docs/interest-categories.md. */
export type LandmarkInterestTag =
  | "parks"
  | "beaches"
  | "nature"
  | "history"
  | "museums"
  | "playgrounds"
  /** Indoor playgrounds, soft play, bounce houses / inflatable parks. */
  | "indoor-play"
  | "zoos"
  /** Petting farms, sanctuaries, encounters — distinct from observe-first zoos. */
  | "animal-experiences"
  | "theme-parks"
  | "interactive"
  /** Guided tours and sightseeing loops — distinct from landmark visits. */
  | "tours"
  | "food-markets"
  | "shopping"
  | "entertainment"
  | "sports"
  | "spas";

/** Simple daily hours — used when hoursByWeekday has no entry for that day. */
export type LandmarkOpeningHours = {
  open: string;
  close: string;
};

/**
 * Per-weekday hours. Keys match `Date#getDay()` (0=Sun … 6=Sat).
 * `null` = closed that weekday. Missing key falls back to `openingHours`.
 */
export type HoursByWeekday = Partial<
  Record<0 | 1 | 2 | 3 | 4 | 5 | 6, LandmarkOpeningHours | null>
>;

/** Age-band ticket prices from the venue (curated). `maxAgeInclusive: null` = adult. */
export type TicketTier = {
  maxAgeInclusive: number | null;
  price: number;
};

/** Meal slots the venue can cover on-site (café / food court). */
export type OnSiteMeal = "breakfast" | "lunch" | "dinner";

export type Landmark = {
  name: string;
  lat: number;
  lng: number;
  adultPrice: number;
  openingHours: LandmarkOpeningHours;
  /** Optional weekday schedule; overrides openingHours when set for that day. */
  hoursByWeekday?: HoursByWeekday;
  /**
   * Set to "assumed" when `openingHours` is a category guess rather than real
   * venue data (Places result with no schedule). Assumed hours are never used to
   * exclude a venue — see isKnownClosedForVisit.
   */
  hoursConfidence?: "assumed";
  /**
   * HARD age restriction the venue enforces (curated data only — never inferred
   * from Places names/types or from ageTags). A family with a child below
   * minAge / above maxAge cannot use this venue at all.
   */
  minAge?: number;
  maxAge?: number;
  /** Optional curated ticket table; otherwise adultPrice + age multipliers. */
  ticketTiers?: TicketTier[];
  /** Official ticket page used for curated prices (documentation). */
  ticketSourceUrl?: string;
  /** ISO date when ticketTiers were last verified. */
  pricedAsOf?: string;
  /** When set, meal planner may schedule that meal at this venue's café. */
  onSiteMeals?: OnSiteMeal[];
  intensity: LandmarkIntensity;
  ageTags: LandmarkAgeTag[];
  /** Wizard interest categories this stop satisfies (FAM-7). */
  interestTags: LandmarkInterestTag[];
  indoor: boolean;
  /** Google Places id when sourced from Places (FAM-59). */
  placeId?: string;
  rating?: number;
  reviewCount?: number;
};

export type CityConfig = {
  id: string;
  name: string;
  country: string;
  currency: string;
  currencySymbol: string;
  lat: number;
  lng: number;
  aliases: string[];
  /**
   * How suitable public transit is for family day-to-day travel.
   * - good: Public transit selectable normally
   * - limited: selectable with a warning; engine may fall back to taxis
   * - none: Public transit shown grayed out (not selectable)
   */
  transitQuality: "good" | "limited" | "none";
  taxiProviders: { name: TaxiProvider; label: string; multiplier: number }[];
  transport: {
    baseFare: number;
    ratePerKm: number;
    ratePerMin: number;
    publicTransitDayPass: number;
    publicTransitSingleRide: number;
    fuelPricePerLiter: number;
    avgFuelLitersPerDay: number;
    /** Typical paid parking fee per stop when driving (car rental). */
    parkingFeePerStop: number;
  };
  /**
   * Price for ONE ADULT at a normal sit-down family restaurant, tax and tip
   * included. Children are priced off this by age (childMealShare), never at
   * the adult rate; accommodation type and meal tier scale it further.
   *
   * For stay delivery lunch, `lunch` is the adult food estimate only; app
   * delivery fee, service fee, and tip are layered on via `delivery` (or
   * currency defaults) — see estimateDeliveryLunchCost.
   */
  food: {
    breakfast: number;
    lunch: number;
    dinner: number;
    /**
     * App delivery extras for “Delivery lunch at your stay”.
     * Omitted → currency defaults (US: fees + tip; JPY: fees, tipRate 0).
     */
    delivery?: {
      /** Flat courier / delivery fee. */
      fee: number;
      /** Flat platform service fee. */
      serviceFee: number;
      /** Tip as a fraction of the food subtotal (0 = do not estimate tip). */
      tipRate: number;
    };
  };
  landmarks: Landmark[];
  /** Places-backed restaurant pool for non-curated cities (FAM-58). */
  restaurants?: CityRestaurant[];
};

export const PRICING_DISCLAIMER =
  "Estimated local pricing model — not real-time fares. Actual costs may vary.";

export const CITY_CONFIGS: CityConfig[] = [
  {
    id: "san-diego",
    name: "San Diego",
    country: "US",
    currency: "USD",
    currencySymbol: "$",
    lat: 32.7157,
    lng: -117.1611,
    aliases: ["san diego", "san diego ca", "san diego california"],
    transitQuality: "limited",
    taxiProviders: [
      { name: "uber", label: "Taxi", multiplier: 1.0 },
      { name: "lyft", label: "Taxi", multiplier: 0.95 },
    ],
    transport: {
      baseFare: 2.5,
      ratePerKm: 0.2,
      ratePerMin: 0.9,
      publicTransitDayPass: 6,
      publicTransitSingleRide: 2.5,
      fuelPricePerLiter: 1.1,
      avgFuelLitersPerDay: 8,
      parkingFeePerStop: 10,
    },
    food: { breakfast: 18, lunch: 24, dinner: 38 },
    landmarks: [
      {
        name: "Balboa Park",
        lat: 32.7341,
        lng: -117.1446,
        adultPrice: 0,
        placeId: "ChIJA8tw-pZU2YARxPYVsDwL8-0",
        rating: 4.8,
        reviewCount: 78948,
        openingHours: { open: "08:00", close: "20:00" },
        onSiteMeals: ["lunch"],
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "museums", "playgrounds"],
        indoor: false,
      },
      {
        name: "San Diego Zoo",
        lat: 32.7353,
        lng: -117.149,
        adultPrice: 72,
        placeId: "ChIJyYB_SZVU2YARR-I1Jjf08F0",
        rating: 4.7,
        reviewCount: 66740,
        // Approx general admission from sandiegozoo.org (verify periodically).
        ticketSourceUrl: "https://zoo.sandiegozoo.org/tickets",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 2, price: 0 },
          { maxAgeInclusive: 11, price: 62 },
          { maxAgeInclusive: null, price: 72 },
        ],
        openingHours: { open: "09:00", close: "17:00" },
        onSiteMeals: ["lunch"],
        intensity: "high",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["zoos"],
        indoor: false,
      },
      {
        name: "La Jolla Cove",
        lat: 32.8509,
        lng: -117.273,
        adultPrice: 0,
        placeId: "ChIJ6-V2qP4D3IARF8anKDxl_5A",
        rating: 4.8,
        reviewCount: 5092,
        openingHours: { open: "06:00", close: "20:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["beaches", "nature"],
        indoor: false,
      },
      {
        name: "USS Midway Museum",
        lat: 32.7137,
        lng: -117.1751,
        adultPrice: 36,
        placeId: "ChIJwYBuKqtU2YARslNFQDCJt_s",
        rating: 4.8,
        reviewCount: 53290,
        ticketSourceUrl: "https://www.midway.org/visit/tickets-passes/",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 5, price: 0 },
          { maxAgeInclusive: 12, price: 26 },
          { maxAgeInclusive: null, price: 36 },
        ],
        openingHours: { open: "10:00", close: "17:00" },
        onSiteMeals: ["lunch"],
        intensity: "medium",
        ageTags: ["tween", "teen"],
        interestTags: ["museums", "history", "interactive"],
        indoor: true,
      },
      {
        name: "Fleet Science Center",
        lat: 32.7308,
        lng: -117.147,
        adultPrice: 25,
        placeId: "ChIJITml-JZU2YARvg2lEVgD-E8",
        rating: 4.5,
        reviewCount: 4432,
        ticketSourceUrl: "https://www.fleetscience.org/tickets",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 2, price: 0 },
          { maxAgeInclusive: 12, price: 18 },
          { maxAgeInclusive: null, price: 25 },
        ],
        openingHours: { open: "10:00", close: "17:00" },
        // Typically closed Tuesdays.
        hoursByWeekday: { 2: null },
        onSiteMeals: ["lunch"],
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["interactive", "museums"],
        indoor: true,
      },
      {
        name: "Belmont Park",
        lat: 32.7714,
        lng: -117.2525,
        adultPrice: 20,
        placeId: "ChIJGZfrmeJU2YARL4VJe0IZZRQ",
        rating: 4.6,
        reviewCount: 17936,
        openingHours: { open: "11:00", close: "20:00" },
        onSiteMeals: ["lunch", "dinner"],
        intensity: "high",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["theme-parks", "beaches", "entertainment"],
        indoor: false,
      },
      {
        name: "Birch Aquarium at Scripps",
        lat: 32.8663,
        lng: -117.2506,
        adultPrice: 30,
        placeId: "ChIJ-6dQ_bMG3IARqV9Yevu9XLw",
        rating: 4.4,
        reviewCount: 9423,
        ticketSourceUrl: "https://aquarium.ucsd.edu/tickets",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 2, price: 0 },
          { maxAgeInclusive: 17, price: 25 },
          { maxAgeInclusive: null, price: 30 },
        ],
        openingHours: { open: "09:00", close: "17:00" },
        onSiteMeals: ["lunch"],
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["zoos", "interactive", "nature"],
        indoor: true,
      },
      {
        name: "The New Children's Museum",
        lat: 32.7105,
        lng: -117.1638,
        adultPrice: 18,
        placeId: "ChIJldZd-1ZT2YAR0rXTzPlFJ_8",
        rating: 4.5,
        reviewCount: 3421,
        ticketSourceUrl: "https://thinkplaycreate.org/visit/",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 0, price: 0 },
          { maxAgeInclusive: null, price: 18 },
        ],
        openingHours: { open: "10:00", close: "16:00" },
        // Closed Tuesdays.
        hoursByWeekday: { 2: null },
        intensity: "medium",
        ageTags: ["toddler", "child"],
        interestTags: ["interactive", "museums", "playgrounds", "indoor-play"],
        indoor: true,
      },
      {
        name: "Old Town San Diego",
        lat: 32.7552,
        lng: -117.197,
        adultPrice: 0,
        placeId: "ChIJe9OrW-eq3oARuXXd8wQMg14",
        rating: 4.7,
        reviewCount: 31637,
        openingHours: { open: "10:00", close: "17:00" },
        onSiteMeals: ["lunch", "dinner"],
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["history", "shopping", "food-markets"],
        indoor: false,
      },
      {
        name: "Liberty Public Market",
        lat: 32.7402,
        lng: -117.2165,
        adultPrice: 0,
        placeId: "ChIJqTNLdAOr3oARx08fgT_mxGg",
        rating: 4.7,
        reviewCount: 8145,
        openingHours: { open: "10:00", close: "19:00" },
        onSiteMeals: ["breakfast", "lunch", "dinner"],
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["food-markets", "shopping"],
        indoor: true,
      },
      {
        name: "Torrey Pines State Natural Reserve",
        lat: 32.9216,
        lng: -117.2532,
        adultPrice: 0,
        placeId: "ChIJa5RVrGcG3IARsS8AQCWntoc",
        rating: 4.8,
        reviewCount: 15591,
        openingHours: { open: "07:15", close: "19:00" },
        intensity: "low",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["nature", "parks", "beaches"],
        indoor: false,
      },
      {
        name: "Mission Bay Park",
        lat: 32.7773,
        lng: -117.2107,
        adultPrice: 0,
        placeId: "ChIJ9dZdfnyq3oARI_cFYz7QSKM",
        rating: 4.6,
        reviewCount: 25140,
        openingHours: { open: "06:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "sports", "beaches", "playgrounds"],
        indoor: false,
      },
      {
        name: "Mission Beach Boardwalk",
        lat: 32.7702,
        lng: -117.2526,
        adultPrice: 0,
        rating: 4.7,
        reviewCount: 8200,
        openingHours: { open: "06:00", close: "22:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["beaches", "sports"],
        indoor: false,
      },
      {
        name: "Coronado Beach",
        lat: 32.6859,
        lng: -117.1865,
        adultPrice: 0,
        rating: 4.8,
        reviewCount: 12400,
        openingHours: { open: "06:00", close: "22:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["beaches", "nature"],
        indoor: false,
      },
      {
        name: "Waterfront Park Playground",
        lat: 32.7265,
        lng: -117.1728,
        adultPrice: 0,
        placeId: "ChIJk5INGa1U2YARJZnoZGH6uvM",
        rating: 4.7,
        reviewCount: 426,
        openingHours: { open: "06:00", close: "20:00" },
        intensity: "medium",
        ageTags: ["toddler", "child"],
        interestTags: ["playgrounds", "parks"],
        indoor: false,
      },
      {
        name: "Kate Sessions Park",
        lat: 32.8115,
        lng: -117.2365,
        adultPrice: 0,
        placeId: "ChIJ2zcFYqMB3IARMau_-x4xtJM",
        rating: 4.8,
        reviewCount: 2845,
        openingHours: { open: "07:00", close: "20:00" },
        onSiteMeals: ["lunch"],
        intensity: "low",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["playgrounds", "parks", "nature"],
        indoor: false,
      },
      {
        name: "Funbox (Plaza Bonita, National City)",
        lat: 32.6558,
        lng: -117.0654,
        adultPrice: 20,
        ticketSourceUrl: "https://funbox.com/nationalcity",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 2, price: 0 },
          { maxAgeInclusive: 5, price: 15 },
          { maxAgeInclusive: null, price: 20 },
        ],
        openingHours: { open: "10:00", close: "20:00" },
        onSiteMeals: ["lunch"],
        intensity: "high",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["indoor-play", "playgrounds", "entertainment"],
        indoor: true,
      },
      {
        name: "Play City Eastlake",
        lat: 32.6475,
        lng: -116.9685,
        adultPrice: 14,
        placeId: "ChIJ34zSOBFF2YARwKOglaXTNkU",
        rating: 4.6,
        reviewCount: 1513,
        ticketSourceUrl: "https://playcityeastlake.com/",
        pricedAsOf: "2026-07-01",
        ticketTiers: [
          { maxAgeInclusive: 0, price: 0 },
          { maxAgeInclusive: null, price: 14 },
        ],
        openingHours: { open: "10:00", close: "20:00" },
        intensity: "high",
        ageTags: ["toddler", "child"],
        interestTags: ["indoor-play", "playgrounds", "entertainment"],
        indoor: true,
      },
    ],
  },
  {
    id: "paris",
    name: "Paris",
    country: "FR",
    currency: "EUR",
    currencySymbol: "€",
    lat: 48.8566,
    lng: 2.3522,
    aliases: ["paris", "paris france"],
    transitQuality: "good",
    taxiProviders: [
      { name: "uber", label: "Uber", multiplier: 1.05 },
      { name: "bolt", label: "Bolt", multiplier: 0.9 },
    ],
    transport: {
      baseFare: 4.0,
      ratePerKm: 1.5,
      ratePerMin: 0.4,
      publicTransitDayPass: 8.5,
      publicTransitSingleRide: 2.15,
      fuelPricePerLiter: 1.85,
      avgFuelLitersPerDay: 6,
      parkingFeePerStop: 12,
    },
    food: { breakfast: 14, lunch: 22, dinner: 36 },
    landmarks: [
      {
        name: "Eiffel Tower area",
        lat: 48.8584,
        lng: 2.2945,
        adultPrice: 28,
        openingHours: { open: "09:00", close: "23:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["history", "nature"],
        indoor: false,
      },
      {
        name: "Louvre Museum",
        lat: 48.8606,
        lng: 2.3376,
        adultPrice: 22,
        openingHours: { open: "09:00", close: "18:00" },
        intensity: "high",
        ageTags: ["tween", "teen"],
        interestTags: ["museums", "history"],
        indoor: true,
      },
      {
        name: "Jardin du Luxembourg",
        lat: 48.8462,
        lng: 2.3372,
        adultPrice: 0,
        openingHours: { open: "07:30", close: "20:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["parks", "playgrounds"],
        indoor: false,
      },
      {
        name: "Montmartre",
        lat: 48.8867,
        lng: 2.3431,
        adultPrice: 0,
        openingHours: { open: "08:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["history", "shopping", "nature"],
        indoor: false,
      },
      {
        name: "Cité des Sciences",
        lat: 48.8956,
        lng: 2.3882,
        adultPrice: 12,
        openingHours: { open: "10:00", close: "18:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["interactive", "museums"],
        indoor: true,
      },
      {
        name: "Jardin d'Acclimatation",
        lat: 48.8775,
        lng: 2.2635,
        adultPrice: 7,
        openingHours: { open: "10:00", close: "18:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["theme-parks", "parks", "playgrounds"],
        indoor: false,
      },
    ],
  },
  {
    id: "london",
    name: "London",
    country: "GB",
    currency: "GBP",
    currencySymbol: "£",
    lat: 51.5074,
    lng: -0.1278,
    aliases: ["london", "london uk", "london england"],
    transitQuality: "good",
    taxiProviders: [
      { name: "uber", label: "Uber", multiplier: 1.0 },
      { name: "bolt", label: "Bolt", multiplier: 0.92 },
    ],
    transport: {
      baseFare: 4.5,
      ratePerKm: 1.8,
      ratePerMin: 0.45,
      publicTransitDayPass: 10,
      publicTransitSingleRide: 2.8,
      fuelPricePerLiter: 1.55,
      avgFuelLitersPerDay: 7,
      parkingFeePerStop: 8,
    },
    food: { breakfast: 14, lunch: 20, dinner: 34 },
    landmarks: [
      {
        name: "Hyde Park",
        lat: 51.5073,
        lng: -0.1657,
        adultPrice: 0,
        openingHours: { open: "05:00", close: "22:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "playgrounds", "nature"],
        indoor: false,
      },
      {
        name: "Natural History Museum",
        lat: 51.4967,
        lng: -0.1764,
        adultPrice: 0,
        openingHours: { open: "10:00", close: "17:50" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["museums", "interactive"],
        indoor: true,
      },
      {
        name: "Tower of London",
        lat: 51.5081,
        lng: -0.0759,
        adultPrice: 34,
        openingHours: { open: "09:00", close: "17:30" },
        intensity: "high",
        ageTags: ["tween", "teen"],
        interestTags: ["history", "museums"],
        indoor: false,
      },
      {
        name: "London Eye",
        lat: 51.5033,
        lng: -0.1196,
        adultPrice: 36,
        openingHours: { open: "10:00", close: "20:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["entertainment", "nature"],
        indoor: true,
      },
      {
        name: "Science Museum",
        lat: 51.4973,
        lng: -0.1744,
        adultPrice: 0,
        openingHours: { open: "10:00", close: "18:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["interactive", "museums"],
        indoor: true,
      },
      {
        name: "Diana Memorial Playground",
        lat: 51.5085,
        lng: -0.1875,
        adultPrice: 0,
        openingHours: { open: "10:00", close: "18:00" },
        intensity: "low",
        ageTags: ["toddler", "child"],
        interestTags: ["playgrounds", "parks"],
        indoor: false,
      },
      {
        name: "Gambado Chelsea Soft Play",
        lat: 51.4825,
        lng: -0.1795,
        adultPrice: 14,
        openingHours: { open: "09:30", close: "18:00" },
        intensity: "high",
        ageTags: ["toddler", "child"],
        interestTags: ["indoor-play", "playgrounds", "entertainment"],
        indoor: true,
      },
      {
        name: "London Zoo",
        lat: 51.5353,
        lng: -0.1534,
        adultPrice: 35,
        openingHours: { open: "10:00", close: "17:00" },
        intensity: "high",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["zoos"],
        indoor: false,
      },
      {
        name: "SEA LIFE London Aquarium",
        lat: 51.5018,
        lng: -0.1197,
        adultPrice: 32,
        openingHours: { open: "10:00", close: "17:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["zoos", "interactive"],
        indoor: true,
      },
      {
        name: "Borough Market",
        lat: 51.5055,
        lng: -0.091,
        adultPrice: 0,
        openingHours: { open: "10:00", close: "17:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["food-markets", "shopping"],
        indoor: false,
      },
      {
        name: "Greenwich Park",
        lat: 51.4769,
        lng: -0.0005,
        adultPrice: 0,
        openingHours: { open: "06:00", close: "21:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "nature", "history", "playgrounds"],
        indoor: false,
      },
      {
        name: "Queen Elizabeth Olympic Park",
        lat: 51.5434,
        lng: -0.0165,
        adultPrice: 0,
        openingHours: { open: "06:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["parks", "sports", "entertainment"],
        indoor: false,
      },
      {
        name: "Coram's Fields",
        lat: 51.5242,
        lng: -0.12,
        adultPrice: 0,
        openingHours: { open: "09:00", close: "19:00" },
        intensity: "low",
        ageTags: ["toddler", "child"],
        interestTags: ["playgrounds", "parks"],
        indoor: false,
      },
    ],
  },
  {
    id: "tel-aviv",
    name: "Tel Aviv",
    country: "IL",
    currency: "ILS",
    currencySymbol: "₪",
    lat: 32.0853,
    lng: 34.7818,
    aliases: ["tel aviv", "tel aviv israel"],
    transitQuality: "good",
    taxiProviders: [
      { name: "gett", label: "Gett", multiplier: 1.0 },
      { name: "uber", label: "Uber", multiplier: 1.08 },
    ],
    transport: {
      baseFare: 12,
      ratePerKm: 4.2,
      ratePerMin: 1.1,
      publicTransitDayPass: 24,
      publicTransitSingleRide: 6,
      fuelPricePerLiter: 7.2,
      avgFuelLitersPerDay: 6,
      parkingFeePerStop: 25,
    },
    food: { breakfast: 50, lunch: 75, dinner: 125 },
    landmarks: [
      {
        name: "Tel Aviv Beach",
        lat: 32.08,
        lng: 34.77,
        adultPrice: 0,
        openingHours: { open: "06:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["beaches", "sports"],
        indoor: false,
      },
      {
        name: "Sarona Market",
        lat: 32.0722,
        lng: 34.7868,
        adultPrice: 0,
        openingHours: { open: "09:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["food-markets", "shopping"],
        indoor: true,
      },
      {
        name: "Park Hayarkon",
        lat: 32.1,
        lng: 34.8,
        adultPrice: 0,
        openingHours: { open: "06:00", close: "21:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["parks", "playgrounds", "nature"],
        indoor: false,
      },
      {
        name: "Jaffa Old City",
        lat: 32.0533,
        lng: 34.7522,
        adultPrice: 0,
        openingHours: { open: "08:00", close: "22:00" },
        intensity: "medium",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["history", "shopping"],
        indoor: false,
      },
      {
        name: "Tel Aviv Museum of Art",
        lat: 32.0775,
        lng: 34.7868,
        adultPrice: 50,
        openingHours: { open: "10:00", close: "18:00" },
        intensity: "medium",
        ageTags: ["tween", "teen"],
        interestTags: ["museums"],
        indoor: true,
      },
      {
        name: "Tel Aviv Port",
        lat: 32.0965,
        lng: 34.7745,
        adultPrice: 0,
        openingHours: { open: "08:00", close: "23:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["beaches", "shopping", "entertainment"],
        indoor: false,
      },
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "JP",
    currency: "JPY",
    currencySymbol: "¥",
    lat: 35.6762,
    lng: 139.6503,
    aliases: ["tokyo", "tokyo japan"],
    transitQuality: "good",
    taxiProviders: [{ name: "uber", label: "Uber", multiplier: 1.15 }],
    transport: {
      baseFare: 500,
      ratePerKm: 350,
      ratePerMin: 80,
      publicTransitDayPass: 900,
      publicTransitSingleRide: 210,
      fuelPricePerLiter: 170,
      avgFuelLitersPerDay: 5,
      parkingFeePerStop: 800,
    },
    food: { breakfast: 900, lunch: 1400, dinner: 2800 },
    landmarks: [
      {
        name: "Ueno Park",
        lat: 35.7142,
        lng: 139.7745,
        adultPrice: 0,
        openingHours: { open: "05:00", close: "23:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "museums"],
        indoor: false,
      },
      {
        name: "TeamLab Planets",
        lat: 35.6492,
        lng: 139.7896,
        adultPrice: 3800,
        openingHours: { open: "09:00", close: "22:00" },
        intensity: "high",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["interactive", "museums", "entertainment"],
        indoor: true,
      },
      {
        name: "Senso-ji Temple",
        lat: 35.7148,
        lng: 139.7967,
        adultPrice: 0,
        openingHours: { open: "06:00", close: "17:00" },
        intensity: "medium",
        ageTags: ["tween", "teen"],
        interestTags: ["history", "shopping"],
        indoor: false,
      },
      {
        name: "Shibuya Crossing",
        lat: 35.6595,
        lng: 139.7004,
        adultPrice: 0,
        openingHours: { open: "00:00", close: "23:59" },
        intensity: "high",
        ageTags: ["teen"],
        interestTags: ["shopping", "entertainment"],
        indoor: false,
      },
      {
        name: "Ueno Zoo",
        lat: 35.7155,
        lng: 139.7712,
        adultPrice: 600,
        openingHours: { open: "09:30", close: "17:00" },
        intensity: "medium",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["zoos"],
        indoor: false,
      },
      {
        name: "KidZania Tokyo",
        lat: 35.6565,
        lng: 139.7935,
        adultPrice: 4200,
        openingHours: { open: "09:00", close: "17:00" },
        intensity: "high",
        ageTags: ["toddler", "child", "tween"],
        interestTags: ["interactive", "theme-parks"],
        indoor: true,
      },
    ],
  },
];

export const DEFAULT_CITY: CityConfig = {
  id: "default",
  name: "Your destination",
  country: "US",
  currency: "USD",
  currencySymbol: "$",
  lat: 40.7128,
  lng: -74.006,
  aliases: [],
  transitQuality: "none",
  taxiProviders: [
    { name: "uber", label: "Taxi", multiplier: 1.0 },
    { name: "lyft", label: "Taxi", multiplier: 0.95 },
  ],
  transport: {
    baseFare: 2.5,
    ratePerKm: 0.2,
    ratePerMin: 0.9,
    publicTransitDayPass: 8,
    publicTransitSingleRide: 3,
    fuelPricePerLiter: 1.2,
    avgFuelLitersPerDay: 7,
    parkingFeePerStop: 8,
  },
  food: { breakfast: 18, lunch: 24, dinner: 38 },
  landmarks: [
    {
      name: "City Center Park",
      lat: 40.7128,
      lng: -74.006,
      adultPrice: 0,
      openingHours: { open: "06:00", close: "21:00" },
      intensity: "low",
      ageTags: ["toddler", "child", "tween", "teen"],
      interestTags: ["parks", "playgrounds"],
      indoor: false,
    },
    {
      name: "Family Museum",
      lat: 40.72,
      lng: -74.01,
      adultPrice: 25,
      openingHours: { open: "10:00", close: "17:00" },
      intensity: "medium",
      ageTags: ["toddler", "child", "tween"],
      interestTags: ["museums", "interactive"],
      indoor: true,
    },
    {
      name: "Waterfront Promenade",
      lat: 40.705,
      lng: -74.0,
      adultPrice: 0,
      openingHours: { open: "06:00", close: "22:00" },
      intensity: "low",
      ageTags: ["child", "tween", "teen"],
      interestTags: ["beaches", "nature"],
      indoor: false,
    },
    {
      name: "Local Market",
      lat: 40.718,
      lng: -74.005,
      adultPrice: 0,
      openingHours: { open: "09:00", close: "20:00" },
      intensity: "medium",
      ageTags: ["child", "tween", "teen"],
      interestTags: ["food-markets", "shopping"],
      indoor: true,
    },
    {
      name: "City History Tower",
      lat: 40.708,
      lng: -74.012,
      adultPrice: 18,
      openingHours: { open: "10:00", close: "18:00" },
      intensity: "medium",
      ageTags: ["tween", "teen"],
      interestTags: ["history", "museums"],
      indoor: true,
    },
    {
      name: "Adventure Play Yard",
      lat: 40.716,
      lng: -74.002,
      adultPrice: 0,
      openingHours: { open: "08:00", close: "19:00" },
      intensity: "low",
      ageTags: ["toddler", "child"],
      interestTags: ["playgrounds", "parks"],
      indoor: false,
    },
  ],
};
