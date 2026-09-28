import { isAxiosError } from "axios";

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  if (!error.response)
    return "We couldn’t connect to the booking service. Please check your connection and try again.";
  if (error.response.status >= 500)
    return "The booking service is temporarily unavailable. Please try again shortly.";
  const message: unknown = error.response.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === "string")
  )
    return message.join(" ");
  return fallback;
}
