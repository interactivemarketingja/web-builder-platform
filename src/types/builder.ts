export type BlockType =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'showcase'
  | 'stats'
  | 'pricing'
  | 'testimonial'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'footer';

export type BackgroundVariant = 'canvas' | 'surface' | 'contrast';
export type PaddingSize = 'compact' | 'normal' | 'spacious';

export interface SiteTheme {
  primaryColor: string;
  accentTextColor: string;
  backgroundColor: string;
  surfaceColor: string;
  contrastBgColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  displayFont: string;
  bodyFont: string;
  radius: '0px' | '6px' | '12px';
  spacing: 'compact' | 'balanced' | 'airy';
  motion?: 'none' | 'subtle' | 'editorial';
}

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  meta?: string;
}

export interface StatItem {
  value: string;
  label: string;
  context: string;
}

export interface PricingTier {
  name: string;
  audience: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterColumn {
  heading: string;
  links: NavLinkItem[];
}

export interface BlockBase {
  id: string;
  type: BlockType;
  label: string;
  backgroundVariant: BackgroundVariant;
  paddingY: PaddingSize;
}

export interface NavbarBlock extends BlockBase {
  type: 'navbar';
  props: {
    brandName: string;
    links: NavLinkItem[];
    ctaLabel: string;
    ctaHref: string;
  };
}

export interface HeroBlock extends BlockBase {
  type: 'hero';
  props: {
    layout: 'split' | 'centered' | 'banner';
    kicker: string;
    headline: string;
    subtitle: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    imageUrl: string;
    imageAlt: string;
  };
}

export interface FeaturesBlock extends BlockBase {
  type: 'features';
  props: {
    eyebrow: string;
    heading: string;
    intro: string;
    columns: 2 | 3;
    items: FeatureItem[];
  };
}

export interface ShowcaseBlock extends BlockBase {
  type: 'showcase';
  props: {
    eyebrow: string;
    heading: string;
    body: string;
    bullets: string[];
    ctaLabel: string;
    ctaHref: string;
    imageUrl: string;
    imageAlt: string;
    imagePosition: 'left' | 'right';
  };
}

export interface StatsBlock extends BlockBase {
  type: 'stats';
  props: {
    heading: string;
    items: StatItem[];
  };
}

export interface PricingBlock extends BlockBase {
  type: 'pricing';
  props: {
    eyebrow: string;
    heading: string;
    intro: string;
    tiers: PricingTier[];
  };
}

export interface TestimonialBlock extends BlockBase {
  type: 'testimonial';
  props: {
    quote: string;
    authorName: string;
    authorRole: string;
    company: string;
    outcome: string;
  };
}

export interface FaqBlock extends BlockBase {
  type: 'faq';
  props: {
    eyebrow: string;
    heading: string;
    items: FaqItem[];
  };
}

export interface CtaBlock extends BlockBase {
  type: 'cta';
  props: {
    headline: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
}

export interface ContactBlock extends BlockBase {
  type: 'contact';
  props: {
    eyebrow: string;
    heading: string;
    description: string;
    email: string;
    location: string;
    submitLabel: string;
  };
}

export interface FooterBlock extends BlockBase {
  type: 'footer';
  props: {
    brandName: string;
    summary: string;
    columns: FooterColumn[];
    copyright: string;
  };
}

export type SiteBlock =
  | NavbarBlock
  | HeroBlock
  | FeaturesBlock
  | ShowcaseBlock
  | StatsBlock
  | PricingBlock
  | TestimonialBlock
  | FaqBlock
  | CtaBlock
  | ContactBlock
  | FooterBlock;

export interface SiteSeo {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  language?: string;
  customDomain?: string;
}

export interface SiteMarketingConfig {
  ga4MeasurementId?: string;
  metaPixelId?: string;
  googleAdsId?: string;
  linkedinPartnerId?: string;
  enableJsonLd?: boolean;
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementCtaLabel?: string;
  announcementCtaHref?: string;
  campaignTone?: string;
  savedKit?: MarketingAdKit | null;
}

export interface SiteProject {
  id: string;
  clientName?: string;
  name: string;
  slug: string;
  description: string;
  theme: SiteTheme;
  blocks: SiteBlock[];
  seo?: SiteSeo;
  marketing?: SiteMarketingConfig;
  createdAt?: string;
  updatedAt: string;
  lastDeployedSlug?: string;
  lastDeployedUrl?: string;
  lastDeployedAt?: string;
}

export interface ExportOptions {
  prefix: string;
  minify: boolean;
  includeReset: boolean;
  useCssVariables: boolean;
  formEndpoint?: string;
  trackEndpoint?: string;
}

export interface DeployedSiteRecord {
  slug: string;
  projectId?: string | null;
  clientName?: string;
  name: string;
  description: string;
  deployedAt: string;
  blockCount: number;
  url: string;
  customDomain?: string | null;
  domainVerified?: boolean;
  domainVerifiedAt?: string | null;
}

export interface DomainDnsInstructions {
  domain: string;
  cnameHost: string;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
}

export interface DomainVerificationResult {
  slug: string;
  customDomain: string;
  verified: boolean;
  domainVerifiedAt: string | null;
  instructions: DomainDnsInstructions;
  checks: {
    cnameMatched: boolean;
    txtMatched: boolean;
    aRecordMatched: boolean;
    resolvedCnames: string[];
    resolvedIps: string[];
    resolvedTxt: string[];
  };
}

export interface LeadSubmission {
  id: string;
  siteSlug: string;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}

export interface AnalyticsDailyPoint {
  date: string;
  views: number;
  clicks: number;
  leads: number;
}

export interface SitePerformanceMetric {
  slug: string;
  name: string;
  clientName: string;
  url: string;
  blockCount: number;
  deployedAt: string;
  views: number;
  clicks: number;
  leads: number;
  conversionRate: number;
}

export interface AnalyticsEventItem {
  id: string;
  siteSlug: string;
  eventType: 'page_view' | 'cta_click' | 'form_submit';
  deviceType: 'desktop' | 'tablet' | 'mobile';
  referrer: string;
  targetLabel: string;
  createdAt: string;
}

export interface AnalyticsPayload {
  summary: {
    totalViews: number;
    totalClicks: number;
    totalLeads: number;
    conversionRate: number;
    publishedSitesCount: number;
    savedProjectsCount: number;
  };
  series: AnalyticsDailyPoint[];
  devices: Array<{ device: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  topCtas: Array<{ label: string; count: number }>;
  sites: SitePerformanceMetric[];
  leads: LeadSubmission[];
  recentEvents: AnalyticsEventItem[];
}

export type MarketingPackageId =
  | 'seo_boost'
  | 'social_launch'
  | 'full_funnel'
  | 'ad_booster';

export type MarketingOrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'active'
  | 'paused'
  | 'completed';

export interface MarketingAdKit {
  summary: string;
  targetKeywords: string[];
  googleSearchAd: {
    headlines: string[];
    descriptions: string[];
  };
  metaSocialAd: {
    primaryText: string;
    headline: string;
    callToAction: string;
  };
  linkedinPost: {
    hook: string;
    body: string;
    cta: string;
  };
  emailBroadcast: {
    subject: string;
    previewText: string;
    body: string;
  };
  launchChecklist: string[];
}

export interface MarketingOrderRecord {
  id: string;
  siteSlug: string;
  siteName: string;
  clientName: string;
  customerEmail: string;
  packageId: MarketingPackageId;
  packageName: string;
  billingType: 'one_time' | 'monthly';
  adBudgetUsd: number;
  serviceFeeUsd: number;
  totalUsd: number;
  channels: string[];
  targetAudience: string;
  campaignGoal: string;
  utmCampaign: string;
  status: MarketingOrderStatus;
  paymentProvider: 'stripe' | 'invoice';
  stripeSessionId?: string | null;
  generatedKit?: MarketingAdKit | null;
  createdAt: string;
  updatedAt: string;
}

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';
export type StudioView =
  | 'builder'
  | 'preview'
  | 'code'
  | 'analytics'
  | 'marketing'
  | 'pricing';
export type PlanTierId = 'starter' | 'pro' | 'agency';
