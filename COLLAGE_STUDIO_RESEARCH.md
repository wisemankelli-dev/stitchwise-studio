# Collage Studio Research: Database Storage for Layered Textile Designs

## Overview
The Collage Studio feature allows users to create **collage quilting patterns** — layered textile designs composed of fabric pieces, appliqué patches, seam lines, and stitch patterns arranged on a base layer. This differs from standard embroidery patterns (single-layer stitch paths) by introducing **multiple overlapping fabric layers** with distinct material properties.

## Core Data Model Requirements

### 1. Project Structure (Multi-Layer Canvas)

Unlike the existing `Project` model (which stores a flat JSON of SVG paths), a collage quilt needs:

```
CollageProject {
  id: UUID
  name: string
  userId: UUID
  width: number    // canvas width in mm
  height: number   // canvas height in mm
  background: FabricLayer   // base fabric
  layers: CollageLayer[]    // ordered array of overlapping layers
  createdAt: datetime
  updatedAt: datetime
}

CollageLayer {
  id: UUID
  projectId: UUID
  name: string            // e.g. "Appliqué Flower", "Border Strip"
  zIndex: number          // stacking order (0 = bottom)
  visible: boolean
  opacity: number         // 0.0-1.0
  fabric: FabricRef       // reference to fabric/material
  shape: Shape            // cut shape of this piece
  stitches: StitchPath[]  // stitch paths on this layer
  seams: Seam[]           // seam lines connecting to other layers
}

FabricRef {
  id: UUID
  name: string
  color: string           // hex color
  pattern: string         // 'solid' | 'print' | 'stripe' | 'plaid' | etc.
  texture: string         // 'cotton' | 'linen' | 'silk' | etc.
  imageUrl?: string       // uploaded fabric texture image
  threadColor?: [r,g,b]  // recommended thread color for this fabric
}

Shape {
  type: 'rectangle' | 'circle' | 'polygon' | 'path' | 'freeform'
  points: Point[]         // vertices or SVG path data
  rotation: number        // degrees
  scale: { x: number, y: number }
}

StitchPath {
  type: 'running' | 'satin' | 'fill' | 'applique' | 'quilting'
  segments: Segment[]
  color: [r,g,b]
  density: number         // stitches per mm
  width?: number          // for satin/appliqué edges
}

Seam {
  layerA: UUID            // source layer
  layerB: UUID            // target layer
  seamType: 'straight' | 'zigzag' | 'decorative'
  allowance: number       // seam allowance in mm
  stitchPath: StitchPath  // the stitching that joins them
}
```

## Database Storage Strategies

### Option A: JSON Column (Recommended MVP)
Store the entire layered design as a JSON blob in a single `data` column, similar to the current `Project.data` model. Extend the schema:

```prisma
model CollageProject {
  id        String   @id @default(uuid())
  name      String
  userId    String
  data      String   // Full JSON: dimensions, layers, fabrics, shapes, stitches
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Pros**: Fast iteration, no schema migrations for new layer types, matches existing Project pattern.
**Cons**: Cannot query individual layers without parsing JSON; harder to index.

### Option B: Normalized Relational (Recommended for Production)
Break the collage into related tables for queryability:

```prisma
model CollageProject {
  id        String          @id @default(uuid())
  name      String
  userId    String
  width     Float           // mm
  height    Float           // mm
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  layers    CollageLayer[]
  fabrics   FabricLibrary[]
}

model CollageLayer {
  id        String          @id @default(uuid())
  projectId String
  name      String
  zIndex    Int
  visible   Boolean         @default(true)
  opacity   Float           @default(1.0)
  shape     String          // JSON: shape data (polygon/path points)
  rotation  Float           @default(0)
  scaleX    Float           @default(1.0)
  scaleY    Float           @default(1.0)
  fabricId  String?
  fabric    FabricLibrary?  @relation(fields: [fabricId], references: [id])
  project   CollageProject  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stitches  CollageStitch[]
  seams     CollageSeam[]   // as source
}

model FabricLibrary {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  color       String   // hex
  pattern     String   @default("solid")
  texture     String   @default("cotton")
  imageUrl    String?
  threadColor String   // JSON [r,g,b]
  project     CollageProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  layers      CollageLayer[]
}

model CollageStitch {
  id        String  @id @default(uuid())
  layerId   String
  type      String  // 'running' | 'satin' | 'fill' | 'applique' | 'quilting'
  segments  String  // JSON array of path segments
  color     String  // JSON [r,g,b]
  density   Float   @default(4.0)
  width     Float?  // for satin/appliqué
  layer     CollageLayer @relation(fields: [layerId], references: [id], onDelete: Cascade)
}

model CollageSeam {
  id        String  @id @default(uuid())
  layerAId  String
  layerBId  String
  seamType  String  // 'straight' | 'zigzag' | 'decorative'
  allowance Float   // mm
  stitchId  String?
  stitch    CollageStitch? @relation(fields: [stitchId], references: [id])
  layerA    CollageLayer @relation("SeamSource", fields: [layerAId], references: [id], onDelete: Cascade)
  layerB    CollageLayer @relation("SeamTarget", fields: [layerBId], references: [id], onDelete: Cascade)
}
```

**Pros**: Queryable (e.g., "find all layers using cotton fabric"), indexable, referential integrity.
**Cons**: More complex schema, more migrations required for new features.

### Option C: Hybrid (Recommended)
Store the active/editing state in a JSON column for fast read/write, with a background process that normalizes key metadata into relational columns for search/filter.

```prisma
model CollageProject {
  id          String   @id @default(uuid())
  name        String
  userId      String
  data        String   // Full JSON canvas state (fast save/load)
  layerCount  Int      @default(0) // denormalized for queries
  fabricCount Int      @default(0)
  width       Float    @default(300)
  height      Float    @default(300)
  thumbnail   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Fabric Library Considerations

Collage quilting relies heavily on fabric choices. Consider adding a **global fabric library** and a **user fabric library**:

- **Global Fabric Library**: Pre-loaded fabrics with thread color recommendations (similar to DMC thread palette)
- **User Fabric Library**: Users upload photos of their fabric stash, the system analyzes dominant colors and texture
- **Fabric Marketplace**: Integration with affiliate links to fabric stores (thread and fabric purchases — aligns with business plan's affiliate integration)

## Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Large JSON blobs (>1MB) | Use zstd compression on write, decompress on read |
| Many layers (20+) | Paginate layer loading — load visible layers first |
| Fabric texture images | Store in S3/CDN, not database; reference by URL |
| Real-time collaboration | Polling (existing POC) works well since JSON is atomic |
| Undo/redo history | Keep a `version` array in JSON or separate `ProjectSnapshot` table |

## Existing Schema Integration

The Collage Studio can share the existing `User` model but needs its own project table. Recommended approach:

```prisma
// Add to schema.prisma alongside existing Project model
model CollageProject {
  id        String   @id @default(uuid())
  name      String
  userId    String
  data      String   @default("{}") // Full JSON canvas state
  width     Float    @default(300)
  height    Float    @default(300)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

This keeps Collage Studio projects separate from embroidery pattern projects while reusing the auth/tier system.

## Recommendation

**Start with Option A (JSON column) for MVP**, matching the existing `Project.data` pattern. This enables rapid prototyping and keeps the codebase consistent. The Collage Studio canvas JSON structure should be well-defined and versioned to allow future migration to Options B or C if usage justifies it.

The JSON structure should include a `version` field for forward compatibility:

```json
{
  "version": 1,
  "width": 600,
  "height": 800,
  "gridSize": 10,
  "fabrics": [...],
  "layers": [...]
}
```