import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Bilingual legal sub-items shown in the proposal's "Algemene voorwaarden" block.
 * Managed in admin under Documents → Terms and conditions. Seeded with four
 * defaults on first read so a fresh DB renders a meaningful proposal.
 */
export interface IProposalTermsSection extends Document {
  slug: string;
  titleNL: string;
  titleEN: string;
  contentNL: string;
  contentEN: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProposalTermsSectionSchema = new Schema<IProposalTermsSection>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    titleNL: { type: String, required: true, trim: true },
    titleEN: { type: String, required: true, trim: true },
    contentNL: { type: String, required: true, default: "" },
    contentEN: { type: String, required: true, default: "" },
    rank: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

if (mongoose.models.ProposalTermsSection) {
  mongoose.deleteModel("ProposalTermsSection");
}
export const ProposalTermsSectionModel: Model<IProposalTermsSection> =
  mongoose.model<IProposalTermsSection>("ProposalTermsSection", ProposalTermsSectionSchema);

/** Default seed rows installed when the collection is empty. */
export const DEFAULT_TERMS_SECTIONS: Omit<IProposalTermsSection, "_id" | "createdAt" | "updatedAt" | keyof Document>[] = [
  {
    slug: "scope",
    titleNL: "Scope & activiteiten",
    titleEN: "Scope & activities",
    contentNL:
      "SUMM levert uitsluitend wat expliciet in dit voorstel staat. Aanvullende werkzaamheden vallen buiten scope en worden schriftelijk vastgelegd inclusief kosten.",
    contentEN:
      "SUMM delivers only what is explicitly stated in this proposal. Additional work falls outside scope and is captured in writing including costs.",
    rank: 0,
  },
  {
    slug: "ownership",
    titleNL: "Eigendom inhoud",
    titleEN: "Content ownership",
    contentNL:
      "Alle opgeleverde teksten en ontwerpen zijn eigendom van de klant. SUMM behoudt het recht om eerdere opleveringen als referentiemateriaal te gebruiken, tenzij de klant expliciet verzoekt hiervan af te zien. De SUMM-methodiek blijft eigendom van SUMM.",
    contentEN:
      "All delivered texts and designs are owned by the client. SUMM retains the right to use prior deliverables as reference material unless the client explicitly opts out. The SUMM methodology remains the property of SUMM.",
    rank: 1,
  },
  {
    slug: "confidentiality",
    titleNL: "Vertrouwelijkheid",
    titleEN: "Confidentiality",
    contentNL:
      "SUMM behandelt alle gedeelde informatie strikt vertrouwelijk en deelt niets met derden zonder expliciete toestemming. Deze verplichting blijft ook na afloop van de samenwerking van kracht.",
    contentEN:
      "SUMM treats all shared information as strictly confidential and shares nothing with third parties without explicit consent. This obligation remains in force after the engagement ends.",
    rank: 2,
  },
  {
    slug: "general",
    titleNL: "Algemene voorwaarden",
    titleEN: "General terms",
    contentNL:
      "NLdigital Voorwaarden 2020, gedeponeerd bij de Rechtbank Midden-Nederland, Utrecht. Beschikbaar via summ.nl of op aanvraag per e-mail.",
    contentEN:
      "NLdigital Terms 2020, filed with the Midden-Nederland District Court, Utrecht. Available via summ.nl or on request by email.",
    rank: 3,
  },
];

/** Ensure default sections exist; returns the current ordered list. */
export async function getOrSeedProposalTerms() {
  const count = await ProposalTermsSectionModel.estimatedDocumentCount();
  if (count === 0) {
    await ProposalTermsSectionModel.insertMany(DEFAULT_TERMS_SECTIONS);
  }
  return ProposalTermsSectionModel.find({}).sort({ rank: 1, createdAt: 1 }).lean();
}
