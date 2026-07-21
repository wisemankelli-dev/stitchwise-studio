/**
 * Tests for Pattern Editor editing tools wired to backend API.
 *
 * Covers:
 * 1. API methods for paint, erase, mirror, clone, eyedropper, stampText
 * 2. Toolbar UI rendering with active state
 * 3. Save/Load pattern integration
 * 4. StitchGrid clone region highlighting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Designer } from "../pages/Designer";
import StitchGrid, { DmcLegend, type StitchGridData } from "../components/StitchGrid";

// =============================================================================
// 1. API METHOD TESTS — paintCells, eraseCells, mirrorGrid, etc.
// =============================================================================

describe("Pattern Editor API Methods", () => {
  // We test the API structure via the module import
  it("api has paintCells method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.paintCells).toBe("function");
  });

  it("api has eraseCells method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.eraseCells).toBe("function");
  });

  it("api has mirrorGrid method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.mirrorGrid).toBe("function");
  });

  it("api has cloneRegion method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.cloneRegion).toBe("function");
  });

  it("api has eyedropper method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.eyedropper).toBe("function");
  });

  it("api has stampText method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.stampText).toBe("function");
  });

  it("api has savePattern method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.savePattern).toBe("function");
  });

  it("api has loadPattern method", async () => {
    const { api } = await import("../services/api");
    expect(typeof api.loadPattern).toBe("function");
  });
});

// =============================================================================
// 2. MOCK API CALL TESTS
// =============================================================================

describe("Pattern Editor — Mock API Calls", () => {
  it("paintCells mock returns success", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.paintCells("test-pattern", [
      { row: 0, col: 0, color: "#e11d48", stitchType: "cross" },
    ]);
    expect(result.success).toBe(true);
    expect(result.totalStitches).toBe(1);
  });

  it("eraseCells mock returns success", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.eraseCells("test-pattern", [
      { row: 0, col: 0 },
    ]);
    expect(result.success).toBe(true);
  });

  it("mirrorGrid mock returns success for horizontal axis", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.mirrorGrid("test-pattern", "horizontal");
    expect(result.success).toBe(true);
  });

  it("cloneRegion mock returns success", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.cloneRegion(
      "test-pattern",
      { row: 0, col: 0, width: 4, height: 4 },
      { row: 10, col: 10 }
    );
    expect(result.success).toBe(true);
  });

  it("eyedropper mock returns a color", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.eyedropper("test-pattern", 5, 5);
    expect(result).toHaveProperty("color");
    expect(result).toHaveProperty("stitchType");
  });

  it("stampText mock returns success with stitch count", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.stampText("test-pattern", "HELLO", 0, 0, "#e11d48");
    expect(result.success).toBe(true);
    // 5 chars * 12 = 60 stitches
    expect(result.totalStitches).toBe(60);
  });

  it("savePattern mock returns success", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.savePattern("my-pattern", [], []);
    expect(result.success).toBe(true);
  });

  it("loadPattern mock returns empty grid", async () => {
    const { api } = await import("../services/api");
    api.isLiveBackend = false;
    const result = await api.loadPattern("my-pattern");
    expect(result.success).toBe(true);
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
  });
});

// =============================================================================
// 3. TOOLBAR UI TESTS
// =============================================================================

describe("Designer — Editing Toolbar UI", () => {
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

  it("renders all editing tool buttons", () => {
    renderDesigner();
    expect(screen.getByText("Select")).toBeInTheDocument();
    expect(screen.getByText("Mirror")).toBeInTheDocument();
    expect(screen.getByText("Erase")).toBeInTheDocument();
    expect(screen.getByText("Clone")).toBeInTheDocument();
    expect(screen.getByText("Pick")).toBeInTheDocument();
    expect(screen.getByText("Paint")).toBeInTheDocument();
  });

  it("renders Pattern ID input for save/load", () => {
    renderDesigner();
    const inputs = screen.getAllByPlaceholderText(/Pattern ID/i);
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Save and Load buttons", () => {
    renderDesigner();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Load")).toBeInTheDocument();
  });

  it("shows mirror axis buttons when mirror tool is active", () => {
    renderDesigner();
    const mirrorBtn = screen.getByText("Mirror");
    fireEvent.click(mirrorBtn);
    // Mirror axis buttons should appear
    expect(screen.getByText("horizontal")).toBeInTheDocument();
    expect(screen.getByText("vertical")).toBeInTheDocument();
    expect(screen.getByText("both")).toBeInTheDocument();
  });
});

// =============================================================================
// 4. STITCH GRID TESTS — Clone Region Highlighting
// =============================================================================

describe("StitchGrid — Clone Region Highlighting", () => {
  const mockGridData: StitchGridData = {
    grid: Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 4 }, (_, c) => ({
        row: r, col: c,
        color: (r + c) % 2 === 0 ? "#e11d48" : "",
        stitchType: "cross" as const,
      }))
    ),
    width: 4, height: 4,
    dmcPalette: [{ code: "321", name: "Red", hex: "#e11d48", count: 8 }],
    totalStitches: 8,
  };

  it("renders with cloneSource prop without errors", () => {
    const { container } = render(
      <StitchGrid
        data={mockGridData}
        zoom={1}
        activeTool="clone"
        cloneSource={{ row: 0, col: 0 }}
      />
    );
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("highlights cells within clone selection with ring styling", () => {
    const { container } = render(
      <StitchGrid
        data={mockGridData}
        zoom={1}
        activeTool="clone"
        cloneSource={{ row: 0, col: 0 }}
        cloneSelectionEnd={{ row: 1, col: 1 }}
      />
    );
    const cells = screen.getAllByRole("button");
    // First 4 cells (row 0-1, col 0-1) should have selection ring
    expect(cells[0].className).toContain("ring-2");
  });

  it("renders with mirrorAxis prop without errors", () => {
    const { container } = render(
      <StitchGrid
        data={mockGridData}
        zoom={1}
        activeTool="mirror"
        mirrorAxis="vertical"
      />
    );
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("shows mirror axis cells with subtle ring", () => {
    render(
      <StitchGrid
        data={mockGridData}
        zoom={1}
        activeTool="mirror"
        mirrorAxis="vertical"
      />
    );
    const cells = screen.getAllByRole("button");
    // Cells on the vertical axis (col 2 for 4-wide grid) should have ring
    const axisCells = cells.filter(c => c.className.includes("ring-1"));
    expect(axisCells.length).toBeGreaterThan(0);
  });
});
