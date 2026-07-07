import type {
  QuiltBlockProject,
  CreateQuiltBlockProjectInput,
  UpdateQuiltBlockProjectInput,
} from "../../domain/quiltBlock";

/** Repository interface for Quilt Block Studio operations. */
export interface QuiltBlockRepo {
  createProject(input: CreateQuiltBlockProjectInput): Promise<QuiltBlockProject>;
  getProject(id: string): Promise<QuiltBlockProject | null>;
  listProjectsByUser(userId: string): Promise<QuiltBlockProject[]>;
  updateProject(id: string, input: UpdateQuiltBlockProjectInput): Promise<QuiltBlockProject>;
  deleteProject(id: string): Promise<void>;
}