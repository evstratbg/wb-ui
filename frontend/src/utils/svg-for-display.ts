// Legacy dashboards use SVG width="auto"; let CSS size these without invalid attributes.
export const svgForDisplay = (source: string) => (source || '').replace(
  /<svg\b[^>]*>/i,
  (root) => root.replace(/\s+(?:width|height)\s*=\s*(["'])\s*auto\s*\1/gi, ''),
);
