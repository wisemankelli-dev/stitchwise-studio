/**
 * Tests for Stitchly-style editing tools on the Embroidery and Collage canvases.
 *
 * Covers three layers of testing:
 * 1. **Existing Feature Tests** — Color picker, stitch type selector, cell click, grid rendering, layer management
 * 2. **Planned Editing Tool Specs** (in describe.skip) — Mirror, Erase, Clone, Color Picker/Eyedropper, Paint Brush
 * 3. **Toolbar UI Tests** — Tool rendering, active state, switching
 *
 * Style: Vitest + React Testing Library (following existing patterns).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Designer } from "../pages/Designer";
import StitchGrid, { DmcLegend, type StitchGridData } from "../components/StitchGrid";
import { CollageStudio } from "../pages/CollageStudio";

// =============================================================================
// 1. EXISTING FEATURE TESTS — Color Picker, Stitch Selector, Cell Click, Grid
// =============================================================================

describe("Designer — Color Picker", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  const renderDesigner = () => {
    return render(
      <BrowserRouter>
        <Designer />
      </BrowserRouter>
    );
  };

  it("renders the Designer Thread Color section with color buttons", () => {
    renderDesigner();
    expect(screen.getByText("Active Thread Color")).toBeInTheDocument();
    // Should have 7 color buttons (from COLORS array)
    const colorButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("title") && btn.className.includes("rounded-full")
    );
    // The color selector buttons have titles like "Rose Red", "Sunset Gold", etc.
    expect(screen.getByTitle("Rose Red")).toBeInTheDocument();
    expect(screen.getByTitle("Forest Green")).toBeInTheDocument();
    expect(screen.getByTitle("Ocean Blue")).toBeInTheDocument();
  });

  it("highlights the selected color with a white dot indicator", () => {
    renderDesigner();
    // Rose Red should be the default selected color
    const roseRed = screen.getByTitle("Rose Red");
    expect(roseRed).toBeInTheDocument();
    // Clicking a different color updates selection
    const forestGreen = screen.getByTitle("Forest Green");
    fireEvent.click(forestGreen);
    // The clicked button should now show the selection indicator
    expect(forestGreen.querySelector("span")).toBeTruthy();
  });
});

describe("Designer — Stitch Type Selector", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderDesigner = () => {
    return render(
      <BrowserRouter>
        <Designer />
      </BrowserRouter>
    );
  };

  it("renders the Stitch Style section with all stitch types", () => {
    renderDesigner();
    expect(screen.getByText("Stitch Style")).toBeInTheDocument();
    expect(screen.getByText("Cross Stitch")).toBeInTheDocument();
    expect(screen.getByText("Satin Stitch")).toBeInTheDocument();
    expect(screen.getByText("Back Stitch")).toBeInTheDocument();
    expect(screen.getByText("French Knot")).toBeInTheDocument();
  });

  it("highlights the selected stitch type", () => {
    renderDesigner();
    // Cross Stitch is the default
    const crossBtn = screen.getByText("Cross Stitch").closest("button");
    expect(crossBtn?.className).toContain("border-blush-600");

    // Click Satin Stitch
    const satinBtn = screen.getByText("Satin Stitch").closest("button")!;
    fireEvent.click(satinBtn);
    expect(satinBtn.className).toContain("border-blush-600");
  });

  it("shows description text for each stitch type", () => {
    renderDesigner();
    expect(screen.getByText("Traditional X-shaped intersection")).toBeInTheDocument();
    expect(screen.getByText("Flat, glossy parallel stitches")).toBeInTheDocument();
    expect(screen.getByText("Perfect for outlining fine borders")).toBeInTheDocument();
    expect(screen.getByText("Raised, textured point details")).toBeInTheDocument();
  });
});

describe("StitchGrid — Cell Rendering", () => {
  const mockGridData: StitchGridData = {
    grid: [
      [
        { row: 0, col: 0, color: "#e11d48", dmcCode: "321", stitchType: "cross" },
        { row: 0, col: 1, color: "", stitchType: "cross" },
      ],
      [
        { row: 1, col: 0, color: "#16a34a", dmcCode: "700", stitchType: "satin" },
        { row: 1, col: 1, color: "#0284c7", dmcCode: "996", stitchType: "back" },
      ],
    ],
    width: 2,
    height: 2,
    dmcPalette: [
      { code: "321", name: "Christmas Red", hex: "#e11d48", count: 1 },
      { code: "700", name: "Bright Green", hex: "#16a34a", count: 1 },
      { code: "996", name: "Electric Blue", hex: "#0284c7", count: 1 },
    ],
    totalStitches: 3,
  };

  it("renders a grid with correct dimensions", () => {
    const { container } = render(<StitchGrid data={mockGridData} zoom={1} />);
    // The grid container should exist
    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).toBeInTheDocument();
    // Grid should have 4 cells (2x2)
    const cells = screen.getAllByRole("button");
    expect(cells.length).toBe(4);
  });

  it("renders filled cells with color backgrounds", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    // Filled cells should have the correct background color
    const cells = screen.getAllByRole("button");
    expect(cells.length).toBe(4); // 2x2 grid

    // Check tooltip for cell (0,0) — should show DMC code
    expect(cells[0].getAttribute("title")).toContain("321");
  });

  it("renders empty cells with a dot indicator", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const cells = screen.getAllByRole("button");
    // Cell (0,1) is empty — should have a small dot
    const emptyCell = cells[1];
    expect(emptyCell.querySelector("span")).toBeTruthy();
  });

  it("calls onCellClick when a cell is clicked", () => {
    const handleClick = vi.fn();
    render(<StitchGrid data={mockGridData} zoom={1} onCellClick={handleClick} />);
    const cells = screen.getAllByRole("button");

    fireEvent.click(cells[0]);
    expect(handleClick).toHaveBeenCalledWith(0, 0);
  });

  it("renders stitch type visual indicators", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const cells = screen.getAllByRole("button");

    // Cross stitch cell (0,0) should show "X"
    expect(cells[0].textContent).toContain("X");

    // Satin stitch cell (1,0) should show "|||"
    expect(cells[2].textContent).toContain("|||");

    // Back stitch cell (1,1) should show "—"
    expect(cells[3].textContent).toContain("─");
  });

  it("applies zoom scaling to cell size", () => {
    const { container, rerender } = render(<StitchGrid data={mockGridData} zoom={1} />);
    const gridAtZoom1 = container.querySelector(".grid");
    const widthAtZoom1 = gridAtZoom1?.getAttribute("style");

    rerender(<StitchGrid data={mockGridData} zoom={2} />);
    const gridAtZoom2 = container.querySelector(".grid");
    const widthAtZoom2 = gridAtZoom2?.getAttribute("style");

    // Zoom 2 should have larger cells than zoom 1
    expect(widthAtZoom1).not.toBe(widthAtZoom2);
  });
});

describe("DmcLegend — Thread Palette Display", () => {
  const palette = [
    { code: "321", name: "Christmas Red", hex: "#e11d48", count: 5 },
    { code: "700", name: "Bright Green", hex: "#16a34a", count: 3 },
    { code: "310", name: "Black", hex: "#000000", count: 10 },
  ];

  it("renders the DMC palette header", () => {
    render(<DmcLegend palette={palette} />);
    expect(screen.getByText("DMC Thread Palette")).toBeInTheDocument();
  });

  it("displays all DMC colors with codes and counts", () => {
    render(<DmcLegend palette={palette} />);
    expect(screen.getByText("321")).toBeInTheDocument();
    expect(screen.getByText("700")).toBeInTheDocument();
    expect(screen.getByText("310")).toBeInTheDocument();
    expect(screen.getByText("×5")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByText("×10")).toBeInTheDocument();
  });

  it("shows DMC color names", () => {
    render(<DmcLegend palette={palette} />);
    expect(screen.getByText("Christmas Red")).toBeInTheDocument();
    expect(screen.getByText("Bright Green")).toBeInTheDocument();
    expect(screen.getByText("Black")).toBeInTheDocument();
  });
});

describe("Designer — Cell Click & Grid Interaction", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderDesigner = () => {
    return render(
      <BrowserRouter>
        <Designer />
      </BrowserRouter>
    );
  };

  it("renders the Embroidery Canvas section", () => {
    renderDesigner();
    expect(screen.getByText("Embroidery Canvas")).toBeInTheDocument();
    expect(screen.getByText("Your canvas is empty")).toBeInTheDocument();
  });

  it("shows grid size information", () => {
    renderDesigner();
    expect(screen.getByText("32x32 Grid")).toBeInTheDocument();
  });

  it("has zoom controls", () => {
    renderDesigner();
    // Zoom buttons should be present
    const zoomOut = screen.getByText("100%");
    expect(zoomOut).toBeInTheDocument();
  });

  it("displays zero stitches initially", () => {
    renderDesigner();
    expect(screen.getByText("0 stitches")).toBeInTheDocument();
  });

  it("has a Reset button to clear the grid", () => {
    renderDesigner();
    const resetBtn = screen.getByText("Reset");
    expect(resetBtn).toBeInTheDocument();
  });
});

describe("CollageStudio — Existing Layer Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderCollageStudio = () => {
    return render(
      <BrowserRouter>
        <CollageStudio />
      </BrowserRouter>
    );
  };

  it("renders the Collage Studio header", () => {
    renderCollageStudio();
    expect(screen.getByText("Collage Studio")).toBeInTheDocument();
  });

  it("renders the Layers panel with default layers", () => {
    renderCollageStudio();
    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(screen.getByText(/Base Fabric/)).toBeInTheDocument();
    // These layer names appear multiple times (in layer list and canvas labels),
    // so use getAllByText and check at least one exists
    expect(screen.getAllByText(/Petal Shape/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Leaf Accent/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Center Bloom/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows layer count in the canvas toolbar", () => {
    renderCollageStudio();
    expect(screen.getByText("4 layers")).toBeInTheDocument();
  });

  it("adds a new layer when the + button is clicked", () => {
    renderCollageStudio();
    const addButtons = screen.getAllByRole("button");
    // Find the plus button in the Layers panel header
    const addLayerBtn = screen.getByText("Layers").closest("div")?.querySelector("button");
    fireEvent.click(addLayerBtn!);
    // Should now show 5 layers
    expect(screen.getByText("5 layers")).toBeInTheDocument();
  });

  it("deletes a layer when the trash icon is clicked", () => {
    renderCollageStudio();
    // Find and click the delete button for "Petal Shape" (the first non-base layer)
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash2")
    );
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      // Should now show 3 layers
      expect(screen.getByText("3 layers")).toBeInTheDocument();
    }
  });

  it("renders the Inspector panel when a layer is selected", () => {
    renderCollageStudio();
    // Center Bloom should be selected by default - appears multiple times
    expect(screen.getAllByText(/Center Bloom/).length).toBeGreaterThanOrEqual(1);
    // Inspector panel should show color options
    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Texture")).toBeInTheDocument();
  });

  it("has color swatches in the inspector", () => {
    renderCollageStudio();
    // Color section should have clickable color swatches
    const colorSection = screen.getByText("Color").closest("div");
    expect(colorSection).toBeInTheDocument();
  });

  it("has texture selection options", () => {
    renderCollageStudio();
    expect(screen.getByText("Solid Cotton")).toBeInTheDocument();
    expect(screen.getByText("Linen Weave")).toBeInTheDocument();
    expect(screen.getByText("Polka Dot")).toBeInTheDocument();
    expect(screen.getByText("Striped")).toBeInTheDocument();
    expect(screen.getByText("Plaid")).toBeInTheDocument();
  });

  it("has transform controls (width, height, rotate, opacity)", () => {
    renderCollageStudio();
    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.getByText("Height")).toBeInTheDocument();
    expect(screen.getByText("Rotate")).toBeInTheDocument();
    expect(screen.getByText("Opacity")).toBeInTheDocument();
  });

  it("prevents deleting the last remaining layer", () => {
    renderCollageStudio();
    // Delete all non-base layers
    for (let i = 0; i < 5; i++) {
      const deleteButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash2")
      );
      if (deleteButtons.length === 0) break;
      fireEvent.click(deleteButtons[0]);
    }
    // Base layer should remain
    expect(screen.getByText("Base Fabric")).toBeInTheDocument();
  });
});

// =============================================================================
// 2. PLANNED EDITING TOOL SPECS — Mirror, Erase, Clone, Color Picker, Paint
// =============================================================================
//
// These tests document the expected behavior of Stitchly-style editing tools
// that are still in development. Once the tools are implemented, remove the
// .skip to activate these tests.

describe.skip("Editing Tools — Embroidery Canvas (Designer)", () => {
  describe("Mirror Tool", () => {
    it("horizontally mirrors cell edits across the vertical center axis", () => {
      // When a cell at (x, y) is filled, the cell at (gridSize-1-x, y) should also be filled
      // Test: paint cell at (2, 5) with mirror enabled → cell at (29, 5) should also be painted
    });

    it("vertically mirrors cell edits across the horizontal center axis", () => {
      // When vertical mirror is enabled, painting at (x, y) fills (x, gridSize-1-y)
    });

    it("mirror updates in real-time as cells are painted", () => {
      // Mirror reflection should appear immediately when a cell is painted
    });

    it("mirror works with eraser (mirrored cells also get erased)", () => {
      // Erasing a cell should also erase its mirrored counterpart
    });

    it("mirror toggle button toggles between off/on states", () => {
      // Toolbar button should show active state when mirror is enabled
    });
  });

  describe("Erase Tool", () => {
    it("clicking a filled cell with erase tool clears it", () => {
      // Activate erase tool, click a filled cell → cell becomes empty
    });

    it("dragging across multiple cells erases all of them", () => {
      // Click and drag over multiple cells → all become empty
    });

    it("clicking an empty cell with erase tool does nothing", () => {
      // Erasing an already empty cell should be a no-op
    });

    it("undo restores erased cells", () => {
      // After erasing cells, undo should restore them
    });

    it("erase tool is visually distinct from paint brush", () => {
      // Erase cursor/icon should differ from paint brush
    });
  });

  describe("Clone Tool", () => {
    it("selecting a source area copies cell data", () => {
      // Click and drag to select a rectangular region → region is copied
    });

    it("pasting the cloned area at a different location", () => {
      // After selecting source, click destination → cells are pasted
    });

    it("pasting preserves stitch types of cloned cells", () => {
      // Cloned cells retain their original stitch types (cross, satin, etc.)
    });

    it("pasting at a location that would overflow the grid is clamped", () => {
      // Pasting near the edge should not cause out-of-bounds errors
    });
  });

  describe("Color Picker / Eyedropper Tool", () => {
    it("clicking a cell samples its color as the active color", () => {
      // Activate eyedropper, click a red cell → selectedColor becomes red
    });

    it("active color updates to the sampled color", () => {
      // After sampling, the color indicator in the palette shows the new color
    });

    it("eyedropper works on empty cells (returns background color)", () => {
      // Clicking an empty cell should set color to empty/white
    });
  });

  describe("Paint Brush Tool", () => {
    it("clicking a single cell paints it with the active color", () => {
      // Select a color, click a cell → cell fills with that color
    });

    it("dragging paints multiple cells in a continuous stroke", () => {
      // Click and drag over cells → all cells in the path get painted
    });

    it("painting respects the selected stitch type", () => {
      // When satin stitch is selected, painted cells show satin indicator
    });

    it("re-painting an already painted cell overwrites the color", () => {
      // Paint a cell red, then paint same cell blue → cell should be blue
    });
  });
});

describe.skip("Editing Tools — Collage Canvas (CollageStudio)", () => {
  describe("Mirror Tool (Collage)", () => {
    it("mirrors layer positions horizontally", () => {
      // Mirroring a layer should reflect its x position across the canvas center
    });

    it("mirror tool works on selected layer only", () => {
      // Only the active/selected layer should be mirrored
    });
  });

  describe("Erase Tool (Collage)", () => {
    it("deletes the selected layer", () => {
      // Activate erase tool, click a layer → layer is removed
    });
  });

  describe("Clone Tool (Collage)", () => {
    it("duplicates the selected layer with offset", () => {
      // Clone tool creates a copy of the layer at a slightly offset position
    });

    it("cloned layer appears above the original in z-order", () => {
      // Duplicated layer should have a higher zIndex than the original
    });
  });

  describe("Eyedropper Tool (Collage)", () => {
    it("picks the color from a clicked layer", () => {
      // Activate eyedropper, click a layer → active color updates to match
    });
  });

  describe("Paint Tool (Collage)", () => {
    it("changes the selected layer's color", () => {
      // Activate paint tool, click a layer → layer color changes to active color
    });
  });
});

// =============================================================================
// 3. TOOLBAR UI SPECS — Planned Toolbar Components
// =============================================================================

describe.skip("Toolbar UI — Tool Selection & State", () => {
  describe("Tool Button Rendering", () => {
    it("renders all tool buttons: mirror, erase, clone, eyedropper, paint", () => {
      // Toolbar should have buttons for each editing tool
    });

    it("each tool button has a distinct icon", () => {
      // Mirror icon, Erase icon, Clone icon, Eyedropper icon, Paint icon
    });

    it("tool buttons are accessible (have aria-labels)", () => {
      // Each tool button should have an aria-label for accessibility
    });
  });

  describe("Active Tool State", () => {
    it("only one tool can be active at a time", () => {
      // Selecting a new tool should deselect the previous one
    });

    it("active tool has a visual indicator (highlighted border/background)", () => {
      // The active tool button should have a different style
    });

    it("default tool is paint brush", () => {
      // On initial load, paint brush should be the active tool
    });
  });

  describe("Tool Switching", () => {
    it("switching tools clears the previous tool's state", () => {
      // If erase had a partial selection, switching to paint clears it
    });

    it("keyboard shortcuts work for tool switching", () => {
      // Pressing 'M' activates mirror, 'E' activates erase, etc.
    });
  });
});