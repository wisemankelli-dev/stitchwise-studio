import type {
  ProjectInquiry,
  CreateProjectInquiryInput,
} from "../../domain/projectInquiry";

/**
 * Repository interface for ProjectInquiry persistence.
 *
 * Follows the Repository pattern to keep domain logic
 * decoupled from the database implementation.
 */
export interface ProjectInquiryRepo {
  /** Create a new ProjectInquiry. Returns the created entity. */
  create(input: CreateProjectInquiryInput): Promise<ProjectInquiry>;

  /** Find all inquiries, ordered by creation date descending. */
  findAll(): Promise<ProjectInquiry[]>;

  /** Find a single inquiry by ID. Returns null if not found. */
  findById(id: string): Promise<ProjectInquiry | null>;
}