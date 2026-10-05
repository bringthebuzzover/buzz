/**
 * /creators/apply — public creator application. The Instagram handle is a
 * claim here; Connect Instagram binds it after Buzz approves the profile.
 */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApplyAsCreator } from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorApplyInput } from "../../api/hooks/creator/types";
import { ChoiceChips } from "../../components/creator/ChoiceChips";
import FieldError from "../../components/forms/FieldError";
import { Button, ErrorBanner, TextArea, TextField } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const CREATOR_NICHES = [
  "College lifestyle",
  "Personal finance",
  "Tech",
  "Fashion",
  "Food",
  "Fitness",
] as const;

const CREATOR_OPEN_TO = ["Flat fee", "Long-term ambassador"] as const;

const EDU_EMAIL = /^[^@\s]+@[^@\s]+\.edu$/i;
const IG_HANDLE = /^[a-z0-9._]{1,30}$/i;

type Errors = Partial<Record<"name" | "school" | "eduEmail" | "claimedHandle" | "niches", string>>;

const EMPTY: CreatorApplyInput = {
  name: "",
  school: "",
  city: "",
  gradYear: "",
  eduEmail: "",
  claimedHandle: "",
  niches: [],
  bio: "",
  tiktokHandle: "",
  openTo: [],
};

function validate(form: CreatorApplyInput): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Enter your full name.";
  if (!form.school.trim()) errors.school = "Enter your school.";
  if (!EDU_EMAIL.test(form.eduEmail.trim())) {
    errors.eduEmail = "Use your campus email ending in .edu.";
  }
  if (!IG_HANDLE.test(form.claimedHandle.trim().replace(/^@/, ""))) {
    errors.claimedHandle = "Enter your Instagram handle, like @yourname.";
  }
  if (form.niches.length === 0) errors.niches = "Pick at least one niche.";
  return errors;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export default function CreatorApplyPage() {
  const navigate = useNavigate();
  const applyAsCreator = useApplyAsCreator();
  const [form, setForm] = useState<CreatorApplyInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof CreatorApplyInput>(key: K, value: CreatorApplyInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    applyAsCreator.mutate({
      ...form,
      name: form.name.trim(),
      school: form.school.trim(),
      eduEmail: form.eduEmail.trim(),
      claimedHandle: `@${form.claimedHandle.trim().replace(/^@/, "")}`,
    });
    navigate("/creators/verify");
  }

  const describedBy = (key: keyof Errors) => (errors[key] ? `${key}-error` : undefined);

  return (
    <PageShell width="form">
      <p className={cn(TEXT.micro, "mb-2 font-semibold text-buzz-coral")}>
        For student creators
      </p>
      <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>Apply as a creator</h1>
      <p className={cn(TEXT.body, "mb-6 text-buzz-inkMuted")}>
        Buzz reviews every creator before they can apply to a Drop. Approval
        usually takes about two business days.
      </p>
      <Card>
        <form noValidate onSubmit={onSubmit}>
          {Object.keys(errors).length > 0 ? (
            <div className="mb-4">
              <ErrorBanner>Fix the highlighted fields to continue.</ErrorBanner>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <TextField
                id="name"
                label="Full name"
                autoComplete="name"
                value={form.name}
                aria-invalid={!!errors.name}
                aria-describedby={describedBy("name")}
                onChange={(event) => set("name", event.target.value)}
              />
              <FieldError id="name-error" message={errors.name} />
            </div>
            <div>
              <TextField
                id="school"
                label="School"
                value={form.school}
                aria-invalid={!!errors.school}
                aria-describedby={describedBy("school")}
                onChange={(event) => set("school", event.target.value)}
              />
              <FieldError id="school-error" message={errors.school} />
            </div>
            <TextField
              id="city"
              label="City"
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
            />
            <TextField
              id="gradYear"
              label="Graduation year"
              inputMode="numeric"
              value={form.gradYear}
              onChange={(event) => set("gradYear", event.target.value)}
            />
          </div>
          <div className="mt-4">
            <TextField
              id="eduEmail"
              type="email"
              label="Campus .edu email"
              autoComplete="email"
              value={form.eduEmail}
              aria-invalid={!!errors.eduEmail}
              aria-describedby={describedBy("eduEmail")}
              onChange={(event) => set("eduEmail", event.target.value)}
            />
            <FieldError id="eduEmail-error" message={errors.eduEmail} />
          </div>
          <div className="mt-4">
            <TextArea
              id="bio"
              label="Bio"
              value={form.bio}
              onChange={(event) => set("bio", event.target.value)}
            />
          </div>

          <h2 className={cn(TEXT.h3, "mb-2 mt-6 text-buzz-ink")}>Instagram</h2>
          <p className={cn(SURFACE.inset, "mb-3 px-3 py-3 text-xs font-medium text-buzz-inkMuted")}>
            Use your own{" "}
            <span className="font-semibold text-buzz-ink">Creator or Business</span>{" "}
            Instagram. You connect it after Buzz approves you, and that connection
            is what shows brands your follower count.
          </p>
          <TextField
            id="claimedHandle"
            label="Instagram handle"
            autoCapitalize="none"
            placeholder="@yourname"
            value={form.claimedHandle}
            aria-invalid={!!errors.claimedHandle}
            aria-describedby={describedBy("claimedHandle")}
            onChange={(event) => set("claimedHandle", event.target.value)}
          />
          <FieldError id="claimedHandle-error" message={errors.claimedHandle} />
          <div className="mt-4">
            <TextField
              id="tiktokHandle"
              label="TikTok handle (optional)"
              autoCapitalize="none"
              value={form.tiktokHandle}
              onChange={(event) => set("tiktokHandle", event.target.value)}
            />
          </div>

          <h2 className={cn(TEXT.h3, "mb-2 mt-6 text-buzz-ink")}>Niches</h2>
          <ChoiceChips
            label="Niches"
            options={CREATOR_NICHES}
            selected={form.niches}
            onToggle={(value) => set("niches", toggle(form.niches, value))}
          />
          <FieldError id="niches-error" message={errors.niches} />

          <h2 className={cn(TEXT.h3, "mb-2 mt-6 text-buzz-ink")}>Open to</h2>
          <ChoiceChips
            label="Open to"
            options={CREATOR_OPEN_TO}
            selected={form.openTo}
            onToggle={(value) => set("openTo", toggle(form.openTo, value))}
          />

          <div className="mt-8">
            <Button type="submit" fullWidth disabled={applyAsCreator.isPending}>
              Submit application
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}
