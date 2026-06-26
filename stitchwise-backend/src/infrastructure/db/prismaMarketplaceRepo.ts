import { PrismaClient } from "@prisma/client";
import type {
  MarketplaceListing,
  CreateListingInput,
  UpdateListingInput,
} from "../../domain/marketplace";
import type { MarketplaceRepo } from "./marketplaceRepo";

export class PrismaMarketplaceRepo implements MarketplaceRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateListingInput, tags: string): Promise<MarketplaceListing> {
    const record = await this.prisma.marketplaceListing.create({
      data: {
        designerId: input.designerId,
        name: input.name,
        description: input.description ?? "",
        price: input.price ?? 0,
        visibility: input.visibility ?? "PUBLIC",
        tags,
        stitchFile: input.stitchFile ?? null,
        thumbnail: input.thumbnail ?? null,
      },
    });
    return this.toDomain(record);
  }

  async getById(id: string): Promise<MarketplaceListing | null> {
    const record = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async listByDesigner(designerId: string): Promise<MarketplaceListing[]> {
    const records = await this.prisma.marketplaceListing.findMany({
      where: { designerId },
      orderBy: { updatedAt: "desc" },
    });
    return records.map((r) => this.toDomain(r));
  }

  async listPublic(options?: { tags?: string[]; search?: string }): Promise<MarketplaceListing[]> {
    const where: Record<string, unknown> = { visibility: "PUBLIC" };

    if (options?.tags && options.tags.length > 0) {
      where.AND = options.tags.map((tag) => ({
        tags: { contains: tag },
      }));
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search } },
        { description: { contains: options.search } },
      ];
    }

    const records = await this.prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toDomain(r));
  }

  async update(
    id: string,
    designerId: string,
    input: UpdateListingInput,
    tags?: string,
  ): Promise<MarketplaceListing> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = input.price;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (tags !== undefined) data.tags = tags;
    if (input.stitchFile !== undefined) data.stitchFile = input.stitchFile;
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail;

    const record = await this.prisma.marketplaceListing.update({
      where: { id, designerId },
      data,
    });
    return this.toDomain(record);
  }

  async delete(id: string, designerId: string): Promise<void> {
    await this.prisma.marketplaceListing.delete({
      where: { id, designerId },
    });
  }

  private toDomain(r: {
    id: string;
    designerId: string;
    name: string;
    description: string;
    price: number;
    visibility: string;
    tags: string;
    stitchFile: string | null;
    thumbnail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): MarketplaceListing {
    return {
      id: r.id,
      designerId: r.designerId,
      name: r.name,
      description: r.description,
      price: r.price,
      visibility: r.visibility as MarketplaceListing["visibility"],
      tags: JSON.parse(r.tags) as string[],
      stitchFile: r.stitchFile,
      thumbnail: r.thumbnail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}