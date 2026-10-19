"use client";

import { ArrowUpRight } from "lucide-react";
import { useBooking } from "@/context/BookingContext";
import styles from "./people.module.css";

export function MemberBookingButton({
  stylistName,
}: {
  stylistName: string;
}) {
  const { openBooking } = useBooking();
  const firstName = stylistName?.split(" ")[0] || "this stylist";

  return (
    <button
      type="button"
      className={styles.primaryButton}
      onClick={() => openBooking(undefined, stylistName)}
    >
      Book with {firstName} <ArrowUpRight size={17} />
    </button>
  );
}
