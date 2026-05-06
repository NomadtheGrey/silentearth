# Silent Earth: World Design Worksheet

This document serves as the shared direction for the "Silent Earth" project. It tracks design philosophy, world mechanics, and terminology to ensure consistency.

## 1. Aesthetic Philosophy: "The Whispering Wilds"
*   **Temperate & Overgrown:** A focus on deep greens, muted earth tones, and the dappled light of a dense forest canopy.
*   **Tactile Sound:** The sound of snapping dry wood, the squelch of mossy mud, and the rush of distant water.
*   **Brutalist UI:** Sharp edges, mono fonts, and high-density information arrays, contrasting with the chaotic organic nature of the forest.

## 2. Terminology & Taxonomy
*   **The Silent Wilds:** A temperate, high-humidity forest characterized by its lack of large-scale animal noise and its dense, moss-heavy floor.
*   **Terrain Classifications (Tiles):**
    *   **Dense Thicket:** Standard forest floor with high brush density. Source of kindling and fiber.
    *   **Damp Hollow:** Wet, low-lying basins where organic matter collects. High yield for Moss and Peat.
    *   **Tangled Deepwood:** The oldest parts of the forest. Massive, gnarled roots and heavy Oak.
    *   **Shallow Creek:** Thick, winding waterways. Primary source of Silt, Stone, and Bone fragments.
    *   **Mineral Crust:** Dry, chalky shelves of salt and bone-dust. High resonance.
*   **The Resonance:** The ambient "spirit" or atmospheric pressure of the wilds. High resonance correlates with denser fog and heightened sensory feedback.

## 3. Core Mechanics
*   **Procedural Generation (Simplex Architecture):** The Silent Wilds is generated using multi-layered Simplex Noise. This provides smooth, continuous terrain flow while maintaining the "patchy" untamed look.
*   **Whittaker-Inspired Biomes:** Tiles are assigned based on intersecting noise values (Moisture vs Elevation).
*   **Warped & Eroded Waterways (Option #1):** Creeks are no longer simple mathematical lines. They use **Domain Warping** (shifting noise space with other noise) to create organic, irregular paths and avoid parallel artifacts.
*   **Topographical Flow:** Water placement is biased byElevation; creeks naturally gravitate towards valleys (low-noise zones) and thin out in the "uplands."
*   **Mineral "Salt" Layer:** New tile type appearing at moisture-boundary intersections where rugged terrain occurs.
*   **Tool Gating:** Refining materials requires a **Garden Trowel** (for silt/clay) or a **Hand-Axe** (for heavy timbers).
*   **Resonant Harvesting:** Certain items (Oak, Vines) require multiple steps (Tug, Stomp) to harvest.
*   **Structural Anchoring:** Larger builds (Cottages) require proximity to an **Old Stump** (Workstation).

## 4. Planned Expansions & Vision Discussions
*   **[ ] Fog of War:** Discussing how visibility should be restricted in dense brush.
*   **[ ] Dynamic Weather:** Implementing "Grey Rain" or "Thick Fog".
*   **[ ] Passive Wildlife:** Small forest creatures (Lichen-Crabs, Silt-Hoppers).
*   **[ ] Discovery Sites:** Ancient Monoliths and Sunken Altars.
*   **[ ] Advanced Fluids:** Adding ripple effects and flow direction to the Shallow Creeks.
