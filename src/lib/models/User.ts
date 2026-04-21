import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUser extends Document {
  // Google identity
  googleId?: string;
  email: string;

  // Google-sourced (auto-populated on login)
  googleName?: string;
  googleImage?: string;

  // Admin-controlled display overrides
  displayName?: string;
  displayImage?: string;

  // Structured name
  firstName?: string;
  preposition?: string;
  lastName?: string;

  // Employment
  dateOfBirth?: Date;
  dateStarted?: Date;
  employeeNumber?: string;
  vacationDays?: number;
  contractType?: string;
  contractHours?: number;
  contractEndDate?: Date;
  jobTitle?: string;

  // Contact
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Admin notes
  notes?: string;

  // Role & status
  role: string;
  status: "invited" | "active" | "inactive";

  // Invitation tracking
  invitedBy?: Types.ObjectId;
  invitedAt?: Date;

  // Computed (auto-synced via hooks)
  name: string;
  image?: string;

  createdAt: Date;
  updatedAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Build the display name from available fields */
function computeName(doc: any): string {
  if (doc.displayName) return doc.displayName as string;
  if (doc.googleName) return doc.googleName as string;
  const parts = [doc.firstName, doc.preposition, doc.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return (doc.email as string) ?? "Unknown";
}

/** Build the display image from available fields */
function computeImage(doc: any): string | undefined {
  return (doc.displayImage as string) ?? (doc.googleImage as string) ?? undefined;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const UserSchema = new Schema<IUser>(
  {
    // Google identity
    googleId: { type: String, sparse: true, unique: true },
    email: { type: String, required: true, unique: true },

    // Google-sourced
    googleName: { type: String },
    googleImage: { type: String },

    // Admin-controlled display overrides
    displayName: { type: String },
    displayImage: { type: String },

    // Structured name
    firstName: { type: String },
    preposition: { type: String },
    lastName: { type: String },

    // Employment
    dateOfBirth: { type: Date },
    dateStarted: { type: Date },
    employeeNumber: { type: String },
    vacationDays: { type: Number },
    contractType: { type: String },
    contractHours: { type: Number },
    contractEndDate: { type: Date },
    jobTitle: { type: String },

    // Contact
    phone: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },

    // Admin notes
    notes: { type: String },

    // Role & status
    role: { type: String, default: "member" },
    status: { type: String, enum: ["invited", "active", "inactive"], default: "active" },

    // Invitation tracking
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    invitedAt: { type: Date },

    // Computed
    name: { type: String, required: true },
    image: { type: String },
  },
  { timestamps: true }
);

// Recompute derived fields before save
UserSchema.pre("save", function () {
  this.name = computeName(this.toObject());
  this.image = computeImage(this.toObject());
});

// Recompute derived fields on findOneAndUpdate
UserSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (!update) return;

  // Flatten $set if present
  const setFields = (update.$set as Record<string, unknown>) ?? {};
  const merged = { ...setFields };

  // Check if any name-relevant or image-relevant fields are being updated
  const nameFields = ["displayName", "googleName", "firstName", "preposition", "lastName", "email"];
  const imageFields = ["displayImage", "googleImage"];
  const touchesName = nameFields.some((f) => f in merged);
  const touchesImage = imageFields.some((f) => f in merged);

  // We can only recompute if we have the full doc context, so we use
  // the update values. For partial updates, the pre-save hook on the
  // actual document handles it. Here we set the $set fields directly.
  if (touchesName) {
    (update.$set as Record<string, unknown>).name = computeName(merged);
  }
  if (touchesImage) {
    (update.$set as Record<string, unknown>).image = computeImage(merged);
  }
});

if (mongoose.models.User) {
  mongoose.deleteModel("User");
}
export const UserModel: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
