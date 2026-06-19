import { PrismaClient } from "@prisma/client";
import type { ProjectInquiry, CreateProjectInquiryInput } from "../../domain/projectInquiry";
import { InquiryStatus } from "../../domain/projectInquiry";
import type { ProjectInquiryRepo } from "./projectInquiryRepo";

/**
 * Prisma-backed implementation of ProjectInquiryRepo.
 *
 * Translates between the Prisma-generated types and the
 * domain ProjectInquiry entity to maintain clean architecture.
 */
export class PrismaProjectInquiryRepo implements ProjectInquiryRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateProjectInquiryInput): Promise<ProjectInquiry> {
    const record = await this.prisma.projectInquiry.create({
      data: {
        name: input.name,
        email: input.email,
        description: input.description,
        status: InquiryStatus.PENDING,
      },
    });
    return this.toDomain(record);
  }

  async findAll(): Promise<ProjectInquiry[]> {
    const records = await this.prisma.projectInquiry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return records.map((r: { id: string; name: string; email: string; description: string; status: string; createdAt: Date; updatedAt: Date }) => this.toDomain(r));
  }

  async findById(id: string): Promise<ProjectInquiry | null> {
    const record = await this.prisma.projectInquiry.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  /**
   * Maps a Prisma record to a domain ProjectInquiry entity.
   */
  private toDomain(record: {
    id: string;
    name: string;
    email: string;
    description: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectInquiry {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      description: record.description,
      status: InquiryStatus[record.status as keyof typeof InquiryStatus],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}