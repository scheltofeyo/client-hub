import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      permissions: string[];
      leadPermissions: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role?: string;
    permissions?: string[];
    leadPermissions?: string[];
    image?: string | null;
  }
}
