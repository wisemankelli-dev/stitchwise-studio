import type {
  MarketplaceListing,
  CreateListingInput,
  UpdateListingInput,
} from "../../domain/marketplace";

export interface MarketplaceRepo {
  create(input: CreateListingInput, tags: string): Promise<MarketplaceListing>;
  getById(id: string): Promise<MarketplaceListing | null>;
  listByDesigner(designerId: string): Promise<MarketplaceListing[]>;
  listPublic(options?: { tags?: string[]; search?: string }): Promise<MarketplaceListing[]>;
  update(id: string, designerId: string, input: UpdateListingInput, tags?: string): Promise<MarketplaceListing>;
  delete(id: string, designerId: string): Promise<void>;
}