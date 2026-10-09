"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@admin/hooks/use-auth";
import { hasPermission } from "@admin/lib/auth-utils";
import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Clock,
  CreditCard,
  ImagePlus,
  Loader2,
  Upload,
  X,
  Globe,
  User,
} from "lucide-react";
import { ClockPickerField } from "@/components/ui/clock-picker";
import { Switch } from "@/components/ui/switch";
import {
  getBusinessInfo,
  updateBusinessInfo,
  getAppointmentSettings,
  updateAppointmentSettings,
  getInvoiceSettings,
  updateInvoiceSettings,
  uploadBusinessLogo,
  type BusinessInfo,
  type AppointmentSetting,
  type InvoiceSetting,
} from "@admin/api/settings/settings";
import { toast } from "@/lib/toast";
import { useBusiness } from "@/context/BusinessContext";
import { cn, getMediaUrl } from "@/lib/utils";
import { AdminPageHeader } from "@admin/components/admin-page-header";
import { DashPage } from "@admin/components/dash";
import {
  getMyProfile,
  updateMyProfile,
  sendEmailChangeCode,
  confirmEmailChange,
} from "@admin/api/update-password/update-profile";

import {
  DEFAULT_BRAND_COLOR,
  getBrandTheme,
  isBrandColor,
} from "@/lib/brand-theme";

const TAB_ITEMS = [
  { value: "personal", label: "Personal", icon: User },
  { value: "business", label: "Business", icon: Building2 },
  { value: "booking", label: "Booking", icon: Clock },
  { value: "billing", label: "Billing", icon: CreditCard },
] as const;

function Panel({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-line bg-white">
      <header className="border-b border-brand-line px-5 py-5 sm:px-6">
        <h2 className="text-[17px] font-semibold tracking-tight text-brand-ink">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-5 text-brand-muted">{description}</p>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      <footer className="border-t border-brand-line bg-brand-mist px-5 py-4 sm:px-6">
        <div className="flex justify-end">{footer}</div>
      </footer>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-brand-ink"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-brand-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
      {children}
    </p>
  );
}

function currencySymbol(code?: string) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return "৳";
}

