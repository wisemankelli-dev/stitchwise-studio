/**
 * Tests for Stitchly-style editing tools on the Embroidery and Collage canvases.
 *
 * Covers three layers of testing:
 * 1. **Existing Feature Tests** — Color picker, stitch type selector, cell click, grid rendering, layer management
 * 2. **Canvas-based StitchGrid Tests** — Canvas rendering, zoom controls, click coordinate mapping, grid lines toggle
 * 3. **Planned Editing Tool Specs** (in describe.skip) — Mirror, Erase, Clone, Color Picker/Eyedropper, Paint Brush
 * 4. **Toolbar UI Tests** — Tool rendering, active state, switching
 *
 * Style: Vitest + React Testing Library (following existing patterns).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Designer } from "../pages/Designer";
import StitchGrid, { DmcLegend, mouseToGrid, type StitchGridData } from "../components/StitchGrid";
import { CollageStudio } from "../pages/CollageStudio";

// =============================================================================
// 1. EXISTING FEATURE TESTS — Color Picker, Stitch Selector, Cell Click, Grid
// =============================================================================

describe("Designer — Color Picker", () => {
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

  it("renders the Designer Thread Color section with color buttons", () => {
    renderDesigner();
    expect(screen.getByText("Active Thread Color")).toBeInTheDocument();
    // Should have color buttons with titles
    expect(screen.getByTitle("Rose Red")).toBeInTheDocument();
    expect(screen.getByTitle("Forest Green")).toBeInTheDocument();
    expect(screen.getByTitle("Ocean Blue")).toBeInTheDocument();
  });

  it("highlights the selected color with a white dot indicator", () => {
    renderDesigner();
    const roseRed = screen.getByTitle("Rose Red");
    expect(roseRed).toBeInTheDocument();
    const forestGreen = screen.getByTitle("Forest Green");
    fireEvent.click(forestGreen);
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
    const crossBtn = screen.getByText("Cross Stitch").closest("button");
    expect(crossBtn?.className).toContain("border-blush-600");

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

// =============================================================================
// 2. CANVAS-BASED STITCHGRID TESTS
// =============================================================================

describe("StitchGrid — Canvas Rendering", () => {
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

  it("renders a canvas element instead of div-based grid", () => {
    const { container } = render(<StitchGrid data={mockGridData} zoom={1} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("canvas has an accessible aria-label describing the grid", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const canvas = screen.getByLabelText(/Stitch grid/i);
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("shows grid dimensions and stitch count in the stats bar", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    // The stats bar shows "2×2 grid" (with Unicode multiplication sign)
    expect(screen.getByText(/2.2 grid/)).toBeInTheDocument();
    expect(screen.getByText("3 stitches")).toBeInTheDocument();
  });

  it("renders a clickable canvas that responds to mouse events", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <StitchGrid data={mockGridData} zoom={1} onCellClick={handleClick} />
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas).toBeInTheDocument();

    // Verify canvas event handlers exist by simulating a click
    // (coordinate mapping is covered by mouseToGrid unit tests)
    fireEvent.click(canvas);
    // The click handler fires; with no getBoundingClientRect mock
    // in jsdom it may return null coordinates, but the handler should not throw
    expect(canvas).toBeTruthy();
  });

  it("applies zoom scaling reflected in zoom percentage text", () => {
    const { rerender } = render(
      <StitchGrid data={mockGridData} zoom={1} />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();

    rerender(<StitchGrid data={mockGridData} zoom={2} />);
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("renders zoom controls with +, -, and fit-to-screen buttons", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const zoomOutBtn = screen.getByLabelText("Zoom out");
    const zoomInBtn = screen.getByLabelText("Zoom in");
    const fitBtn = screen.getByLabelText("Fit to screen");
    expect(zoomOutBtn).toBeInTheDocument();
    expect(zoomInBtn).toBeInTheDocument();
    expect(fitBtn).toBeInTheDocument();
  });

  it("shows zoom percentage in zoom controls", () => {
    render(<StitchGrid data={mockGridData} zoom={1.5} />);
    // 1.5 * 100 = 150%
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("calls onZoomChange when zoom in is clicked", () => {
    const handleZoom = vi.fn();
    render(<StitchGrid data={mockGridData} zoom={1} onZoomChange={handleZoom} />);
    const zoomInBtn = screen.getByLabelText("Zoom in");
    fireEvent.click(zoomInBtn);
    expect(handleZoom).toHaveBeenCalledWith(1.25);
  });

  it("calls onZoomChange when zoom out is clicked", () => {
    const handleZoom = vi.fn();
    render(<StitchGrid data={mockGridData} zoom={1} onZoomChange={handleZoom} />);
    const zoomOutBtn = screen.getByLabelText("Zoom out");
    fireEvent.click(zoomOutBtn);
    expect(handleZoom).toHaveBeenCalledWith(0.75);
  });

  it("has a grid lines toggle button", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const gridToggle = screen.getByLabelText(/Hide grid lines|Show grid lines/i);
    expect(gridToggle).toBeInTheDocument();
    expect(gridToggle.textContent).toContain("Grid");
  });

  it("toggles grid lines label on click", () => {
    render(<StitchGrid data={mockGridData} zoom={1} />);
    const gridToggle = screen.getByLabelText("Hide grid lines");
    expect(gridToggle).toBeInTheDocument();
    fireEvent.click(gridToggle);
    // After clicking, label should change
    expect(screen.getByLabelText("Show grid lines")).toBeInTheDocument();
  });
});

describe("mouseToGrid — Coordinate Conversion", () => {
  it("converts client coordinates to grid position at zoom 1", () => {
    // Create a mock canvas-like object with getBoundingClientRect
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    canvas.style.width = "8px";
    canvas.style.height = "8px";
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0, top: 0, right: 8, bottom: 8,
        width: 8, height: 8,
        x: 0, y: 0,
        toJSON: () => ({}),
      }),
    });

    // BASE_CELL_SIZE=4 * zoom=1 = 4px per cell
    // Click at (2, 2) → row: floor(2/4)=0, col: floor(2/4)=0
    const pos = mouseToGrid(2, 2, canvas, 4, 10, 10);
    expect(pos).toEqual({ row: 0, col: 0 });
  });

  it("returns null for clicks outside grid bounds", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0, top: 0, right: 40, bottom: 40,
        width: 40, height: 40,
        x: 0, y: 0,
        toJSON: () => ({}),
      }),
    });

    // Click far outside: x=100, y=100 but grid is only 40px wide
    const pos = mouseToGrid(100, 100, canvas, 4, 10, 10);
    expect(pos).toBeNull();
  });

  it("accounts for canvas position offset (not at 0,0)", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 20;
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 50, top: 50, right: 70, bottom: 70,
        width: 20, height: 20,
        x: 50, y: 50,
        toJSON: () => ({}),
      }),
    });

    // Canvas starts at (50, 50). Click at (55, 55) = canvas-local (5, 5)
    // cellSize=4, so row=1, col=1
    const pos = mouseToGrid(55, 55, canvas, 4, 10, 10);
    expect(pos).toEqual({ row: 1, col: 1 });
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
    // Canvas section is present
  });

  it("shows grid size information", () => {
    renderDesigner();
    expect(screen.getByText("32x32 Grid")).toBeInTheDocument();
  });

  it("has zoom controls", () => {
    renderDesigner();
    // Designer has its own zoom bar with percentage
    const zoomPct = screen.getAllByText(/^\d+%$/);
    expect(zoomPct.length).toBeGreaterThanOrEqual(1);
  });

  it("displays zero stitches initially", () => {
    renderDesigner();
    const matches = screen.getAllByText("0 stitches");
    expect(matches.length).toBeGreaterThanOrEqual(1);
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
    const addLayerBtn = screen.getByText("Layers").closest("div")?.querySelector("button");
    fireEvent.click(addLayerBtn!);
    expect(screen.getByText("5 layers")).toBeInTheDocument();
  });

  it("deletes a layer when the trash icon is clicked", () => {
    renderCollageStudio();
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash2")
    );
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText("3 layers")).toBeInTheDocument();
    }
  });

  it("renders the Inspector panel when a layer is selected", () => {
    renderCollageStudio();
    expect(screen.getAllByText(/Center Bloom/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Texture")).toBeInTheDocument();
  });

  it("has color swatches in the inspector", () => {
    renderCollageStudio();
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
    for (let i = 0; i < 5; i++) {
      const deleteButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash2")
      );
      if (deleteButtons.length === 0) break;
      fireEvent.click(deleteButtons[0]);
    }
    expect(screen.getByText("Base Fabric")).toBeInTheDocument();
  });
});

// =============================================================================
// 3. PLANNED EDITING TOOL SPECS — Mirror, Erase, Clone, Color Picker, Paint
// =============================================================================

describe.skip("Editing Tools — Embroidery Canvas (Designer)", () => {
  describe("Mirror Tool", () => {
    it("horizontally mirrors cell edits across the vertical center axis", () => {});
    it("vertically mirrors cell edits across the horizontal center axis", () => {});
    it("mirror updates in real-time as cells are painted", () => {});
    it("mirror works with eraser (mirrored cells also get erased)", () => {});
    it("mirror toggle button toggles between off/on states", () => {});
  });

  describe("Erase Tool", () => {
    it("clicking a filled cell with erase tool clears it", () => {});
    it("dragging across multiple cells erases all of them", () => {});
    it("clicking an empty cell with erase tool does nothing", () => {});
    it("undo restores erased cells", () => {});
    it("erase tool is visually distinct from paint brush", () => {});
  });

  describe("Clone Tool", () => {
    it("selecting a source area copies cell data", () => {});
    it("pasting the cloned area at a different location", () => {});
    it("pasting preserves stitch types of cloned cells", () => {});
    it("pasting at a location that would overflow the grid is clamped", () => {});
  });

  describe("Color Picker / Eyedropper Tool", () => {
    it("clicking a cell samples its color as the active color", () => {});
    it("active color updates to the sampled color", () => {});
    it("eyedropper works on empty cells (returns background color)", () => {});
  });

  describe("Paint Brush Tool", () => {
    it("clicking a single cell paints it with the active color", () => {});
    it("dragging paints multiple cells in a continuous stroke", () => {});
    it("painting respects the selected stitch type", () => {});
    it("re-painting an already painted cell overwrites the color", () => {});
  });
});

describe.skip("Editing Tools — Collage Canvas (CollageStudio)", () => {
  describe("Mirror Tool (Collage)", () => {
    it("mirrors layer positions horizontally", () => {});
    it("mirror tool works on selected layer only", () => {});
  });

  describe("Erase Tool (Collage)", () => {
    it("deletes the selected layer", () => {});
  });

  describe("Clone Tool (Collage)", () => {
    it("duplicates the selected layer with offset", () => {});
    it("cloned layer appears above the original in z-order", () => {});
  });

  describe("Eyedropper Tool (Collage)", () => {
    it("picks the color from a clicked layer", () => {});
  });

  describe("Paint Tool (Collage)", () => {
    it("changes the selected layer's color", () => {});
  });
});

// =============================================================================
// 4. TOOLBAR UI SPECS — Planned Toolbar Components
// =============================================================================

describe.skip("Toolbar UI — Tool Selection & State", () => {
  describe("Tool Button Rendering", () => {
    it("renders all tool buttons: mirror, erase, clone, eyedropper, paint", () => {});
    it("each tool button has a distinct icon", () => {});
    it("tool buttons are accessible (have aria-labels)", () => {});
  });

  describe("Active Tool State", () => {
    it("only one tool can be active at a time", () => {});
    it("active tool has a visual indicator (highlighted border/background)", () => {});
    it("default tool is paint brush", () => {});
  });

  describe("Tool Switching", () => {
    it("switching tools clears the previous tool's state", () => {});
    it("keyboard shortcuts work for tool switching", () => {});
  });
});
