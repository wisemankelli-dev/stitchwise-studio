import { PrismaClient } from "@prisma/client";
import type {
  CollageProject,
  CreateCollageProjectInput,
  UpdateCollageProjectInput,
} from "../../domain/collage";
import { defaultCollageCanvas } from "../../domain/collage";
import type { CollageRepo } from "./collageRepo";

/**
 * Prisma-backed implementation of CollageRepo.
 */
export class PrismaCollageRepo implements CollageRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async createProject(input: CreateCollageProjectInput): Promise<CollageProject> {
    const record = await this.prisma.collageProject.create({
      data: {
        name: input.name,
        data: input.data ?? defaultCollageCanvas(),
        width: input.width ?? 300,
        height: input.height ?? 300,
        userId: input.userId,
      },
    });
    return this.toProject(record);
  }

  async getProject(id: string): Promise<CollageProject | null> {
    const record = await this.prisma.collageProject.findUnique({ where: { id } });
    return record ? this.toProject(record) : null;
  }

  async listProjectsByUser(userId: string): Promise<CollageProject[]> {
    const records = await this.prisma.collageProject.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return records.map((r: any) => this.toProject(r));
  }

  async updateProject(id: string, input: UpdateCollageProjectInput): Promise<CollageProject> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.data !== undefined) data.data = input.data;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail;

    const record = await this.prisma.collageProject.update({
      where: { id },
      data,
    });
    return this.toProject(record);
  }

  async deleteProject(id: string): Promise<void> {
    await this.prisma.collageProject.delete({ where: { id } });
  }

  private toProject(r: {
    id: string;
    name: string;
    data: string;
    userId: string;
    width: number;
    height: number;
    thumbnail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CollageProject {
    return {
      id: r.id,
      name: r.name,
      data: r.data,
      userId: r.userId,
      width: r.width,
      height: r.height,
      thumbnail: r.thumbnail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}