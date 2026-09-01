import { z } from "zod";
import type { RawJob } from "../../../domain/job.js";
import type { HttpJsonClient } from "./HttpClient.js";

export const AtsProviderSchema = z.enum(["greenhouse", "lever"]);
export type AtsProvider = z.infer<typeof AtsProviderSchema>;

/** One company's public ATS board, from `data/sources/companies.json`. */
export const CompanyBoardSchema = z.object({
  name: z.string().min(1),
  ats: AtsProviderSchema,
  /** The board token/slug in the ATS URL (e.g. "figma", "leverdemo"). */
  board: z.string().min(1),
  enabled: z.boolean().default(true),
});
export type CompanyBoard = z.infer<typeof CompanyBoardSchema>;

export const CompaniesConfigSchema = z.object({
  companies: z.array(CompanyBoardSchema).default([]),
});
export type CompaniesConfig = z.infer<typeof CompaniesConfigSchema>;

/**
 * A per-ATS client. Given a board token, returns every public posting mapped to
 * the loose `RawJob` shape (the normalizer strictens it). Fetching all postings
 * and filtering client-side is the correct pattern: these boards expose a full
 * listing, not a full-text search.
 */
export interface AtsClient {
  readonly provider: AtsProvider;
  fetchBoard(company: CompanyBoard, http: HttpJsonClient): Promise<RawJob[]>;
  /** True if this client can handle a given hosted job URL (for getJobDetails). */
  ownsUrl(url: string): boolean;
  fetchOne?(url: string, http: HttpJsonClient): Promise<RawJob | null>;
}
