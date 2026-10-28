// Fallback IATA codes for when the model returns a city without a code.
const CITY_TO_IATA: Record<string, string> = {
  mumbai: "BOM",
  bombay: "BOM",
  bengaluru: "BLR",
  bangalore: "BLR",
  delhi: "DEL",
  "new delhi": "DEL",
  goa: "GOI",
  chennai: "MAA",
  hyderabad: "HYD",
  kolkata: "CCU",
  pune: "PNQ",
  ahmedabad: "AMD",
  jaipur: "JAI",
  kochi: "COK",
  london: "LHR",
  dubai: "DXB",
  singapore: "SIN",
  "new york": "JFK",
};

export function toIata(code: string | null | undefined, city: string | null | undefined) {
  if (code && /^[A-Z]{3}$/.test(code)) return code;
  const key = (city ?? "").toLowerCase().trim();
  return CITY_TO_IATA[key] ?? null;
}
