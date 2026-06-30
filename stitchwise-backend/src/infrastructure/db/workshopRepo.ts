import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  SampleProject,
} from "../../domain/workshop";
import type { UserProfile } from "../../domain/user";

/** Repository interface for user and project operations (solo designer focus). */
export interface WorkshopRepo {
  // ── Users ──────────────────────────────────────────────────────────────
  getUser(id: string): Promise<UserProfile | null>;
  getUserByEmail(email: string): Promise<UserProfile | null>;
  createUser(input: { email: string; name: string }): Promise<UserProfile>;

  // ── Projects ───────────────────────────────────────────────────────────
  createProject(input: CreateProjectInput): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjectsByUser(userId: string): Promise<Project[]>;
  updateProject(id: string, input: UpdateProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // ── Sample Designs & Cloning ──────────────────────────────────────────
  listSampleProjects(): Promise<SampleProject[]>;
  cloneProject(projectId: string, newOwnerId: string, newName?: string): Promise<Project>;
}