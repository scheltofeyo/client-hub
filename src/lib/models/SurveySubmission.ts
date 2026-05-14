import mongoose, { Schema, Document, Model } from "mongoose";
import type { SurveyQuestionType } from "./SurveyTemplateQuestion";

export interface ISurveyAnswer {
  questionId: string;
  type?: SurveyQuestionType;
  // archetype-ranking / general-ranking: option-id (or item-id) -> rank (1..N)
  // Persisted as Mongoose Map; surfaces as plain object on .lean() reads.
  rankings?: Record<string, number>;
  // multiple-choice
  selectedChoiceIds?: string[];
  // open-text
  text?: string;
  // legacy: pre-migration single-question open-text comment attached to a rank-question
  openText?: string;
}

export interface ISurveySectionOpenAnswer {
  sectionId: string;
  text: string;
}

export interface ISurveySubmission extends Document {
  sessionId: string;
  /**
   * Legacy field — kept for historical submissions. The public form no
   * longer collects a name; new submissions store an empty string.
   */
  participantName?: string;
  participantEmail: string;
  status: "in_progress" | "completed";
  answers: ISurveyAnswer[];
  // legacy fields — keep for backwards-compat reads until migration script runs
  sectionOpenAnswers: ISurveySectionOpenAnswer[];
  closingOpenAnswer?: string;
  // Free-form cohort tags for future cohort-slicing in results (e.g.
  // { team: "leadership", department: "engineering" }). Not surfaced in v1 UI;
  // persisted so later filters land without a schema migration.
  cohortTags?: Record<string, string>;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<ISurveyAnswer>(
  {
    questionId: { type: String, required: true },
    type: {
      type: String,
      enum: ["archetype-ranking", "general-ranking", "multiple-choice", "open-text", "intro"],
    },
    rankings: { type: Map, of: Number, default: undefined },
    selectedChoiceIds: { type: [String], default: undefined },
    text: { type: String, trim: true },
    openText: { type: String, trim: true },
  },
  { _id: false }
);

const SectionOpenAnswerSchema = new Schema<ISurveySectionOpenAnswer>(
  {
    sectionId: { type: String, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const SurveySubmissionSchema = new Schema<ISurveySubmission>(
  {
    sessionId: { type: String, required: true },
    participantName: { type: String, trim: true, default: "" },
    participantEmail: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    answers: { type: [AnswerSchema], default: [] },
    sectionOpenAnswers: { type: [SectionOpenAnswerSchema], default: [] },
    closingOpenAnswer: { type: String, trim: true },
    cohortTags: { type: Map, of: String, default: undefined },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

SurveySubmissionSchema.index(
  { sessionId: 1, participantEmail: 1 },
  { unique: true }
);
SurveySubmissionSchema.index({ sessionId: 1 });

// Collection name pinned to legacy value to keep existing data in place.
if (mongoose.models.SurveySubmission) {
  mongoose.deleteModel("SurveySubmission");
}
export const SurveySubmissionModel: Model<ISurveySubmission> =
  mongoose.model<ISurveySubmission>(
    "SurveySubmission",
    SurveySubmissionSchema,
    "archetypesurveysubmissions"
  );
