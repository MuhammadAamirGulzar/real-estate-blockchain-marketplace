const FALLBACK_IMAGES = [
  "/modern-office-building-manhattan.jpg",
  "/luxury-beach-resort-miami.jpg",
  "/modern-tech-office-building-austin.jpg",
  "/modern-residential-tower-chicago.jpg",
  "/modern-retail-center-la.jpg",
  "/industrial-warehouse-seattle.jpg",
  "/manhattan-office-exterior.jpg",
  "/office-interior-manhattan.jpg",
  "/propertyimage.jpg",
];

function toPublicUrl(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/${trimmed}`;
}

function hashSeed(input) {
  const str = String(input || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPropertyFallbackImages(property, count = 3) {
  const seed = hashSeed(property?.id || property?.title || property?.name);
  const list = [];

  for (let i = 0; i < Math.min(count, FALLBACK_IMAGES.length); i += 1) {
    list.push(FALLBACK_IMAGES[(seed + i) % FALLBACK_IMAGES.length]);
  }

  return list;
}

export function resolvePropertyImages(property, fallbackCount = 3) {
  const source = [
    ...(Array.isArray(property?.images) ? property.images : []),
    property?.imageUrl,
    property?.image,
    property?.heroImage,
    property?.imagePath,
  ];

  const normalized = source
    .map(toPublicUrl)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const fallbacks = getPropertyFallbackImages(property, fallbackCount);
  const merged = [...normalized, ...fallbacks].filter(
    (value, index, arr) => arr.indexOf(value) === index,
  );

  return merged;
}