export default function SettingsPage() {
  const pathname = usePathname();
  const { user, loading: accessLoading } = useAuth();
  const tabAccess = (value: string) =>
    value === "personal" ||
    hasPermission(
      user,
      value === "business"
        ? "settings"
        : value === "booking"
          ? "settings.booking"
          : "settings.invoice",
    );
  const { refresh: refreshBusinessName } = useBusiness();
  const [activeTab, setActiveTab] = useState(
    pathname.endsWith("/booking")
      ? "booking"
      : pathname.endsWith("/invoice")
        ? "billing"
        : "personal",
  );
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [savedPersonalName, setSavedPersonalName] = useState("");
  const [savedPersonalEmail, setSavedPersonalEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessInfo>({
    primaryColor: DEFAULT_BRAND_COLOR,
    businessName: "",
    email: "",
    phone: "",
    address: "",
    gstNumber: "",
    hideMainWebsite: false,
  });
  const [bookingSettings, setBookingSettings] = useState<AppointmentSetting>({
    openingTime: "",
    closingTime: "",
    defaultSlotDuration: 30,
    advanceBookingWindow: 30,
  });
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSetting>({
    defaultCurrency: "BDT",
    taxRate: 15,
  });
  const [taxRateInput, setTaxRateInput] = useState("15");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  const persistToken = (token: string) => {
    localStorage.setItem("accessToken", token);
    const maxAge = 10 * 24 * 60 * 60;
    document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=strict`;
  };

  const emailChanged =
    personalEmail.trim().toLowerCase() !==
    savedPersonalEmail.trim().toLowerCase();
  const nameChanged = personalName.trim() !== savedPersonalName.trim();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail.trim());

  useEffect(() => {
    if (accessLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const [businessResult, bookingResult, invoiceResult, meResult] =
          await Promise.allSettled([
            getBusinessInfo(),
            tabAccess("booking")
              ? getAppointmentSettings()
              : Promise.resolve(null),
            tabAccess("billing") ? getInvoiceSettings() : Promise.resolve(null),
            getMyProfile(),
          ]);
        if (cancelled) return;

        if (businessResult.status === "fulfilled" && businessResult.value) {
          const business = businessResult.value;
          setBusinessSettings({
            ...business,
            primaryColor: business.primaryColor || DEFAULT_BRAND_COLOR,
            businessName: business.businessName ?? "",
            email: business.email ?? "",
            phone: business.phone ?? "",
            address: business.address ?? "",
            gstNumber: business.gstNumber ?? "",
            hideMainWebsite: Boolean(business.hideMainWebsite),
          });
          setLogoPreview(business.logoUrl ?? null);
        }
        if (bookingResult.status === "fulfilled" && bookingResult.value) {
          setBookingSettings(bookingResult.value);
        }
        if (invoiceResult.status === "fulfilled" && invoiceResult.value) {
          setInvoiceSettings(invoiceResult.value);
          const rate = Number(invoiceResult.value.taxRate);
          setTaxRateInput(Number.isFinite(rate) ? String(rate) : "0");
        }
        if (meResult.status === "fulfilled" && meResult.value) {
          const me = meResult.value;
          const name = me.name || me.clientName || me.employeeName || "";
          const email = me.useremail || "";
          setPersonalName(name);
          setSavedPersonalName(name);
          setPersonalEmail(email);
          setSavedPersonalEmail(email);
          setPersonalPhone(me.phone || "");
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessLoading, user?.permissions.join(","), user?.features?.join(",")]);

  // Reset OTP state whenever the typed email changes away from a pending target
  useEffect(() => {
    setEmailOtp("");
    setEmailOtpSent(false);
  }, [personalEmail]);

  const handleSavePersonalName = async () => {
    const name = personalName.trim();
    if (!name) {
      toast.error("Full name is required");
      return;
    }
    setSavingPersonal(true);
    try {
      const payload: { name: string; phone?: string } = { name };
      if (personalPhone.trim()) payload.phone = personalPhone.trim();
      const data = await updateMyProfile(payload);
      if (data.accessToken) persistToken(data.accessToken);
      const nextName = data.name || name;
      setSavedPersonalName(nextName);
      setPersonalName(nextName);
      toast.success("Name updated successfully");
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(
        Array.isArray(message)
          ? message.join(", ")
          : message || "Failed to update name",
      );
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!isValidEmail) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!emailChanged) {
      toast.error("Enter a new email address to verify");
      return;
    }
    setSendingEmailOtp(true);
    try {
      await sendEmailChangeCode(personalEmail.trim());
      setEmailOtpSent(true);
      setEmailOtp("");
      toast.success("OTP sent to your new email");
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(
        Array.isArray(message)
          ? message.join(", ")
          : message || "Failed to send OTP",
      );
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!emailChanged) {
      toast.error("Email is unchanged");
      return;
    }
    if (!emailOtpSent) {
      toast.error("Send and enter the OTP first");
      return;
    }
    if (!/^\d{6}$/.test(emailOtp.trim())) {
      toast.error("Enter the 6-digit OTP from your email");
      return;
    }
    setConfirmingEmail(true);
    try {
      const data = await confirmEmailChange(
        personalEmail.trim(),
        emailOtp.trim(),
      );
      if (data.accessToken) persistToken(data.accessToken);
      const nextEmail = data.useremail;
      setSavedPersonalEmail(nextEmail);
      setPersonalEmail(nextEmail);
      setEmailOtp("");
      setEmailOtpSent(false);
      toast.success("Email updated successfully");
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(
        Array.isArray(message)
          ? message.join(", ")
          : message || "Failed to update email",
      );
    } finally {
      setConfirmingEmail(false);
    }
  };

  const handleSaveBusinessInfo = async () => {
    if (!isBrandColor(businessSettings.primaryColor)) {
      toast.error("Enter a valid six-digit hex color, such as #7040c1");
      return;
    }
    setSavingBusiness(true);
    try {
      const response = await updateBusinessInfo(businessSettings);
      if (response) setBusinessSettings(response);
      await refreshBusinessName();
      toast.success("Business settings updated successfully");
    } catch {
      toast.error("Failed to update business settings");
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setSavingLogo(true);
    try {
      const updated = await uploadBusinessLogo(logoFile);
      setLogoFile(null);
      if (updated?.logoUrl) {
        setLogoPreview(updated.logoUrl);
        setBusinessSettings((prev) => ({ ...prev, logoUrl: updated.logoUrl }));
      }
      await refreshBusinessName();
      toast.success("Business logo updated successfully");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setSavingLogo(false);
    }
  };

  const handleSaveBookingSettings = async () => {
    setSavingBooking(true);
    try {
      const response = await updateAppointmentSettings(bookingSettings);
      if (response) setBookingSettings(response);
      toast.success("Booking settings updated successfully");
    } catch {
      toast.error("Failed to update booking settings");
    } finally {
      setSavingBooking(false);
    }
  };

  const handleSaveInvoiceSettings = async () => {
    const parsed =
      taxRateInput.trim() === "" || taxRateInput === "."
        ? 0
        : Number(taxRateInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Enter a valid VAT rate (number)");
      return;
    }

    setSavingInvoice(true);
    try {
      const payload = { ...invoiceSettings, taxRate: parsed };
      const response = await updateInvoiceSettings(payload);
      if (response) {
        setInvoiceSettings(response);
        const rate = Number(response.taxRate);
        setTaxRateInput(Number.isFinite(rate) ? String(rate) : String(parsed));
      }
      toast.success("Billing settings updated successfully");
    } catch {
      toast.error("Failed to update billing settings");
    } finally {
      setSavingInvoice(false);
    }
  };

  const phoneInvalid =
    !!businessSettings.phone?.trim() &&
    !/^(?:\+88|88)?01[3-9]\d{8}$/.test(
      businessSettings.phone.replace(/[\s-]/g, ""),
    );

  const symbol = currencySymbol(invoiceSettings.defaultCurrency);

  if (loading) {
    return (
      <DashPage>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-8 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-72 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </DashPage>
    );
  }

  return (
    <DashPage>
      <AdminPageHeader
        title="Settings"
        subtitle="Configure business details and salon preferences"
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-5"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-brand-line bg-brand-mist p-1 sm:grid-cols-4">
          {TAB_ITEMS.filter((item) => tabAccess(item.value)).map(
            ({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium text-brand-muted sm:gap-2 sm:text-sm",
                  "data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ),
          )}
        </TabsList>

        {/* Personal */}
        <TabsContent value="personal" className="mt-0 space-y-4 outline-none">
          <Panel
            title="Personal account"
            description="Update your display name and login email"
            footer={
              <Button
                className="min-w-[140px]"
                onClick={() => void handleSavePersonalName()}
                disabled={
                  savingPersonal || !nameChanged || !personalName.trim()
                }
               accessAction="edit">
                {savingPersonal && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save name
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="personal-name">
                <Input
                  id="personal-name"
                  value={personalName}
                  onChange={(e) => setPersonalName(e.target.value)}
                  placeholder="e.g. Alex Rahman"
                  className="h-11"
                />
              </Field>

              <Field
                label="Email"
                htmlFor="personal-email"
                hint={
                  emailChanged
                    ? "Changing email requires OTP verification sent to the new address."
                    : "This is your login email."
                }
              >
                <Input
                  id="personal-email"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
              </Field>
            </div>

            {emailChanged && (
              <div className="space-y-4 rounded-xl border border-brand-line bg-brand-mist p-4">
                <SectionLabel>Email verification</SectionLabel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field
                    label="OTP code"
                    htmlFor="personal-email-otp"
                    className="flex-1"
                    hint={
                      emailOtpSent
                        ? "Check your new inbox for a 6-digit code."
                        : "Send a code to the new email first."
                    }
                  >
                    <Input
                      id="personal-email-otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) =>
                        setEmailOtp(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder="e.g. 123456"
                      className="h-11 tracking-[0.2em]"
                      disabled={!emailOtpSent}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    onClick={() => void handleSendEmailOtp()}
                    disabled={sendingEmailOtp || !isValidEmail}
                  >
                    {sendingEmailOtp && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {emailOtpSent ? "Resend OTP" : "Send OTP"}
                  </Button>
                </div>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => void handleConfirmEmailChange()}
                  disabled={
                    confirmingEmail ||
                    !emailOtpSent ||
                    emailOtp.trim().length !== 6
                  }
                 accessAction="edit">
                  {confirmingEmail && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verify & update email
                </Button>
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* Business */}
        {tabAccess("business") && (
          <TabsContent value="business" className="mt-0 space-y-4 outline-none">
            <fieldset
              disabled={!hasPermission(user, "settings", "edit")}
              className="contents"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Business Logo"
                  description="Shown on invoices, receipts, and public pages"
                  footer={
                    <Button
                      className="min-w-[140px]"
                      onClick={handleUploadLogo}
                      disabled={savingLogo || !logoFile}
                    >
                      {savingLogo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload Logo
                    </Button>
                  }
                >
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
                    <div className="relative shrink-0">
                      <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-brand-line bg-brand-mist">
                        {logoPreview ? (
                          <img
                            src={
                              logoPreview.startsWith("data:")
                                ? logoPreview
                                : getMediaUrl(logoPreview)
                            }
                            alt="Business Logo"
                            className="size-full object-contain"
                          />
                        ) : (
                          <ImagePlus className="size-8 text-brand-muted" />
                        )}
                      </div>
                      {logoFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(businessSettings.logoUrl ?? null);
                          }}
                          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                          aria-label="Clear selected logo"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex w-full flex-col items-center gap-2 sm:items-start">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-mist">
                        <ImagePlus className="size-4 text-brand-muted" />
                        {logoPreview ? "Change Logo" : "Select Logo"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setLogoFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () =>
                              setLogoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <p className="text-xs text-brand-muted">
                        PNG, JPG, WebP or SVG · Max 5 MB · Shown on your website and admin panel
                      </p>
                      {logoFile && (
                        <p className="truncate text-xs font-medium text-brand-primary">
                          Ready: {logoFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Website Visibility"
                  description="Control whether visitors can browse the public marketing website"
                  footer={
                    <Button
                      className="min-w-[140px]"
                      onClick={handleSaveBusinessInfo}
                      disabled={savingBusiness}
                     accessAction="edit">
                      {savingBusiness && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  }
                >
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-brand-line bg-brand-mist px-4 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 shrink-0 text-brand-primary" />
                        <p className="text-sm font-semibold text-brand-ink">
                          Hide Main Website
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed text-brand-muted">
                        When enabled, the public site is unavailable. Visitors
                        see the administration login instead. The admin panel
                        stays accessible.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(businessSettings.hideMainWebsite)}
                      onCheckedChange={(checked) =>
                        setBusinessSettings((prev) => ({
                          ...prev,
                          hideMainWebsite: checked,
                        }))
                      }
                      aria-label="Hide Main Website"
                      className="mt-0.5 data-[state=checked]:bg-brand-primary"
                    />
                  </div>
                </Panel>
              </div>

              <Panel
                title="Website appearance"
                description="Choose the primary color for the landing page and booking cart. Saved changes apply to every visitor."
                footer={
                  <Button
                    onClick={handleSaveBusinessInfo}
                    disabled={
                      savingBusiness ||
                      !isBrandColor(businessSettings.primaryColor)
                    }
                   accessAction="edit">
                    {savingBusiness && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save appearance
                  </Button>
                }
              >
                <Field
                  label="Primary color"
                  htmlFor="brand-color"
                  hint="Purple is the default. Backgrounds and readable button text adapt automatically."
                >
                  <div className="flex items-center gap-3">
                    <input
                      id="brand-color"
                      type="color"
                      className="h-11 w-14 cursor-pointer rounded-lg border border-brand-line p-1"
                      value={
                        getBrandTheme(businessSettings.primaryColor).primary
                      }
                      onChange={(e) =>
                        setBusinessSettings((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                    />
                    <Input placeholder="e.g. #7040c1"
                      aria-label="Primary color hex code"
                      className="max-w-40 font-mono"
                      maxLength={7}
                      value={businessSettings.primaryColor || ""}
                      onChange={(e) =>
                        setBusinessSettings((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="text-sm underline"
                      onClick={() =>
                        setBusinessSettings((prev) => ({
                          ...prev,
                          primaryColor: DEFAULT_BRAND_COLOR,
                        }))
                      }
                    >
                      Reset to purple
                    </button>
                  </div>
                </Field>
                <div
                  className="flex flex-wrap gap-3"
                  aria-label="Suggested brand colors"
                >
                  {[
                    { name: "Purple", color: "#7040c1" },
                    { name: "Plum", color: "#933366" },
                    { name: "Indigo", color: "#4349b4" },
                    { name: "Teal", color: "#087e83" },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.color}
                      aria-label={`Use ${preset.name}`}
                      aria-pressed={
                        businessSettings.primaryColor === preset.color
                      }
                      onClick={() =>
                        setBusinessSettings((prev) => ({
                          ...prev,
                          primaryColor: preset.color,
                        }))
                      }
                      className="flex items-center gap-2 rounded-full border border-brand-line px-3 py-2 text-xs aria-pressed:ring-2 aria-pressed:ring-brand-primary aria-pressed:ring-offset-2"
                    >
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ background: preset.color }}
                      />
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-line p-5"
                  style={{
                    background: `color-mix(in srgb, ${getBrandTheme(businessSettings.primaryColor).primary} 8%, white)`,
                  }}
                >
                  <div>
                    <p className="text-xs text-brand-muted">Live preview</p>
                    <p
                      className="mt-1 text-lg font-semibold"
                      style={{
                        color: getBrandTheme(businessSettings.primaryColor)
                          .text,
                      }}
                    >
                      Make yourself a priority.
                    </p>
                  </div>
                  <span
                    className="rounded-full px-5 py-3 text-sm"
                    style={{
                      background: getBrandTheme(businessSettings.primaryColor)
                        .primary,
                      color: getBrandTheme(businessSettings.primaryColor)
                        .foreground,
                    }}
                  >
                    Book an appointment ↗
                  </span>
                </div>
              </Panel>

              <Panel
                title="Business Information"
                description="Public salon details for the website Contact page, receipts, and invoices — separate from your login credentials"
                footer={
                  <Button
                    className="min-w-[140px]"
                    onClick={handleSaveBusinessInfo}
                    disabled={savingBusiness}
                   accessAction="edit">
                    {savingBusiness && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                }
              >
                <Field label="Business Name" htmlFor="biz-name">
                  <Input
                    id="biz-name"
                    placeholder="e.g. Geek Salon"
                    value={businessSettings.businessName || ""}
                    onChange={(e) =>
                      setBusinessSettings({
                        ...businessSettings,
                        businessName: e.target.value,
                      })
                    }
                  />
                </Field>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Business Email"
                    htmlFor="biz-email"
                    hint="Shown on the public Contact page — not used for admin login"
                  >
                    <Input
                      id="biz-email"
                      type="email"
                      placeholder="hello@yoursalon.com"
                      value={businessSettings.email || ""}
                      onChange={(e) =>
                        setBusinessSettings({
                          ...businessSettings,
                          email: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field
                    label="Business Phone"
                    htmlFor="biz-phone"
                    error={
                      phoneInvalid
                        ? "Enter a valid Bangladeshi number (e.g. 01712345678)"
                        : undefined
                    }
                    hint={
                      phoneInvalid
                        ? undefined
                        : "Shown on the public Contact page — not your personal login phone"
                    }
                  >
                    <Input
                      id="biz-phone"
                      placeholder="01712345678"
                      value={businessSettings.phone || ""}
                      onChange={(e) =>
                        setBusinessSettings({
                          ...businessSettings,
                          phone: e.target.value,
                        })
                      }
                      className={
                        phoneInvalid
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Field label="Business Address" htmlFor="biz-address">
                    <Textarea
                      id="biz-address"
                      placeholder="Street, City, District"
                      value={businessSettings.address || ""}
                      onChange={(e) =>
                        setBusinessSettings({
                          ...businessSettings,
                          address: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </Field>

                  <Field
                    label="GST / BIN Number"
                    htmlFor="biz-gst"
                    hint="Optional · printed on invoices if provided"
                  >
                    <Input
                      id="biz-gst"
                      placeholder="e.g. 123456789 (optional)"
                      value={businessSettings.gstNumber || ""}
                      onChange={(e) =>
                        setBusinessSettings({
                          ...businessSettings,
                          gstNumber: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </Panel>
            </fieldset>
          </TabsContent>
        )}

        {/* Booking */}
        {tabAccess("booking") && (
          <TabsContent value="booking" className="mt-0 outline-none">
            <fieldset
              disabled={!hasPermission(user, "settings.booking", "edit")}
              className="contents"
            >
              <Panel
                title="Booking Settings"
                description="Operating hours and appointment scheduling"
                footer={
                  <Button
                    className="min-w-[140px]"
                    onClick={handleSaveBookingSettings}
                    disabled={savingBooking}
                   accessAction="edit">
                    {savingBooking && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                }
              >
                <div className="space-y-5">
                  <SectionLabel>Operating Hours</SectionLabel>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Opening Time" hint="Earliest bookable slot">
                      <ClockPickerField
                        value={bookingSettings.openingTime || ""}
                        maxTime={bookingSettings.closingTime || undefined}
                        onChange={(nextTime) =>
                          setBookingSettings({
                            ...bookingSettings,
                            openingTime: nextTime,
                          })
                        }
                      />
                    </Field>
                    <Field label="Closing Time" hint="Latest bookable cutoff">
                      <ClockPickerField
                        value={bookingSettings.closingTime || ""}
                        minTime={bookingSettings.openingTime || undefined}
                        onChange={(nextTime) =>
                          setBookingSettings({
                            ...bookingSettings,
                            closingTime: nextTime,
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-5 border-t border-brand-line pt-5">
                  <SectionLabel>Scheduling</SectionLabel>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      label="Default Slot Duration"
                      hint="Length of each appointment slot"
                    >
                      <Select
                        value={String(
                          bookingSettings.defaultSlotDuration ?? 30,
                        )}
                        disabled
                        onValueChange={(value) =>
                          setBookingSettings({
                            ...bookingSettings,
                            defaultSlotDuration: Number(value),
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">60 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field
                      label="Advance Booking Window"
                      htmlFor="adv-booking"
                      hint="How far ahead customers can book"
                    >
                      <div className="relative">
                        <Input placeholder="e.g. 14"
                          id="adv-booking"
                          type="number"
                          value={bookingSettings.advanceBookingWindow ?? 0}
                          disabled
                          onChange={(e) =>
                            setBookingSettings({
                              ...bookingSettings,
                              advanceBookingWindow: Number(e.target.value),
                            })
                          }
                          className="pr-14"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-muted">
                          days
                        </span>
                      </div>
                    </Field>
                  </div>
                </div>
              </Panel>
            </fieldset>
          </TabsContent>
        )}

        {/* Billing */}
        {tabAccess("billing") && (
          <TabsContent value="billing" className="mt-0 outline-none">
            <fieldset
              disabled={!hasPermission(user, "settings.invoice", "edit")}
              className="contents"
            >
              <Panel
                title="Billing Settings"
                description="Currency and tax defaults for POS, bookings, and invoices"
                footer={
                  <Button
                    className="min-w-[140px]"
                    onClick={handleSaveInvoiceSettings}
                    disabled={savingInvoice}
                   accessAction="edit">
                    {savingInvoice && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                }
              >
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
                  <div className="space-y-5">
                    <SectionLabel>Currency</SectionLabel>
                    <Field
                      label="Default Currency"
                      hint={`Invoice symbol: ${symbol} (${invoiceSettings.defaultCurrency || "BDT"})`}
                    >
                      <Select
                        value={invoiceSettings.defaultCurrency || "BDT"}
                        onValueChange={(value) =>
                          setInvoiceSettings({
                            ...invoiceSettings,
                            defaultCurrency: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BDT">
                            Bangladeshi Taka (BDT ৳)
                          </SelectItem>
                          <SelectItem value="USD">US Dollar (USD $)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR €)</SelectItem>
                          <SelectItem value="GBP">
                            British Pound (GBP £)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="space-y-5">
                    <SectionLabel>VAT</SectionLabel>
                    <Field
                      label="VAT Rate (%)"
                      htmlFor="tax-rate"
                      hint="Enter an integer or decimal (e.g. 5 or 7.5). Used as the default for POS, bookings, and invoices. Set 0 to disable."
                    >
                      <Input
                        id="tax-rate"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 10"
                        value={taxRateInput}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^\d.]/g, "");
                          const parts = cleaned.split(".");
                          const next =
                            parts.length > 2
                              ? `${parts[0]}.${parts.slice(1).join("")}`
                              : cleaned;
                          setTaxRateInput(next);
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </Panel>
            </fieldset>
          </TabsContent>
        )}
      </Tabs>
    </DashPage>
  );
}
