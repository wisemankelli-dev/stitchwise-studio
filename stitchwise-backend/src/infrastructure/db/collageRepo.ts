import type {
  CollageProject,
  CreateCollageProjectInput,
  UpdateCollageProjectInput,
} from "../../domain/collage";

/** Repository interface for Collage Studio operations. */
export interface CollageRepo {
  createProject(input: CreateCollageProjectInput): Promise<CollageProject>;
  getProject(id: string): Promise<CollageProject | null>;
  listProjectsByUser(userId: string): Promise<CollageProject[]>;
  updateProject(id: string, input: UpdateCollageProjectInput): Promise<CollageProject>;
  deleteProject(id: string): Promise<void>;
}