import type {
  ShowcasePhoto,
  GalleryPhoto,
  CreateShowcasePhotoInput,
  UpdateShowcasePhotoInput,
} from "../../domain/showcase";

/** Repository interface for Community Showcase operations. */
export interface ShowcaseRepo {
  createPhoto(input: CreateShowcasePhotoInput): Promise<ShowcasePhoto>;
  getPhoto(id: string): Promise<ShowcasePhoto | null>;
  listPhotosByUser(userId: string): Promise<ShowcasePhoto[]>;
  listApprovedPhotos(): Promise<GalleryPhoto[]>;
  updatePhoto(id: string, input: UpdateShowcasePhotoInput): Promise<ShowcasePhoto>;
  deletePhoto(id: string): Promise<void>;
}