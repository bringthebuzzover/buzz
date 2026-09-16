/**
 * Assembled Inspo marketing page: map hero → how it works → campaigns →
 * getting started → partner → FAQs. Chrome lives on InspoLayout.
 */
import { InspoMapHero } from "./InspoMapHeroPage";
import { InspoHowItWorks } from "./InspoHowItWorksPage";
import { InspoOpportunities } from "./InspoOpportunitiesPage";
import { InspoGettingStarted } from "./InspoGettingStartedPage";
import { InspoPartner } from "./InspoPartnerPage";
import { InspoFaqs } from "./InspoFaqsPage";

export default function InspoHomePage() {
  return (
    <>
      <InspoMapHero />
      <InspoHowItWorks />
      <InspoOpportunities />
      <InspoGettingStarted />
      <InspoPartner />
      <InspoFaqs />
    </>
  );
}
