export type TaxiProvider = "uber" | "lyft" | "bolt" | "gett";

export type LandmarkAgeTag = "toddler" | "child" | "tween" | "teen";
export type LandmarkIntensity = "low" | "medium" | "high";

/** Wizard interest categories — keep in sync with interest-map label mapping. */
export type LandmarkInterestTag =
  | "parks"
  | "beaches"
  | "nature"
  | "history"
  | "museums"
  | "playgrounds"
  | "zoos"
  | "theme-parks"
  | "interactive"
  | "food-markets"
  | "shopping"
  | "entertainment"
  | "sports"
  | "spas";

/** Simple daily hours — Phase 2 soft validation; weekday variation can come later. */
export type LandmarkOpeningHours = {
  open: string;
  close: string;
};

export type Landmark = {
  name: string;
  lat: number;
  lng: number;
  adultPrice: number;
  openingHours: LandmarkOpeningHours;
  intensity: LandmarkIntensity;
  ageTags: LandmarkAgeTag[];
  /** Wizard interest categories this stop satisfies (FAM-7). */
  interestTags: LandmarkInterestTag[];
  indoor: boolean;
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
  taxiProviders: { name: TaxiProvider; label: string; multiplier: number }[];
  transport: {
    baseFare: number;
    ratePerKm: number;
    ratePerMin: number;
    publicTransitDayPass: number;
    publicTransitSingleRide: number;
    fuelPricePerLiter: number;
    avgFuelLitersPerDay: number;
  };
  food: {
    breakfast: number;
    lunch: number;
    dinner: number;
  };
  landmarks: Landmark[];
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
    taxiProviders: [
      { name: "uber", label: "Uber", multiplier: 1.0 },
      { name: "lyft", label: "Lyft", multiplier: 0.95 },
    ],
    transport: {
      baseFare: 3.5,
      ratePerKm: 1.2,
      ratePerMin: 0.35,
      publicTransitDayPass: 6,
      publicTransitSingleRide: 2.5,
      fuelPricePerLiter: 1.1,
      avgFuelLitersPerDay: 8,
    },
    food: { breakfast: 35, lunch: 55, dinner: 80 },
    landmarks: [
      {
        name: "Balboa Park",
        lat: 32.7341,
        lng: -117.1446,
        adultPrice: 0,
        openingHours: { open: "08:00", close: "20:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "museums", "playgrounds"],
        indoor: false,
      },
      {
        name: "San Diego Zoo",
        lat: 32.7353,
        lng: -117.149,
        adultPrice: 65,
        openingHours: { open: "09:00", close: "17:00" },
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
        adultPrice: 32,
        openingHours: { open: "10:00", close: "17:00" },
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
        openingHours: { open: "10:00", close: "17:00" },
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
        openingHours: { open: "11:00", close: "20:00" },
        intensity: "high",
        ageTags: ["child", "tween", "teen"],
        interestTags: ["theme-parks", "beaches", "entertainment"],
        indoor: false,
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
    },
    food: { breakfast: 30, lunch: 50, dinner: 90 },
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
    },
    food: { breakfast: 32, lunch: 48, dinner: 85 },
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
    },
    food: { breakfast: 90, lunch: 140, dinner: 220 },
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
    taxiProviders: [{ name: "uber", label: "Uber", multiplier: 1.15 }],
    transport: {
      baseFare: 500,
      ratePerKm: 350,
      ratePerMin: 80,
      publicTransitDayPass: 900,
      publicTransitSingleRide: 210,
      fuelPricePerLiter: 170,
      avgFuelLitersPerDay: 5,
    },
    food: { breakfast: 2500, lunch: 4000, dinner: 6000 },
    landmarks: [
      {
        name: "Ueno Park",
        lat: 35.7142,
        lng: 139.7745,
        adultPrice: 0,
        openingHours: { open: "05:00", close: "23:00" },
        intensity: "low",
        ageTags: ["toddler", "child", "tween", "teen"],
        interestTags: ["parks", "zoos", "museums"],
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
  taxiProviders: [
    { name: "uber", label: "Uber", multiplier: 1.0 },
    { name: "lyft", label: "Lyft", multiplier: 0.95 },
  ],
  transport: {
    baseFare: 3.0,
    ratePerKm: 1.1,
    ratePerMin: 0.3,
    publicTransitDayPass: 8,
    publicTransitSingleRide: 3,
    fuelPricePerLiter: 1.2,
    avgFuelLitersPerDay: 7,
  },
  food: { breakfast: 30, lunch: 50, dinner: 75 },
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
