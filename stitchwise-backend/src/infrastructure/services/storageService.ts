/**
 * Storage service for file uploads.
 *
 * Abstracts file storage behind a clean interface so the implementation
 * can be swapped between local filesystem (dev) and S3/cloud (production).
 *
 * Currently implements local filesystem storage. For production, swap
 * with an S3 implementation using the same interface.
 */

import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

/** Base upload directory — configurable via env var. */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StoredFile {
  /** URL path to access the file (e.g., /uploads/abc123.jpg) */
  url: string;
  /** Absolute filesystem path */
  filePath: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

// ─── Storage Interface ─────────────────────────────────────────────────────

export interface StorageProvider {
  /** Store a file buffer and return access info. */
  store(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  /** Delete a stored file by its URL path. */
  delete(url: string): Promise<void>;
}

// ─── Local Filesystem Implementation ───────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  constructor() {
    // Ensure upload directory exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async store(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    const ext = path.extname(originalName) || ".bin";
    const filename = `${uuid()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/${filename}`,
      filePath,
      originalName,
      size: buffer.length,
      mimeType,
    };
  }

  async delete(url: string): Promise<void> {
    // Convert URL path to filesystem path
    const filename = path.basename(url);
    const filePath = path.join(UPLOAD_DIR, filename);

    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      // Ignore if file doesn't exist
      if (err.code !== "ENOENT") throw err;
    }
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

let _instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_instance) {
    _instance = new LocalStorageProvider();
  }
  return _instance;
}

// ─── Allowed Image Types ───────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateImageFile(mimeType: string, size: number): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return `Invalid file type '${mimeType}'. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`;
  }
  if (size > MAX_IMAGE_SIZE) {
    return `File too large (${Math.round(size / 1024 / 1024)}MB). Maximum: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`;
  }
  return null;
}