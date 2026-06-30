import { PrismaClient } from "@prisma/client";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  SampleProject,
} from "../../domain/workshop";
import { ProjectVisibility } from "../../domain/workshop";
import type { UserProfile } from "../../domain/user";
import { UserTier } from "../../domain/workshop";
import type { WorkshopRepo } from "./workshopRepo";

/**
 * Prisma-backed implementation of WorkshopRepo.
 * Solo designer focus — no sharing or collaboration methods.
 */
export class PrismaWorkshopRepo implements WorkshopRepo {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Users ──────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<UserProfile | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toUserProfile(record) : null;
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toUserProfile(record) : null;
  }

  async createUser(input: { email: string; name: string }): Promise<UserProfile> {
    const record = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: "placeholder-dev-hash",
        tier: "HOBBYIST",
      },
    });
    return this.toUserProfile(record);
  }

  // ── Projects ──────────────────────────────────────────────────────────

  async createProject(input: CreateProjectInput): Promise<Project> {
    const record = await this.prisma.project.create({
      data: {
        name: input.name,
        data: input.data ?? "{}",
        userId: input.userId,
        visibility: input.visibility ?? ProjectVisibility.PRIVATE,
      },
    });
    return this.toProject(record);
  }

  async listSampleProjects(): Promise<SampleProject[]> {
    const records = await this.prisma.project.findMany({
      where: { visibility: "SAMPLE" },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toSampleProject(r));
  }

  async cloneProject(projectId: string, newOwnerId: string, newName?: string): Promise<Project> {
    const original = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!original) {
      throw new Error("Project not found");
    }
    if (original.visibility !== "SAMPLE") {
      throw new Error("Only sample designs can be cloned");
    }
    const record = await this.prisma.project.create({
      data: {
        name: newName ?? `${original.name} (Copy)`,
        data: original.data,
        userId: newOwnerId,
        visibility: "PRIVATE",
      },
    });
    return this.toProject(record);
  }

  async getProject(id: string): Promise<Project | null> {
    const record = await this.prisma.project.findUnique({ where: { id } });
    return record ? this.toProject(record) : null;
  }

  async listProjectsByUser(userId: string): Promise<Project[]> {
    const records = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return records.map((r) => this.toProject(r));
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const record = await this.prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.data !== undefined && { data: input.data }),
      },
    });
    return this.toProject(record);
  }

  async deleteProject(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  // ── Mappers ─────────────────────────────────────────────────────────────

  private toUserProfile(r: { id: string; email: string; name: string; tier: string; createdAt: Date }): UserProfile {
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      tier: UserTier[r.tier as keyof typeof UserTier],
      createdAt: r.createdAt,
    };
  }

  private toProject(r: {
    id: string;
    name: string;
    data: string;
    userId: string;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: r.id,
      name: r.name,
      data: r.data,
      userId: r.userId,
      visibility: ProjectVisibility[r.visibility as keyof typeof ProjectVisibility],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toSampleProject(r: {
    id: string;
    name: string;
    data: string;
    userId: string;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
  }): SampleProject {
    return {
      id: r.id,
      name: r.name,
      data: r.data,
      userId: r.userId,
      visibility: ProjectVisibility.SAMPLE,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}