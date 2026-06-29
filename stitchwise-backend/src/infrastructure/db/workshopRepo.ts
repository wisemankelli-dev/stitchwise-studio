import type {
  Project,
  ProjectShare,
  ProjectCollaborator,
  CreateProjectInput,
  UpdateProjectInput,
  CreateShareLinkInput,
  InviteCollaboratorInput,
  SampleProject,
} from "../../domain/workshop";
import type { UserProfile } from "../../domain/user";

/** Repository interface for Workshop and User operations. */
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

  // ── Sharing ─────────────────────────────────────────────────────────────
  createShareLink(input: CreateShareLinkInput, token: string): Promise<ProjectShare>;
  getShareByToken(token: string): Promise<ProjectShare | null>;
  getSharesForProject(projectId: string): Promise<ProjectShare[]>;
  deactivateShare(shareId: string): Promise<void>;

  // ── Collaborators ───────────────────────────────────────────────────────
  inviteCollaborator(input: InviteCollaboratorInput): Promise<ProjectCollaborator>;
  getCollaboratorsForProject(projectId: string): Promise<ProjectCollaborator[]>;
  acceptInvitation(id: string): Promise<void>;
  getCollaboratorByEmail(projectId: string, email: string): Promise<ProjectCollaborator | null>;
}