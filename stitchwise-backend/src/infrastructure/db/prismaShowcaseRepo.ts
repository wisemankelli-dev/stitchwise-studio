import { PrismaClient } from "@prisma/client";
import type {
  ShowcasePhoto,
  GalleryPhoto,
  CreateShowcasePhotoInput,
  UpdateShowcasePhotoInput,
} from "../../domain/showcase";
import { ShowcasePhotoStatus } from "../../domain/showcase";
import type { ShowcaseRepo } from "./showcaseRepo";

/**
 * Prisma-backed implementation of ShowcaseRepo.
 */
export class PrismaShowcaseRepo implements ShowcaseRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async createPhoto(input: CreateShowcasePhotoInput): Promise<ShowcasePhoto> {
    const record = await this.prisma.showcasePhoto.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? null,
        title: input.title,
        caption: input.caption ?? null,
        imageUrl: input.imageUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        status: ShowcasePhotoStatus.PENDING,
      },
    });
    return this.toPhoto(record);
  }

  async getPhoto(id: string): Promise<ShowcasePhoto | null> {
    const record = await this.prisma.showcasePhoto.findUnique({ where: { id } });
    return record ? this.toPhoto(record) : null;
  }

  async listPhotosByUser(userId: string): Promise<ShowcasePhoto[]> {
    const records = await this.prisma.showcasePhoto.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toPhoto(r));
  }

  async listApprovedPhotos(): Promise<GalleryPhoto[]> {
    const records = await this.prisma.showcasePhoto.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, tier: true } },
      },
    });
    return records.map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl,
      userName: (r as any).user.name,
      userTier: (r as any).user.tier,
      createdAt: r.createdAt,
    }));
  }

  async updatePhoto(id: string, input: UpdateShowcasePhotoInput): Promise<ShowcasePhoto> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.caption !== undefined) data.caption = input.caption;
    if (input.status !== undefined) data.status = input.status;

    const record = await this.prisma.showcasePhoto.update({
      where: { id },
      data,
    });
    return this.toPhoto(record);
  }

  async deletePhoto(id: string): Promise<void> {
    await this.prisma.showcasePhoto.delete({ where: { id } });
  }

  private toPhoto(r: {
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    caption: string | null;
    imageUrl: string;
    thumbnailUrl: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): ShowcasePhoto {
    return {
      id: r.id,
      userId: r.userId,
      projectId: r.projectId,
      title: r.title,
      caption: r.caption,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl,
      status: ShowcasePhotoStatus[r.status as keyof typeof ShowcasePhotoStatus],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}