import { EGE_OVERLAY } from "./ege";
import { ISTANBUL_OVERLAY, KAPADOKYA_OVERLAY } from "./others";
import { EMPTY_OVERLAY, type RegionOverlay } from "./types";

const OVERLAYS: Record<string, RegionOverlay> = {
  ege: EGE_OVERLAY,
  kapadokya: KAPADOKYA_OVERLAY,
  "istanbul-tarihi": ISTANBUL_OVERLAY,
};

export function overlayFor(regionId: string): RegionOverlay {
  return OVERLAYS[regionId] ?? EMPTY_OVERLAY;
}
