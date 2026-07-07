import { PrismaClient } from "@prisma/client";
import type {
  QuiltBlockProject,
  CreateQuiltBlockProjectInput,
  UpdateQuiltBlockProjectInput,
} from "../../domain/quiltBlock";
import { defaultQuiltBlockData } from "../../domain/quiltBlock";
import type { QuiltBlockRepo } from "./quiltBlockRepo";

/**
 * Prisma-backed implementation of QuiltBlockRepo.
 *
 * Follows the same pattern as PrismaCollageRepo.
 */
export class PrismaQuiltBlockRepo implements QuiltBlockRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async createProject(input: CreateQuiltBlockProjectInput): Promise<QuiltBlockProject> {
    const record = await this.prisma.quiltBlockProject.create({
      data: {
        name: input.name,
        data: input.data ?? defaultQuiltBlockData(),
        blockSize: input.blockSize ?? 12,
        gridRows: input.gridRows ?? 4,
        gridCols: input.gridCols ?? 4,
        userId: input.userId,
      },
    });
    return this.toProject(record);
  }

  async getProject(id: string): Promise<QuiltBlockProject | null> {
    const record = await this.prisma.quiltBlockProject.findUnique({ where: { id } });
    return record ? this.toProject(record) : null;
  }

  async listProjectsByUser(userId: string): Promise<QuiltBlockProject[]> {
    const records = await this.prisma.quiltBlockProject.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return records.map((r: any) => this.toProject(r));
  }

  async updateProject(id: string, input: UpdateQuiltBlockProjectInput): Promise<QuiltBlockProject> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.data !== undefined) data.data = input.data;
    if (input.blockSize !== undefined) data.blockSize = input.blockSize;
    if (input.gridRows !== undefined) data.gridRows = input.gridRows;
    if (input.gridCols !== undefined) data.gridCols = input.gridCols;
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail;

    const record = await this.prisma.quiltBlockProject.update({
      where: { id },
      data,
    });
    return this.toProject(record);
  }

  async deleteProject(id: string): Promise<void> {
    await this.prisma.quiltBlockProject.delete({ where: { id } });
  }

  private toProject(r: {
    id: string;
    name: string;
    data: string;
    userId: string;
    blockSize: number;
    gridRows: number;
    gridCols: number;
    thumbnail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): QuiltBlockProject {
    return {
      id: r.id,
      name: r.name,
      data: r.data,
      userId: r.userId,
      blockSize: r.blockSize,
      gridRows: r.gridRows,
      gridCols: r.gridCols,
      thumbnail: r.thumbnail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}