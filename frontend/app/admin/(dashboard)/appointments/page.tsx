import { redirect } from "next/navigation"

export default function AppointmentsRedirectPage() {
  redirect("/admin/bookings")
}
