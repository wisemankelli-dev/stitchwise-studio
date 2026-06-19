import { z } from "zod";

/**
 * Represents the possible states of a ProjectInquiry as tracked by the system.
 */
export enum InquiryStatus {
  PENDING = "PENDING",
  REVIEWING = "REVIEWING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

/**
 * Core domain entity representing a project inquiry from a prospective client.
 */
export interface ProjectInquiry {
  id: string;
  name: string;
  email: string;
  description: string;
  status: InquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new ProjectInquiry.
 */
export interface CreateProjectInquiryInput {
  name: string;
  email: string;
  description: string;
}

/**
 * Zod schema for validating create-project-inquiry requests.
 */
export const CreateProjectInquirySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  email: z.string().email("A valid email address is required"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be at most 5000 characters"),
});