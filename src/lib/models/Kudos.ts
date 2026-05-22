import mongoose, { Schema, Document, Model } from "mongoose";

export const KUDOS_REACTION_EMOJIS = ["clap", "raise", "heart", "fire"] as const;
export type KudosReactionEmoji = (typeof KUDOS_REACTION_EMOJIS)[number];

export interface IKudosReaction {
  userId: string;
  emoji: KudosReactionEmoji;
  createdAt: Date;
}

export interface IKudosRecipient {
  userId: string;
  name: string;
  image?: string;
}

export interface IKudosCategorySnapshot {
  slug: string;
  label: string;
  color: string;
  icon: string;
}

export interface IKudos extends Document {
  fromUserId: string;
  fromUserName: string;
  fromUserImage?: string;
  toUserIds: string[];
  toUsers: IKudosRecipient[];
  message: string;
  categoryId?: string;
  categorySnapshot?: IKudosCategorySnapshot;
  reactions: IKudosReaction[];
  createdAt: Date;
  updatedAt: Date;
}

const KudosSchema = new Schema<IKudos>(
  {
    fromUserId: { type: String, required: true, index: true },
    fromUserName: { type: String, required: true },
    fromUserImage: { type: String },
    toUserIds: { type: [String], required: true, index: true },
    toUsers: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
      ],
      default: [],
    },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    categoryId: { type: String },
    categorySnapshot: {
      type: {
        slug: { type: String, required: true },
        label: { type: String, required: true },
        color: { type: String, required: true },
        icon: { type: String, required: true },
      },
      default: undefined,
    },
    reactions: {
      type: [
        {
          userId: { type: String, required: true },
          emoji: { type: String, required: true, enum: KUDOS_REACTION_EMOJIS },
          createdAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

KudosSchema.index({ createdAt: -1 });
KudosSchema.index({ toUserIds: 1, createdAt: -1 });

if (mongoose.models.Kudos) {
  mongoose.deleteModel("Kudos");
}
export const KudosModel: Model<IKudos> = mongoose.model<IKudos>("Kudos", KudosSchema);
