import type { Role } from "./types";

export function routeAllowed(role: Role, path: string): boolean {
  if (path.startsWith("/account")) return true;
  if (role === "admin") return path.startsWith("/admin");
  if (role === "viewer") return path === "/" || path.startsWith("/reports");
  if (path.startsWith("/admin") || path.startsWith("/inbox")) return false;
  if (path === "/") return true;
  if (path.startsWith("/reports"))
    return ["leader", "intake", "viewer"].includes(role);
  if (path.startsWith("/notifications")) return true;
  if (path.startsWith("/dispatch")) return role === "leader";
  if (path.startsWith("/handover")) return ["leader", "intake"].includes(role);
  if (
    path.startsWith("/import") ||
    path === "/leads/create" ||
    /^\/leads\/[^/]+$/.test(path)
  )
    return role === "intake";
  if (path.startsWith("/leads")) return true;
  if (path.startsWith("/appointments"))
    return ["leader", "intake", "telesale"].includes(role);
  if (path.startsWith("/tasks")) return ["leader", "telesale"].includes(role);
  return true;
}

