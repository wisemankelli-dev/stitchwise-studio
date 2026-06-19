import { PrismaClient } from "@prisma/client";
import { v4 as uuid } from "uuid";
import type {
  Project,
  ProjectShare,
  ProjectCollaborator,
  CreateProjectInput,
  UpdateProjectInput,
  CreateShareLinkInput,
  InviteCollaboratorInput,
} from "../../domain/workshop";
import { SharePermission } from "../../domain/workshop";
import type { UserProfile } from "../../domain/user";
import { UserTier } from "../../domain/workshop";
import type { WorkshopRepo } from "./workshopRepo";

/**
 * Prisma-backed implementation of WorkshopRepo.
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

  // ── Sharing ─────────────────────────────────────────────────────────────

  async createShareLink(input: CreateShareLinkInput, token: string): Promise<ProjectShare> {
    const data: Record<string, unknown> = {
      projectId: input.projectId,
      token,
      permission: input.permission ?? SharePermission.VIEWER,
    };
    if (input.expiresInHours) {
      data.expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
    }
    const record = await this.prisma.projectShare.create({ data });
    return this.toShare(record);
  }

  async getShareByToken(token: string): Promise<ProjectShare | null> {
    const record = await this.prisma.projectShare.findUnique({ where: { token } });
    return record ? this.toShare(record) : null;
  }

  async getSharesForProject(projectId: string): Promise<ProjectShare[]> {
    const records = await this.prisma.projectShare.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toShare(r));
  }

  async deactivateShare(shareId: string): Promise<void> {
    await this.prisma.projectShare.update({
      where: { id: shareId },
      data: { isActive: false },
    });
  }

  // ── Collaborators ───────────────────────────────────────────────────────

  async inviteCollaborator(input: InviteCollaboratorInput): Promise<ProjectCollaborator> {
    const record = await this.prisma.projectCollaborator.create({
      data: {
        projectId: input.projectId,
        email: input.email,
        permission: input.permission ?? SharePermission.EDITOR,
      },
    });
    return this.toCollaborator(record);
  }

  async getCollaboratorsForProject(projectId: string): Promise<ProjectCollaborator[]> {
    const records = await this.prisma.projectCollaborator.findMany({
      where: { projectId },
      orderBy: { invitedAt: "desc" },
    });
    return records.map((r) => this.toCollaborator(r));
  }

  async acceptInvitation(id: string): Promise<void> {
    await this.prisma.projectCollaborator.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }

  async getCollaboratorByEmail(
    projectId: string,
    email: string,
  ): Promise<ProjectCollaborator | null> {
    const record = await this.prisma.projectCollaborator.findUnique({
      where: { projectId_email: { projectId, email } },
    });
    return record ? this.toCollaborator(record) : null;
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
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: r.id,
      name: r.name,
      data: r.data,
      userId: r.userId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toShare(r: {
    id: string;
    projectId: string;
    token: string;
    permission: string;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectShare {
    return {
      id: r.id,
      projectId: r.projectId,
      token: r.token,
      permission: SharePermission[r.permission as keyof typeof SharePermission],
      isActive: r.isActive,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toCollaborator(r: {
    id: string;
    projectId: string;
    email: string;
    permission: string;
    acceptedAt: Date | null;
    invitedAt: Date;
  }): ProjectCollaborator {
    return {
      id: r.id,
      projectId: r.projectId,
      email: r.email,
      permission: SharePermission[r.permission as keyof typeof SharePermission],
      acceptedAt: r.acceptedAt,
      invitedAt: r.invitedAt,
    };
  }
}