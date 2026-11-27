import { compareLabels } from "./data";

// Alphabetical, with the colors (see custom.css) in their order, which is validated for
// color-vision deficiencies between neighbors, e.g. in the stacked chart
export const MODALITIES = [
  { name: "Blockface photo", color: "var(--modality-1)" },
  { name: "Dark-field microscopy", color: "var(--modality-2)" },
  { name: "Diffusion MRI", color: "var(--modality-3)" },
  { name: "HiP-CT", color: "var(--modality-4)" },
  { name: "Light-sheet microscopy", color: "var(--modality-5)" },
  { name: "PS-OCT", color: "var(--modality-6)" },
  { name: "Unknown", color: "var(--modality-unknown)" },
];

export const UNKNOWN_MODALITY = "Unknown";
const FALLBACK_COLOR = "var(--modality-other)";
const ORDER = MODALITIES.map(({ name }) => name);

export function modalityColor(name) {
  return MODALITIES.find((modality) => modality.name === name)?.color ?? FALLBACK_COLOR;
}

// Known modalities in order, then others, with "Unknown" last
export function compareModalities(a, b) {
  const rank = (name) => {
    const index = ORDER.indexOf(name);
    if (name === UNKNOWN_MODALITY) return ORDER.length + 1;
    return index === -1 ? ORDER.length : index;
  };
  return rank(a) - rank(b) || compareLabels(a, b);
}

export function ModalityLegend({ names, className }) {
  return (
    <div className={className} style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 1rem" }}>
      {names.map((name) => (
        <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: 2, background: modalityColor(name), flex: "none" }}
          />
          {name}
        </span>
      ))}
    </div>
  );
}
