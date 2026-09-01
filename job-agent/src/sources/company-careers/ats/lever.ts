import type { RawJob, RemoteType } from "../../../domain/job.js";
import { extractListItems, htmlToText } from "../../../utils/html.js";
import type { HttpJsonClient } from "./HttpClient.js";
import type { AtsClient, CompanyBoard } from "./types.js";

/** Shape of a Lever posting (fields we consume). */
export interface LeverPosting {
  id: string;
  text: string; // title
  createdAt?: number; // ms epoch
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string; // "remote" | "on-site" | "hybrid" | "unspecified"
  country?: string;
  descriptionPlain?: string;
  additionalPlain?: string;
  categories?: {
    commitment?: string;
    department?: string;
    team?: string;
    location?: string;
    allLocations?: string[];
  };
  lists?: Array<{ text?: string; content?: string }>;
}

const BASE = "https://api.lever.co/v0/postings";

/**
 * Lever Postings API client. Public JSON endpoint (`?mode=json`) intended for
 * programmatic use — no auth, no scraping.
 * Docs: https://github.com/lever/postings-api
 */
export class LeverClient implements AtsClient {
  readonly provider = "lever" as const;

  async fetchBoard(company: CompanyBoard, http: HttpJsonClient): Promise<RawJob[]> {
    const url = `${BASE}/${encodeURIComponent(company.board)}?mode=json`;
    const postings = await http.getJson<LeverPosting[]>(url);
    return (Array.isArray(postings) ? postings : []).map((p) => mapLeverPosting(p, company.name));
  }

  ownsUrl(url: string): boolean {
    return /jobs\.lever\.co\//i.test(url);
  }

  async fetchOne(url: string, http: HttpJsonClient): Promise<RawJob | null> {
    const m = url.match(/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]+)/i);
    if (!m) return null;
    const [, board, id] = m;
    const posting = await http.getJson<LeverPosting>(`${BASE}/${board}/${id}?mode=json`);
    return posting ? mapLeverPosting(posting, board!) : null;
  }
}

function mapWorkplace(workplaceType: string | undefined): RemoteType | undefined {
  switch ((workplaceType ?? "").toLowerCase()) {
    case "remote":
      return "remote";
    case "hybrid":
      return "hybrid";
    case "on-site":
    case "onsite":
      return "onsite";
    default:
      return undefined; // let the normalizer infer
  }
}

const REQ_RE = /(requirement|qualif|you have|what you|skills|looking for)/i;
const RESP_RE = /(responsib|you will|the role|the gig|day to day|what you'll do)/i;

/** Pure mapper: Lever posting -> RawJob. Exported for unit tests. */
export function mapLeverPosting(posting: LeverPosting, companyName: string): RawJob {
  const cat = posting.categories ?? {};
  const location = cat.location?.trim() || cat.allLocations?.filter(Boolean).join(", ") || posting.country;

  const requirements: string[] = [];
  const responsibilities: string[] = [];
  const extraSections: string[] = [];
  for (const list of posting.lists ?? []) {
    const items = extractListItems(list.content);
    const header = (list.text ?? "").trim();
    if (RESP_RE.test(header)) responsibilities.push(...items);
    else if (REQ_RE.test(header)) requirements.push(...items);
    else if (items.length) extraSections.push(`${header}: ${items.join("; ")}`);
  }

  const description = [posting.descriptionPlain, extraSections.join("\n"), posting.additionalPlain]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const applicationUrl = posting.applyUrl || posting.hostedUrl || "";
  return {
    source: "company-careers",
    externalId: `lever:${posting.id}`,
    title: posting.text.trim(),
    company: companyName,
    location: location?.trim() || undefined,
    remoteType: mapWorkplace(posting.workplaceType),
    employmentType: cat.commitment?.trim() || undefined,
    description,
    requirements,
    responsibilities,
    skills: [],
    postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
    applicationUrl,
    sourceUrl: posting.hostedUrl || applicationUrl,
  };
}
