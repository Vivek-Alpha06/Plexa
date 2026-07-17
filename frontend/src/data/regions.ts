// ROSCA usage around the world. Figures sourced from public reporting/research
// (see `sources` below) — they are widely-cited estimates, not live feeds.

export interface Region {
  id: string;
  country: string;
  term: string; // local name for a ROSCA
  lat: number;
  lng: number;
  stat: string; // punchy headline number
  statLabel: string;
  detail: string;
}

export const REGIONS: Region[] = [
  {
    id: "india",
    country: "India",
    term: "Chit Fund",
    lat: 20.6,
    lng: 78.9,
    stat: "₹35,000 Cr",
    statLabel: "registered industry (~$4.2B)",
    detail:
      "Known as chit fund or kuri. 5M+ registered subscribers — and the informal market is estimated to be ~100× larger than the registered one.",
  },
  {
    id: "south-africa",
    country: "South Africa",
    term: "Stokvel",
    lat: -29.0,
    lng: 24.0,
    stat: "11M members",
    statLabel: "~R50B (~$2.7B) saved / year",
    detail:
      "Over 810,000 stokvels — roughly a quarter of all South African adults — pool more than R50 billion a year, larger than the agriculture sector.",
  },
  {
    id: "china",
    country: "China",
    term: "Hui · 合会",
    lat: 30.0,
    lng: 112.0,
    stat: "Since 200 BCE",
    statLabel: "2,200+ years of hui",
    detail:
      "Documented in China around 200 BCE. In regions like Wenzhou, Fujian and Guangdong the majority of people belong to one or more hui; Taiwan studies found up to 85% of households participating.",
  },
  {
    id: "west-africa",
    country: "West Africa",
    term: "Susu · Esusu",
    lat: 8.0,
    lng: -1.0,
    stat: "+27% businesses",
    statLabel: "small-business ownership vs. non-members",
    detail:
      "Susu in Ghana, esusu/ajo in Nigeria. Trust-based circles that measurably lift home, car and small-business ownership for participants and the diaspora.",
  },
  {
    id: "mexico",
    country: "Mexico & LatAm",
    term: "Tanda · Cundina",
    lat: 23.0,
    lng: -102.0,
    stat: "Millions",
    statLabel: "across Latin America",
    detail:
      "Tandas and cundinas run the identical model across Mexico and Latin America — interest-free, collateral-free lump sums for weddings, businesses and emergencies.",
  },
];

export const GLOBAL_STATS = [
  { value: "1,000+", label: "years communities have run ROSCAs" },
  { value: "Billions", label: "of people have used one — by some name" },
  { value: "6 continents", label: "same idea, dozens of names" },
  { value: "$0", label: "of it was trustless & on-chain — until Plexa" },
];

export const SOURCES = [
  { label: "India chit funds — Accion / Deccan Herald", url: "https://www.accion.org/article/fintech-transforming-indias-chit-fund-industry-inclusive-finance/" },
  { label: "South Africa stokvels — Ipsos / UNSGSA", url: "https://www.ipsos.com/en-za/stokvels-remain-untapped-human-banks-south-africa" },
  { label: "China hui (prewar ROSCAs) — Economic History Review", url: "https://onlinelibrary.wiley.com/doi/10.1111/ehr.13297" },
  { label: "Susu / esusu / tanda — Wikipedia (ROSCA)", url: "https://en.wikipedia.org/wiki/Rotating_savings_and_credit_association" },
];
