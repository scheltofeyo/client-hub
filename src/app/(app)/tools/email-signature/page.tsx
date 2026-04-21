import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hasPermission } from "@/lib/auth-helpers";
import PageHeader from "@/components/layout/PageHeader";
import EmailSignatureEditor, { type SignatureUser } from "@/components/email-signature/EmailSignatureEditor";

export const dynamic = "force-dynamic";

async function loadSignatureUser(id: string): Promise<SignatureUser | null> {
  const user = await UserModel.findById(id).lean();
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    jobTitle: user.jobTitle ?? "",
    phone: user.phone ?? "",
  };
}

export default async function EmailSignaturePage() {
  const session = await auth();
  if (!session || !hasPermission(session, "tools.emailSignature.access")) {
    redirect("/tools");
  }

  await connectDB();

  const canGenerateAny = hasPermission(session, "tools.emailSignature.generateAny");

  const initialUser = await loadSignatureUser(session.user.id);
  if (!initialUser) redirect("/tools");

  let allUsers: SignatureUser[] = [];
  if (canGenerateAny) {
    const users = await UserModel.find({ status: { $ne: "inactive" } })
      .sort({ name: 1 })
      .lean();
    allUsers = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      image: u.image ?? null,
      jobTitle: u.jobTitle ?? "",
      phone: u.phone ?? "",
    }));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Email Signature" }]}
        title="Email Signature"
      />
      <div className="flex-1 overflow-y-auto">
        <EmailSignatureEditor
          initialUser={initialUser}
          allUsers={allUsers}
          canGenerateAny={canGenerateAny}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
