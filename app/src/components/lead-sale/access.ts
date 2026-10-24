import type { Role } from "./types";
// Route matrix after NOTE SỬA 24/10/2026; the server enforces the same scope.
export function routeAllowed(role: Role, path: string) {
  if (path === "/" || path.startsWith("/account")) return true;
  if (path.startsWith("/notifications")) return role !== "viewer";
  if (role === "admin") return path.startsWith("/admin");
  if (path.startsWith("/admin") || path.startsWith("/inbox")) return false;
  if (path.startsWith("/reports"))
    return ["leader", "intake", "viewer"].includes(role);
  if (path.startsWith("/dispatch")) return role === "leader";
  if (path.startsWith("/handover")) return ["leader", "intake"].includes(role);
  if (
    path.startsWith("/import") ||
    path === "/leads/create" ||
    /^\/leads\/[^/]+$/.test(path)
  )
    return role === "intake";
  if (path.startsWith("/leads")) return role !== "viewer";
  if (path.startsWith("/appointments"))
    return ["leader", "intake", "telesale"].includes(role);
  if (path.startsWith("/tasks")) return ["leader", "telesale"].includes(role);
  return true;
}
