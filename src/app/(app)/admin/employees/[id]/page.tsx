import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hasPermission } from "@/lib/auth-helpers";
import EmployeeDetailEditor from "./EmployeeDetailEditor";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || !hasPermission(session, "admin.access")) redirect("/dashboard");

  const { id } = await params;
  await connectDB();

  const user = await UserModel.findById(id).lean();
  if (!user) notFound();

  const employee = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? "member",
    status: user.status ?? "active",
    googleName: user.googleName ?? null,
    googleImage: user.googleImage ?? null,
    displayName: user.displayName ?? "",
    displayImage: user.displayImage ?? "",
    firstName: user.firstName ?? "",
    preposition: user.preposition ?? "",
    lastName: user.lastName ?? "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split("T")[0] : "",
    dateStarted: user.dateStarted ? user.dateStarted.toISOString().split("T")[0] : "",
    employeeNumber: user.employeeNumber ?? "",
    vacationDays: user.vacationDays ?? null,
    contractType: user.contractType ?? "",
    contractHours: user.contractHours ?? null,
    contractEndDate: user.contractEndDate ? user.contractEndDate.toISOString().split("T")[0] : "",
    phone: user.phone ?? "",
    emergencyContactName: user.emergencyContactName ?? "",
    emergencyContactPhone: user.emergencyContactPhone ?? "",
    notes: user.notes ?? "",
    invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <EmployeeDetailEditor
        employee={employee}
        isCurrentUser={session.user.id === employee.id}
        mode="admin"
      />
    </div>
  );
}
