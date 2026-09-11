/**
 * Primitive gallery: every shared control, surface, tone and type rank in one
 * scrollable page, including the states that are hard to reach in the product
 * (disabled, error, empty, loading).
 *
 * It exists so the revamp can be reviewed and regression-shot in a single
 * screenshot instead of hunting states across 40 routes. Dev-only: `AppRoot`
 * mounts it just for `ENVIRONMENT=development` builds, so it never ships.
 */
import { useState } from "react";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { StatePanel } from "../../components/ui/StatePanel";
import { Modal } from "../../components/ui/Modal";
import {
  Banner,
  Button,
  Checkbox,
  DateTimeField,
  ErrorBanner,
  LinkButton,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
  WarningBanner,
} from "../../components/forms/controls";
import { GAP, PAD, STACK, SURFACE, TEXT, TONE } from "../../theme/tokens";
import { cx } from "../../theme/shells";

const TONES = ["neutral", "success", "warn", "danger"] as const;
const SURFACES = ["card", "cardFlat", "cardWarm", "panel", "inset", "modal"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={STACK.default}>
      <h2 className={TEXT.h2}>{title}</h2>
      {children}
    </section>
  );
}

export default function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(true);

  return (
    <PageShell width="reading" className={STACK.section}>
      <header>
        <h1 className={TEXT.h1}>UI kit</h1>
        <p className={cx(TEXT.meta, "mt-1")}>
          Every shared primitive and state. Dev-only route.
        </p>
      </header>

      <Section title="Type scale">
        <Card className={STACK.tight}>
          <p className={TEXT.display}>Display — hero only</p>
          <p className={TEXT.h1}>Heading 1 — page title</p>
          <p className={TEXT.h2}>Heading 2 — section</p>
          <p className={TEXT.h3}>Heading 3 — card title</p>
          <p className={TEXT.bodyLong}>Body long — legal and marketing prose.</p>
          <p className={TEXT.body}>Body — dense product copy.</p>
          <p className={TEXT.meta}>Meta — supporting, always quieter.</p>
          <p className={TEXT.micro}>Micro — eyebrow and chip</p>
          <p className={TEXT.metric}>1,284</p>
        </Card>
      </Section>

      <Section title="Surfaces">
        <div className={cx("grid sm:grid-cols-3", GAP.default)}>
          {SURFACES.map((kind) => (
            <div key={kind} className={cx(SURFACE[kind], PAD.default)}>
              <p className={TEXT.body}>{kind}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <Card className={STACK.default}>
          <div className={cx("flex flex-wrap items-center", GAP.tight)}>
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className={cx("flex flex-wrap items-center", GAP.tight)}>
            <Button size="hero">Hero</Button>
            <Button>Default</Button>
            <Button size="compact">Compact</Button>
          </div>
          <div className={cx("flex flex-wrap items-center", GAP.tight)}>
            <Button disabled>Primary disabled</Button>
            <Button variant="outline" disabled>
              Outline disabled
            </Button>
            <Button variant="ghost" disabled>
              Ghost disabled
            </Button>
          </div>
          <div className={cx("flex flex-wrap items-center", GAP.tight)}>
            <LinkButton to="/dev/ui-kit">Link button</LinkButton>
            <LinkButton to="/dev/ui-kit" variant="outline">
              Link outline
            </LinkButton>
          </div>
          <Button fullWidth>Full width</Button>
        </Card>
      </Section>

      <Section title="Controls — default size">
        <Card className={STACK.default}>
          <TextField id="k-text" label="Text field" placeholder="Placeholder" />
          <TextField id="k-text-d" label="Disabled" placeholder="Disabled" disabled />
          <Select id="k-select" label="Select" defaultValue="a">
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
          <TextArea id="k-area" label="Text area" rows={3} placeholder="No resize grabber" />
          <TextField id="k-num" label="Number (no spinners)" type="number" defaultValue={12} />
          <Checkbox
            label="Checkbox — ours, not the OS widget"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <Checkbox label="Checkbox disabled" disabled />
        </Card>
      </Section>

      <Section title="Controls — compact size">
        <Card kind="panel" className={STACK.default}>
          <TextField id="k-text-c" label="Text field" size="compact" placeholder="Compact" />
          <Select id="k-select-c" label="Select" size="compact" defaultValue="a">
            <option value="a">Option A</option>
          </Select>
          <DateTimeField id="k-dt" label="Date and time" />
          <TextArea id="k-area-c" label="Text area" size="compact" rows={2} />
          {/* Height contract: a compact field and a compact button must line up. */}
          <div className={cx("flex items-end", GAP.tight)}>
            <TextField id="k-inline" label="Inline with button" size="compact" />
            <Button size="compact">Save</Button>
          </div>
        </Card>
      </Section>

      <Section title="Banners">
        <div className={STACK.tight}>
          <ErrorBanner>Error banner — centered, role=alert.</ErrorBanner>
          <SuccessBanner>Success banner.</SuccessBanner>
          <WarningBanner>Warning banner.</WarningBanner>
          <Banner tone="neutral">Neutral banner.</Banner>
        </div>
      </Section>

      <Section title="Chips and tones">
        <Card className={STACK.default}>
          <div className={cx("flex flex-wrap items-center", GAP.tight)}>
            {TONES.map((tone) => (
              <Chip key={tone} tone={tone}>
                {tone}
              </Chip>
            ))}
            <Chip accent>Brand accent</Chip>
            <Chip tone="neutral">A Very Long Brand Name That Must Not Wrap</Chip>
          </div>
          <div className={cx("grid sm:grid-cols-4", GAP.tight)}>
            {TONES.map((tone) => (
              <div key={tone} className={cx("rounded-buzzControl border", PAD.tight, TONE[tone])}>
                <p className={TEXT.body}>{tone}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="State panels">
        <div className={STACK.tight}>
          <StatePanel>Loading drops…</StatePanel>
          <StatePanel title="No drops yet">Check back when a brand posts one.</StatePanel>
          <StatePanel tone="danger" title="Could not load">
            Something went wrong. Try again.
          </StatePanel>
        </div>
      </Section>

      <Section title="Spacing rhythm">
        <Card className={STACK.default}>
          {(["tight", "default", "group", "section"] as const).map((step) => (
            <div key={step}>
              <p className={TEXT.micro}>{step}</p>
              <div className={cx("flex", GAP[step])}>
                <span className="h-8 w-8 rounded-buzzControl bg-buzz-butter" />
                <span className="h-8 w-8 rounded-buzzControl bg-buzz-butter" />
                <span className="h-8 w-8 rounded-buzzControl bg-buzz-butter" />
              </div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Card header">
        <Card>
          <CardHeader
            title="Card title"
            description="Supporting line, capped to a readable measure so it cannot run the full width of a wide screen."
            actions={<Button size="compact">Action</Button>}
          />
          <p className={TEXT.body}>Card body.</p>
        </Card>
      </Section>

      <Section title="Modal">
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        {modalOpen && (
          <Modal
            onClose={() => setModalOpen(false)}
            title="Modal title"
            description="Escape closes, focus is trapped, the page behind cannot scroll."
          >
            <div className={cx(PAD.card, STACK.default)}>
              <p className={TEXT.body}>Modal body content.</p>
              <Button onClick={() => setModalOpen(false)}>Done</Button>
            </div>
          </Modal>
        )}
      </Section>
    </PageShell>
  );
}
