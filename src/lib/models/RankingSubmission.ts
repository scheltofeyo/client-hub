import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRankingSubmission extends Document {
  sessionId: string;
  participantName: string;
  participantEmail: string;
  rankings: string[] | null;
  status: "in_progress" | "completed";
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RankingSubmissionSchema = new Schema<IRankingSubmission>(
  {
    sessionId: { type: String, required: true },
    participantName: { type: String, required: true, trim: true },
    participantEmail: { type: String, required: true, trim: true },
    rankings: { type: [String], default: null },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// One submission per email per session
RankingSubmissionSchema.index({ sessionId: 1, participantEmail: 1 }, { unique: true });
RankingSubmissionSchema.index({ sessionId: 1 });

if (mongoose.models.RankingSubmission) {
  mongoose.deleteModel("RankingSubmission");
}
export const RankingSubmissionModel: Model<IRankingSubmission> = mongoose.model<IRankingSubmission>(
  "RankingSubmission",
  RankingSubmissionSchema
);
