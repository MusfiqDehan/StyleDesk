import { selectedBranch } from "./branch-selection";
export async function consoleApi(path: string, method = "GET", body?: unknown) {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("accessToken");
  const response = await fetch("/api/backend" + path, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(selectedBranch() ? { "x-branch-id": selectedBranch()! } : {}),
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Service unavailable");
  }
  if (!response.ok || data.statusCode === 502)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : (data.message ?? data.error ?? "Request failed"),
    );
  return data;
}
