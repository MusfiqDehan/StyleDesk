"use client";
import { createContext, useContext } from "react";
import { hasPermission, type User, accessKeyForPath } from "./auth-utils";
export type AccessAction =
  "view" | "create" | "edit" | "delete" | "export" | "invite" | "manage";
export const AdminAccessContext = createContext<{
  user: User;
  path: string;
} | null>(null);
export function useActionAccess(action?: AccessAction, feature?: string) {
  const context = useContext(AdminAccessContext);
  if (!context || !action) return true;
  const key = feature ?? accessKeyForPath(context.user, context.path);
  if (key === "update-password") return true;
  return !!key && hasPermission(context.user, key, action);
}
