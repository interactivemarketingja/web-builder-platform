import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  ImageOff,
  Link2,
  Megaphone,
  Pause,
  Play,
  Rocket,
  Search,
  Sparkles,
  Tag,
  Target,
  Trash2,
} from 'lucide-react';
import { slugify } from '../data/presets';
import {
  AnalyticsPayload,
  DeployedSiteRecord,
  MarketingAdKit,
  MarketingOrderRecord,
  MarketingOrderStatus,
  MarketingPackageId,
  SiteMarketingConfig,
  SiteProject,
} from '../types/builder';

interface MarketingViewProps {
  project: SiteProject;
  onUpdateMarketing: (patch: Partial<SiteMarketingConfig>) => void;
  onOpenDeploy: () => void;
  onNotify?: (message: string) => void;
  initialSessionId?: string | null;
  onClearSessionParam?: () => void;
}

type MarketingSubTab = 'launch' | 'kit' | 'tracking' | 'orders';
type OrderStatusFilter = 'all' | MarketingOrderStatus;

interface MarketingPackageDef {
  id: MarketingPackageId;
  name: string;
  tagline: string;
  priceUsd: number;
  billingType: 'one_time' | 'monthly';
  defaultBudgetUsd: number;
  deliverables: string[];
  recommended?: boolean;
}

const MARKETING_PACKAGES: MarketingPackageDef[] = [
  {
    id: 'seo_boost',
    name: 'Search & Local SEO Boost',
    tagline: 'Technical SEO setup, Schema.org markup & Google Search ad pack',
    priceUsd: 149,
    billingType: 'one_time',
    defaultBudgetUsd: 150,
    deliverables: [
      'Google Search Console & sitemap submission checklist',
      'Schema.org JSON-LD + OpenGraph meta optimization',
      '15 high-intent target keywords & responsive search ads',
      'UTM attribution link kit for organic & local directories',
    ],
  },
  {
    id: 'social_launch',
    name: 'Paid Social Launch',
    tagline: 'Instagram, Facebook & LinkedIn creative setup + pixel tracking',
    priceUsd: 299,
    billingType: 'monthly',
    defaultBudgetUsd: 300,
    recommended: true,
    deliverables: [
      'Meta Pixel & LinkedIn Insight tag embedded in site',
      'Multi-variant Instagram, Facebook & LinkedIn ad copy',
      'Audience segmentation & conversion goal setup',
      'Live UTM funnel tracking in Analytics dashboard',
    ],
  },
  {
    id: 'full_funnel',
    name: 'Full-Funnel Growth Retainer',
    tagline: 'Search + Paid Social + Email outreach & conversion optimization',
    priceUsd: 599,
    billingType: 'monthly',
    defaultBudgetUsd: 750,
    deliverables: [
      'Cross-channel Google Search, Meta & LinkedIn campaigns',
      'Promo announcement bar + high-converting email broadcast',
      'GA4 + Google Ads + Meta retargeting pixel instrumentation',
      'Dedicated monthly attribution & lead conversion reporting',
    ],
  },
  {
    id: 'ad_booster',
    name: 'Custom Ad Spend Booster',
    tagline: 'Allocate any custom ad budget ($50+) with $49 setup fee',
    priceUsd: 49,
    billingType: 'one_time',
    defaultBudgetUsd: 200,
    deliverables: [
      'Flexible ad spend pass-through starting at $50',
      'Custom UTM campaign URL for instant traffic tracking',
      'AI-generated ad headlines & primary copy kit',
      'Real-time visitor & lead attribution tracking',
    ],
  },
];

const CHANNEL_OPTIONS = [
  'Google Search',
  'Meta (Instagram & Facebook)',
  'LinkedIn Sponsored',
  'Email Launch Blast',
];

const GOAL_OPTIONS = [
  'Leads & Inquiries',
  'Book Discovery Calls',
  'Product Launch & Sales',
  'Local Traffic & Footfall',
];

const TONE_OPTIONS = [
  'Direct & Authoritative',
  'Executive B2B',
  'Warm & Founder-Led',
  'Urgent Launch Offer',
];

const BUDGET_PRESETS = [100, 300, 750, 1500];

function formatStatusLabel(status: MarketingOrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'Pending Payment';
    case 'paid':
      return 'Paid · Ready';
    case 'active':
      return 'Live Campaign';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
  }
}

function validateGa4(val?: string): 'empty' | 'valid' | 'invalid' {
  const clean = (val || '').trim();
  if (!clean) return 'empty';
  return /^G-[A-Z0-9]{4,18}$/i.test(clean) ? 'valid' : 'invalid';
}

function validateGoogleAds(val?: string): 'empty' | 'valid' | 'invalid' {
  const clean = (val || '').trim();
  if (!clean) return 'empty';
  return /^AW-[A-Z0-9]{4,18}$/i.test(clean) ? 'valid' : 'invalid';
}

function validateMetaPixel(val?: string): 'empty' | 'valid' | 'invalid' {
  const clean = (val || '').trim();
  if (!clean) return 'empty';
  return /^\d{8,22}$/.test(clean) ? 'valid' : 'invalid';
}

function validateLinkedIn(val?: string): 'empty' | 'valid' | 'invalid' {
  const clean = (val || '').trim();
  if (!clean) return 'empty';
  return /^\d{4,16}$/.test(clean) ? 'valid' : 'invalid';
}

function buildKitMarkdown(siteName: string, kit: MarketingAdKit): string {
  return [
    `# Marketing Campaign Kit — ${siteName}`,
    '',
    `## Strategy Summary`,
    kit.summary,
    '',
    `## Target Keywords`,
    kit.targetKeywords.map((k) => `- ${k}`).join('\n'),
    '',
    `## Google Search Responsive Ad`,
    `### Headlines`,
    kit.googleSearchAd.headlines.map((h) => `- ${h}`).join('\n'),
    `### Descriptions`,
    kit.googleSearchAd.descriptions.map((d) => `- ${d}`).join('\n'),
    '',
    `## Meta (Instagram & Facebook) Ad`,
    `**Headline:** ${kit.metaSocialAd.headline}`,
    `**CTA:** ${kit.metaSocialAd.callToAction}`,
    '',
    kit.metaSocialAd.primaryText,
    '',
    `## LinkedIn Sponsored Post`,
    `**Hook:** ${kit.linkedinPost.hook}`,
    '',
    kit.linkedinPost.body,
    '',
    `**CTA:** ${kit.linkedinPost.cta}`,
    '',
    `## Email Launch Broadcast`,
    `**Subject:** ${kit.emailBroadcast.subject}`,
    `**Preview:** ${kit.emailBroadcast.previewText}`,
    '',
    kit.emailBroadcast.body,
    '',
    `## 7-Day Launch Checklist`,
    kit.launchChecklist.map((step, i) => `${i + 1}. ${step}`).join('\n'),
  ].join('\n');
}

export const MarketingView: React.FC<MarketingViewProps> = ({
  project,
  onUpdateMarketing,
  onOpenDeploy,
  onNotify,
  initialSessionId,
  onClearSessionParam,
}) => {
  const [subTab, setSubTab] = useState<MarketingSubTab>('launch');
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [deployments, setDeployments] = useState<DeployedSiteRecord[]>([]);
  const [orders, setOrders] = useState<MarketingOrderRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  // Launch & Checkout Form
  const [targetSlug, setTargetSlug] = useState(() =>
    slugify(project.lastDeployedSlug || project.slug || project.name)
  );
  const [selectedPackageId, setSelectedPackageId] =
    useState<MarketingPackageId>('social_launch');
  const [adBudgetUsd, setAdBudgetUsd] = useState<number>(300);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    'Google Search',
    'Meta (Instagram & Facebook)',
  ]);
  const [campaignGoal, setCampaignGoal] = useState(GOAL_OPTIONS[0]);
  const [targetAudience, setTargetAudience] = useState('');
  const [offerHook, setOfferHook] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  // AI Ad Kit state (persisted in project.marketing.savedKit)
  const adKit = project.marketing?.savedKit || null;
  const campaignTone = project.marketing?.campaignTone || TONE_OPTIONS[0];
  const [isGeneratingKit, setIsGeneratingKit] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [previewHeadlineIdx, setPreviewHeadlineIdx] = useState(0);

  // UTM Builder state
  const [utmSource, setUtmSource] = useState('google');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState(() =>
    slugify(`${project.slug || project.name}-launch`)
  );
  const [utmContent, setUtmContent] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Orders Ledger filter & expandable drawer
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');
  const [expandedOrderKitId, setExpandedOrderKitId] = useState<string | null>(null);

  const selectedPkg =
    MARKETING_PACKAGES.find((p) => p.id === selectedPackageId) ||
    MARKETING_PACKAGES[1];

  const loadMarketingState = async () => {
    try {
      const [cfgRes, depRes, ordRes, anaRes] = await Promise.all([
        fetch('/api/marketing/config'),
        fetch('/api/deployments'),
        fetch('/api/marketing/orders'),
        fetch('/api/analytics?slug=all&days=30'),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setStripeConfigured(Boolean(cfg.stripeConfigured));
      }
      if (depRes.ok) {
        const depData = await depRes.json();
        const list: DeployedSiteRecord[] = Array.isArray(depData.deployments)
          ? depData.deployments
          : [];
        setDeployments(list);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData.orders) ? ordData.orders : []);
      }
      if (anaRes.ok) {
        const anaData = (await anaRes.json()) as AnalyticsPayload;
        setAnalytics(anaData);
      }
    } catch {
      // Silent fallback on transient fetch failure
    }
  };

  useEffect(() => {
    void loadMarketingState();
  }, []);

  // Verify Stripe Checkout return session if present
  useEffect(() => {
    if (!initialSessionId) return;
    let active = true;
    fetch('/api/marketing/verify-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: initialSessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.paid) {
          setOrderNotice(
            `Payment confirmed for "${data.order?.packageName}". Your campaign is ready to launch.`
          );
          setSubTab('orders');
          void loadMarketingState();
        } else if (data.error) {
          setOrderError(data.error);
        }
        onClearSessionParam?.();
      })
      .catch(() => {
        if (active) onClearSessionParam?.();
      });

    return () => {
      active = false;
    };
  }, [initialSessionId, onClearSessionParam]);

  const selectedSiteInfo = useMemo(() => {
    const dep = deployments.find((d) => d.slug === targetSlug);
    if (dep) {
      return {
        slug: dep.slug,
        name: dep.name,
        clientName: dep.clientName || project.clientName || 'Internal Studio',
        customDomain: dep.customDomain || null,
        deployedAt: dep.deployedAt,
        isPublished: true,
      };
    }
    return {
      slug: slugify(project.lastDeployedSlug || project.slug || project.name),
      name: project.name,
      clientName: project.clientName || 'Internal Studio',
      customDomain: project.seo?.customDomain || null,
      deployedAt: project.lastDeployedAt || null,
      isPublished: Boolean(project.lastDeployedSlug),
    };
  }, [deployments, targetSlug, project]);

  const heroPreviewImage = useMemo(() => {
    const hero = project.blocks.find((b) => b.type === 'hero');
    if (hero && hero.type === 'hero' && hero.props.imageUrl) {
      return { url: hero.props.imageUrl, alt: hero.props.imageAlt || project.name };
    }
    const showcase = project.blocks.find((b) => b.type === 'showcase');
    if (showcase && showcase.type === 'showcase' && showcase.props.imageUrl) {
      return {
        url: showcase.props.imageUrl,
        alt: showcase.props.imageAlt || project.name,
      };
    }
    return null;
  }, [project.blocks, project.name]);

  const copyText = async (value: string, key: string, toastMsg?: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (toastMsg) onNotify?.(toastMsg);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.length > 1
          ? prev.filter((c) => c !== channel)
          : prev
        : [...prev, channel]
    );
  };

  const handlePackageSelect = (pkg: MarketingPackageDef) => {
    setSelectedPackageId(pkg.id);
    setAdBudgetUsd(pkg.defaultBudgetUsd);
  };

  const totalDueUsd = selectedPkg.priceUsd + Math.max(0, adBudgetUsd);

  // Directional click & impression estimate based on selected channels and ad spend
  const estimatedPerformance = useMemo(() => {
    if (adBudgetUsd <= 0) {
      return { minClicks: 0, maxClicks: 0, minImpressions: 0, maxImpressions: 0 };
    }
    const hasLinkedIn = selectedChannels.includes('LinkedIn Sponsored');
    const hasSearch = selectedChannels.includes('Google Search');
    const lowCpc = hasLinkedIn ? 3.2 : hasSearch ? 1.8 : 0.95;
    const highCpc = hasLinkedIn ? 6.5 : hasSearch ? 3.9 : 2.1;
    const minClicks = Math.max(10, Math.round(adBudgetUsd / highCpc));
    const maxClicks = Math.max(minClicks + 15, Math.round(adBudgetUsd / lowCpc));
    const minImpressions = Math.round(minClicks * 38);
    const maxImpressions = Math.round(maxClicks * 54);
    return { minClicks, maxClicks, minImpressions, maxImpressions };
  }, [adBudgetUsd, selectedChannels]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderNotice(null);
    setPendingCheckoutUrl(null);
    setIsSubmittingOrder(true);

    try {
      const res = await fetch('/api/marketing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId,
          siteSlug: selectedSiteInfo.slug,
          siteName: selectedSiteInfo.name,
          clientName: selectedSiteInfo.clientName,
          customerEmail: customerEmail.trim(),
          adBudgetUsd,
          channels: selectedChannels,
          targetAudience: targetAudience.trim(),
          campaignGoal,
          utmCampaign,
          generatedKit: adKit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit marketing campaign order.');
      }

      if (data.order) {
        setOrders((prev) => [
          data.order,
          ...prev.filter((o) => o.id !== data.order.id),
        ]);
      }

      if (data.checkoutUrl) {
        setPendingCheckoutUrl(data.checkoutUrl);
        setOrderNotice(
          'Stripe Checkout session created. Click "Complete Card Payment" below to pay securely.'
        );
      } else {
        setOrderNotice(
          `Campaign order ${data.order?.id} saved for ${selectedSiteInfo.name} ($${totalDueUsd.toLocaleString()}). Manage it under Campaign Orders.`
        );
      }
      onNotify?.('Campaign order created.');
    } catch (err) {
      setOrderError(
        err instanceof Error ? err.message : 'Unable to create campaign order.'
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleGenerateAdKit = async () => {
    setIsGeneratingKit(true);
    setKitError(null);
    try {
      const highlights = project.blocks
        .slice(0, 6)
        .map((b) => {
          if (b.type === 'hero') return `${b.props.headline} — ${b.props.subtitle}`;
          if (b.type === 'features') return b.props.heading;
          if (b.type === 'showcase') return b.props.heading;
          if (b.type === 'cta') return b.props.headline;
          return b.label;
        })
        .filter(Boolean)
        .join(' | ');

      const res = await fetch('/api/marketing/generate-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: selectedSiteInfo.name,
          siteDescription: project.description,
          targetAudience,
          campaignGoal,
          tone: campaignTone,
          offer: offerHook,
          channels: selectedChannels,
          highlights,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate ad kit.');
      }
      onUpdateMarketing({ savedKit: data.kit });
      setPreviewHeadlineIdx(0);
      setCheckedSteps({});
      onNotify?.('AI Ad & Copy Kit generated and saved to project.');
    } catch (err) {
      setKitError(
        err instanceof Error ? err.message : 'Unable to generate ad kit.'
      );
    } finally {
      setIsGeneratingKit(false);
    }
  };

  const handleApplyOfferToPromoBar = () => {
    if (!adKit) return;
    const text =
      offerHook.trim() ||
      adKit.metaSocialAd.headline ||
      adKit.emailBroadcast.subject;
    const ctaLabel = adKit.metaSocialAd.callToAction || 'Get Started';
    onUpdateMarketing({
      announcementEnabled: true,
      announcementText: text.slice(0, 120),
      announcementCtaLabel: ctaLabel.slice(0, 30),
      announcementCtaHref: '#contact',
    });
    onNotify?.('Applied offer copy to your Site Promotional Banner.');
  };

  const handleDownloadKitMarkdown = () => {
    if (!adKit) return;
    const md = buildKitMarkdown(selectedSiteInfo.name, adKit);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSiteInfo.slug || 'site'}-marketing-kit.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify?.('Campaign kit downloaded as Markdown.');
  };

  const handleOrderStatusChange = async (
    orderId: string,
    status: MarketingOrderStatus
  ) => {
    try {
      const res = await fetch(
        `/api/marketing/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        onNotify?.(`Order updated to ${formatStatusLabel(status)}.`);
      }
    } catch {
      // Ignore network failure
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(
        `/api/marketing/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'DELETE',
        }
      );
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        onNotify?.('Campaign order removed.');
      }
    } catch {
      // Ignore network failure
    }
  };

  const baseSiteUrl = useMemo(() => {
    if (selectedSiteInfo.customDomain) {
      const dom = selectedSiteInfo.customDomain.replace(/^https?:\/\//i, '');
      return `https://${dom}`;
    }
    return `${window.location.origin}/sites/${selectedSiteInfo.slug}`;
  }, [selectedSiteInfo]);

  const displayDomain = useMemo(() => {
    if (selectedSiteInfo.customDomain) {
      return selectedSiteInfo.customDomain.replace(/^https?:\/\//i, '');
    }
    return `atelierframe.site/sites/${selectedSiteInfo.slug}`;
  }, [selectedSiteInfo]);

  const buildOrderTrackedUrl = (order: MarketingOrderRecord) => {
    const dep = deployments.find((d) => d.slug === order.siteSlug);
    const base = dep?.customDomain
      ? `https://${dep.customDomain.replace(/^https?:\/\//i, '')}`
      : `${window.location.origin}/sites/${order.siteSlug}`;
    const firstChannel = (order.channels[0] || 'campaign').toLowerCase();
    const src = firstChannel.includes('google')
      ? 'google'
      : firstChannel.includes('meta')
      ? 'meta'
      : firstChannel.includes('linkedin')
      ? 'linkedin'
      : 'campaign';
    const params = new URLSearchParams({
      utm_source: src,
      utm_medium: src === 'google' ? 'cpc' : 'paid_social',
      utm_campaign: order.utmCampaign || order.siteSlug,
    });
    return `${base}?${params.toString()}`;
  };

  const trackedCampaignUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (utmSource.trim()) params.set('utm_source', utmSource.trim());
    if (utmMedium.trim()) params.set('utm_medium', utmMedium.trim());
    if (utmCampaign.trim()) params.set('utm_campaign', utmCampaign.trim());
    if (utmContent.trim()) params.set('utm_content', utmContent.trim());
    const qs = params.toString();
    return qs ? `${baseSiteUrl}?${qs}` : baseSiteUrl;
  }, [baseSiteUrl, utmSource, utmMedium, utmCampaign, utmContent]);

  const mkt = project.marketing || {};
  const ga4Status = validateGa4(mkt.ga4MeasurementId);
  const adsStatus = validateGoogleAds(mkt.googleAdsId);
  const metaStatus = validateMetaPixel(mkt.metaPixelId);
  const liStatus = validateLinkedIn(mkt.linkedinPartnerId);

  const hasPixelsOrSchema =
    ga4Status === 'valid' ||
    adsStatus === 'valid' ||
    metaStatus === 'valid' ||
    liStatus === 'valid' ||
    Boolean(mkt.enableJsonLd);

  const totalRevenueUsd = orders
    .filter(
      (o) =>
        o.status === 'paid' || o.status === 'active' || o.status === 'completed'
    )
    .reduce((acc, o) => acc + o.totalUsd, 0);
  const activeCampaignsCount = orders.filter((o) => o.status === 'active').length;

  // Attribution lookup per order from /api/analytics
  const getOrderAttribution = (order: MarketingOrderRecord) => {
    if (!analytics) return { siteViews: 0, siteLeads: 0, utmVisits: 0 };
    const siteMetric = analytics.sites.find((s) => s.slug === order.siteSlug);
    const utmNeedle = `/${order.utmCampaign}`.toLowerCase();
    const utmVisits = analytics.recentEvents.filter(
      (ev) =>
        ev.siteSlug === order.siteSlug &&
        ev.eventType === 'page_view' &&
        ev.referrer.toLowerCase().includes(utmNeedle)
    ).length;
    return {
      siteViews: siteMetric?.views || 0,
      siteLeads: siteMetric?.leads || 0,
      utmVisits,
    };
  };

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.siteName.toLowerCase().includes(q) ||
        o.siteSlug.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.packageName.toLowerCase().includes(q) ||
        o.utmCampaign.toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, statusFilter]);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll bg-[#F4F2EC]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Editorial Studio Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#DAD4C6]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2.5 text-sm font-semibold text-black">
              <span className="w-5 h-0.5 bg-[#1D4ED8] shrink-0" />
              <span>Digital Marketing &amp; Paid Growth</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-black mt-1.5 font-display">
              Promote &amp; Monetize Client Websites
            </h1>
            <p className="text-sm text-black mt-1 leading-relaxed">
              Launch paid search and social campaigns, generate multi-channel AI ad copy, embed tracking pixels, and monitor attributed conversions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="px-4 py-2 rounded-lg bg-white border border-[#DAD4C6] text-sm text-black tabular-nums flex items-center gap-3">
              <span>
                Live Campaigns: <strong>{activeCampaignsCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Paid Volume: <strong>${totalRevenueUsd.toLocaleString()}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenDeploy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#13151A] hover:bg-black text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Rocket className="w-4 h-4" />
              <span>Publish Site Updates</span>
            </button>
          </div>
        </div>

        {/* 4-Step Launch Readiness Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={onOpenDeploy}
            className="text-left p-3.5 rounded-xl bg-white border border-[#DAD4C6] hover:border-[#13151A] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-black">01. Live Hosting</div>
              <div className="text-sm font-bold text-black truncate mt-0.5">
                {selectedSiteInfo.isPublished ? 'Published Live' : 'Draft Only'}
              </div>
            </div>
            {selectedSiteInfo.isPublished ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('tracking')}
            className="text-left p-3.5 rounded-xl bg-white border border-[#DAD4C6] hover:border-[#13151A] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-black">02. Pixels &amp; Schema</div>
              <div className="text-sm font-bold text-black truncate mt-0.5">
                {hasPixelsOrSchema ? 'Tags Configured' : 'Needs Setup'}
              </div>
            </div>
            {hasPixelsOrSchema ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('kit')}
            className="text-left p-3.5 rounded-xl bg-white border border-[#DAD4C6] hover:border-[#13151A] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-black">03. Creative Copy</div>
              <div className="text-sm font-bold text-black truncate mt-0.5">
                {adKit ? 'Ad Kit Ready' : 'Generate Copy'}
              </div>
            </div>
            {adKit ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab(orders.length > 0 ? 'orders' : 'launch')}
            className="text-left p-3.5 rounded-xl bg-white border border-[#DAD4C6] hover:border-[#13151A] transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-black">04. Paid Promotion</div>
              <div className="text-sm font-bold text-black truncate mt-0.5 tabular-nums">
                {activeCampaignsCount > 0
                  ? `${activeCampaignsCount} Active`
                  : orders.length > 0
                  ? `${orders.length} Saved Orders`
                  : 'Launch First Ad'}
              </div>
            </div>
            {activeCampaignsCount > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Megaphone className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            )}
          </button>
        </div>

        {/* Sub-navigation + Target Site Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EAE6DC] rounded-lg border border-[#DAD4C6]">
            {(
              [
                ['launch', 'Pay & Launch', CreditCard],
                ['kit', 'AI Ad & Copy Kit', Sparkles],
                ['tracking', 'Pixels, Promo & UTMs', Tag],
                ['orders', `Campaign Orders (${orders.length})`, Target],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  subTab === id
                    ? 'bg-white text-black shadow-xs border border-[#DAD4C6]/60'
                    : 'text-black hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4 text-[#1D4ED8]" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="mkt-site-select"
              className="text-sm font-semibold text-black whitespace-nowrap"
            >
              Target Site
            </label>
            <select
              id="mkt-site-select"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              className="rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              {deployments.length === 0 ? (
                <option value={slugify(project.slug || project.name)}>
                  {project.name} (Active Canvas)
                </option>
              ) : (
                <>
                  {!deployments.some(
                    (d) => d.slug === slugify(project.slug || project.name)
                  ) && (
                    <option value={slugify(project.slug || project.name)}>
                      {project.name} (Active Canvas)
                    </option>
                  )}
                  {deployments.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name} (/sites/{d.slug})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Status Banners */}
        {orderNotice && (
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-sm text-black flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{orderNotice}</span>
            </div>
            {pendingCheckoutUrl && (
              <a
                href={pendingCheckoutUrl}
                target="_top"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#163B9E] text-white text-sm font-semibold whitespace-nowrap"
              >
                <span>Complete Card Payment</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
        {orderError && (
          <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{orderError}</span>
          </div>
        )}

        {/* TAB 1: PAY & LAUNCH CAMPAIGN */}
        {subTab === 'launch' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Package Cards + Estimator */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MARKETING_PACKAGES.map((pkg) => {
                  const active = selectedPackageId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handlePackageSelect(pkg)}
                      className={`text-left p-5 rounded-xl border transition-all flex flex-col cursor-pointer bg-white ${
                        active
                          ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/20 shadow-sm'
                          : 'border-[#DAD4C6] hover:border-[#13151A]'
                      } ${pkg.recommended ? 'border-t-[3px] border-t-[#1D4ED8]' : ''}`}
                    >
                      {pkg.recommended && (
                        <div className="text-xs font-bold text-[#1D4ED8] mb-1">
                          Recommended
                        </div>
                      )}
                      <div className="text-base font-bold text-black">
                        {pkg.name}
                      </div>
                      <p className="text-xs text-black mt-1 leading-relaxed">
                        {pkg.tagline}
                      </p>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-black tabular-nums font-display">
                          ${pkg.priceUsd}
                        </span>
                        <span className="text-xs font-medium text-black">
                          {pkg.billingType === 'monthly'
                            ? '/ month management'
                            : 'one-time setup'}
                        </span>
                      </div>
                      <ul className="mt-3 pt-3 border-t border-[#DAD4C6]/70 space-y-1.5 text-xs text-black flex-1">
                        {pkg.deliverables.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {/* Directional Reach & Budget Estimator */}
              <div className="p-5 rounded-xl border border-[#DAD4C6] bg-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-black">
                      Ad Spend Allocation &amp; Directional Reach
                    </h3>
                    <p className="text-xs text-black">
                      Adjust monthly ad spend pass-through to preview expected campaign volume across {selectedChannels.length} selected channel{selectedChannels.length > 1 ? 's' : ''}.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-[#EAE6DC] rounded-lg">
                    {BUDGET_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdBudgetUsd(preset)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold tabular-nums cursor-pointer transition-colors ${
                          adBudgetUsd === preset
                            ? 'bg-white text-black shadow-xs'
                            : 'text-black hover:bg-white/60'
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#DAD4C6]">
                  <div>
                    <div className="text-xs text-black">Ad Spend Budget</div>
                    <div className="text-lg font-bold font-mono text-black tabular-nums mt-0.5">
                      ${adBudgetUsd.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-black">Est. Targeted Clicks</div>
                    <div className="text-lg font-bold font-mono text-black tabular-nums mt-0.5">
                      {adBudgetUsd > 0
                        ? `${estimatedPerformance.minClicks.toLocaleString()}–${estimatedPerformance.maxClicks.toLocaleString()}`
                        : '0'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-black">Est. Ad Impressions</div>
                    <div className="text-lg font-bold font-mono text-black tabular-nums mt-0.5">
                      {adBudgetUsd > 0
                        ? `${estimatedPerformance.minImpressions.toLocaleString()}–${estimatedPerformance.maxImpressions.toLocaleString()}`
                        : '0'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Gateway Notice */}
              <div className="p-4 rounded-xl border border-[#DAD4C6] bg-[#FAF9F5] text-sm text-black leading-relaxed">
                <div className="font-semibold text-black flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#1D4ED8]" />
                  <span>
                    {stripeConfigured
                      ? 'Live Stripe Card Checkout Enabled'
                      : 'Invoice & Order Queue Mode (Add STRIPE_SECRET_KEY for Instant Card Checkout)'}
                  </span>
                </div>
                <p className="text-xs text-black mt-1">
                  {stripeConfigured
                    ? 'Submitting this order creates a real Stripe Checkout session for the package fee plus allocated ad spend, and marks the campaign ready automatically upon payment.'
                    : 'Orders submitted here are persisted with exact service fees and ad budgets so you can invoice clients or mark them paid. Add STRIPE_SECRET_KEY in environment settings to accept instant card payments.'}
                </p>
              </div>
            </div>

            {/* Order Configuration & Checkout Summary */}
            <form
              onSubmit={handleCheckoutSubmit}
              className="lg:col-span-5 bg-white border border-[#DAD4C6] rounded-xl p-6 space-y-4 lg:sticky lg:top-6"
            >
              <div className="pb-3 border-b border-[#DAD4C6]">
                <h2 className="text-lg font-bold text-black font-display">
                  Campaign Checkout Summary
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-black mt-1">
                  <span className="font-semibold">{selectedSiteInfo.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">/sites/{selectedSiteInfo.slug}</span>
                  {selectedSiteInfo.customDomain && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{selectedSiteInfo.customDomain}</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Customer / Client Billing Email
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="founder@clientcompany.com"
                  className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1.5">
                  Marketing Channels
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const checked = selectedChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannel(ch)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          checked
                            ? 'border-[#1D4ED8] bg-blue-50/70 text-black'
                            : 'border-[#DAD4C6] bg-[#FAF9F5] text-black hover:bg-white'
                        }`}
                      >
                        {checked ? '✓ ' : '+ '}
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Conversion Goal
                  </label>
                  <select
                    value={campaignGoal}
                    onChange={(e) => setCampaignGoal(e.target.value)}
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm text-black"
                  >
                    {GOAL_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Custom Ad Budget (USD)
                  </label>
                  <input
                    type="number"
                    min={selectedPackageId === 'ad_booster' ? 50 : 0}
                    max={25000}
                    step={25}
                    value={adBudgetUsd}
                    onChange={(e) =>
                      setAdBudgetUsd(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Target Audience &amp; Geography
                </label>
                <textarea
                  rows={2}
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Commercial architects & boutique hotels in New York, 25mi radius"
                  className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60 resize-none"
                />
              </div>

              {/* Price Breakdown */}
              <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#DAD4C6] space-y-2 text-sm text-black">
                <div className="flex justify-between">
                  <span>{selectedPkg.name}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ${selectedPkg.priceUsd}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Allocated Ad Spend Pass-Through</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ${adBudgetUsd}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span>UTM Attribution Tag</span>
                  <span className="font-mono">{utmCampaign}</span>
                </div>
                <div className="pt-2 border-t border-[#DAD4C6] flex justify-between text-base font-bold">
                  <span>Total Due</span>
                  <span className="font-mono tabular-nums">
                    ${totalDueUsd.toLocaleString()} USD
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingOrder}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1D4ED8] hover:bg-[#163B9E] disabled:bg-blue-400 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isSubmittingOrder
                    ? 'Processing...'
                    : stripeConfigured
                    ? `Pay $${totalDueUsd.toLocaleString()} via Stripe`
                    : `Create Paid Campaign Order ($${totalDueUsd.toLocaleString()})`}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: AI AD & COPY KIT */}
        {subTab === 'kit' && (
          <div className="space-y-5">
            {/* Controls Bar */}
            <div className="bg-white border border-[#DAD4C6] rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-black font-display">
                    AI Multi-Channel Campaign Kit
                  </h2>
                  <p className="text-sm text-black mt-1">
                    Generates tailored Google Search Ads, Meta social ads, LinkedIn outreach, email broadcasts, and keywords from{' '}
                    <strong>{selectedSiteInfo.name}</strong> and saves directly to your project.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {adKit && (
                    <>
                      <button
                        type="button"
                        onClick={handleApplyOfferToPromoBar}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] hover:bg-white text-black text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        <span>Apply to Promo Bar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadKitMarkdown}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DAD4C6] bg-white hover:bg-[#FAF9F5] text-black text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export .md</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={isGeneratingKit}
                    onClick={handleGenerateAdKit}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#163B9E] disabled:bg-blue-400 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isGeneratingKit
                        ? 'Generating Campaign Kit...'
                        : adKit
                        ? 'Regenerate Kit'
                        : 'Generate Ad & Copy Kit'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-[#DAD4C6]">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    Campaign Angle &amp; Tone
                  </label>
                  <select
                    value={campaignTone}
                    onChange={(e) =>
                      onUpdateMarketing({ campaignTone: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black"
                  >
                    {TONE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    Key Offer / Lead Magnet
                  </label>
                  <input
                    type="text"
                    value={offerHook}
                    onChange={(e) => setOfferHook(e.target.value)}
                    placeholder="e.g. Free 30-min consultation or 15% launch offer"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Architects, founders, local homeowners"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60"
                  />
                </div>
              </div>
            </div>

            {kitError && (
              <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800 font-medium">
                {kitError}
              </div>
            )}

            {!adKit ? (
              <div className="bg-white border border-[#DAD4C6] rounded-xl p-10 text-center space-y-3">
                <p className="text-base font-semibold text-black">
                  No campaign kit generated for this project yet
                </p>
                <p className="text-sm text-black max-w-lg mx-auto leading-relaxed">
                  Choose a tone and optional launch offer above, then click &ldquo;Generate Ad &amp; Copy Kit&rdquo; to create live Google Search previews, Meta social creative, email broadcasts, and high-intent keywords.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Google Search Ad Preview + Headlines */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-black">
                      Google Search Responsive Ad
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `Headlines:\n${adKit.googleSearchAd.headlines.join('\n')}\n\nDescriptions:\n${adKit.googleSearchAd.descriptions.join('\n')}`,
                          'google-ad',
                          'Google Search ad copy copied.'
                        )
                      }
                      className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'google-ad' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'google-ad' ? 'Copied' : 'Copy Ad'}</span>
                    </button>
                  </div>

                  {/* SERP Ad Preview */}
                  <div className="p-4 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-black">
                      <span className="font-semibold">
                        Sponsored · {displayDomain}
                      </span>
                      <div className="flex items-center gap-1">
                        {adKit.googleSearchAd.headlines.slice(0, 3).map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreviewHeadlineIdx(idx)}
                            className={`px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer ${
                              previewHeadlineIdx === idx
                                ? 'bg-[#1D4ED8] text-white'
                                : 'bg-white border border-[#DAD4C6] text-black'
                            }`}
                          >
                            V{idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-base font-semibold text-[#1D4ED8] leading-snug">
                      {adKit.googleSearchAd.headlines[previewHeadlineIdx] ||
                        adKit.googleSearchAd.headlines[0]}{' '}
                      | {selectedSiteInfo.name}
                    </div>
                    <p className="text-sm text-black leading-relaxed">
                      {adKit.googleSearchAd.descriptions[0]}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-black">
                      Headline Variations
                    </div>
                    {adKit.googleSearchAd.headlines.map((h, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded bg-[#FAF9F5] border border-[#DAD4C6] flex items-center justify-between gap-2"
                      >
                        <span className="text-sm font-semibold text-black">{h}</span>
                        <span className="text-xs font-mono text-black tabular-nums shrink-0">
                          {h.length}/30
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-black">
                      Descriptions
                    </div>
                    {adKit.googleSearchAd.descriptions.map((d, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded bg-[#FAF9F5] border border-[#DAD4C6] flex items-start justify-between gap-2"
                      >
                        <span className="text-sm text-black">{d}</span>
                        <span className="text-xs font-mono text-black tabular-nums shrink-0 mt-0.5">
                          {d.length}/90
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meta Social Ad Live Card Preview */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-black">
                      Meta (Instagram &amp; Facebook) Feed Ad
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `${adKit.metaSocialAd.primaryText}\n\nHeadline: ${adKit.metaSocialAd.headline}\nCTA: ${adKit.metaSocialAd.callToAction}`,
                          'meta-ad',
                          'Meta social ad copy copied.'
                        )
                      }
                      className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'meta-ad' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'meta-ad' ? 'Copied' : 'Copy Ad'}</span>
                    </button>
                  </div>

                  {/* Visual Feed Card */}
                  <div className="border border-[#DAD4C6] rounded-lg overflow-hidden bg-white">
                    <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-[#DAD4C6]">
                      <div>
                        <div className="text-sm font-bold text-black">
                          {selectedSiteInfo.name}
                        </div>
                        <div className="text-xs text-black">Sponsored</div>
                      </div>
                    </div>
                    <p className="px-3.5 py-3 text-sm text-black leading-relaxed whitespace-pre-line">
                      {adKit.metaSocialAd.primaryText}
                    </p>
                    {heroPreviewImage ? (
                      <img
                        src={heroPreviewImage.url}
                        alt={heroPreviewImage.alt}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-[16/9] object-cover border-y border-[#DAD4C6]"
                      />
                    ) : (
                      <div className="w-full aspect-[16/9] bg-[#FAF9F5] border-y border-[#DAD4C6] flex flex-col items-center justify-center gap-1.5 text-black">
                        <ImageOff className="w-5 h-5" />
                        <span className="text-xs font-medium">
                          Add a Hero or Showcase image to preview creative
                        </span>
                      </div>
                    )}
                    <div className="p-3.5 bg-[#FAF9F5] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-black truncate">
                          {displayDomain}
                        </div>
                        <div className="text-sm font-bold text-black truncate">
                          {adKit.metaSocialAd.headline}
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-md bg-[#13151A] text-white text-xs font-semibold whitespace-nowrap shrink-0">
                        {adKit.metaSocialAd.callToAction}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Positioning & Keywords */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-black">
                      Positioning &amp; Target Keywords
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          adKit.targetKeywords.join(', '),
                          'keywords',
                          'Target keywords copied.'
                        )
                      }
                      className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'keywords' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedKey === 'keywords' ? 'Copied' : 'Copy Keywords'}
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-black leading-relaxed">
                    {adKit.summary}
                  </p>
                  <div className="pt-2 border-t border-[#DAD4C6] text-xs font-medium text-black leading-relaxed">
                    {adKit.targetKeywords.map((kw, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                        )}
                        <span className="font-mono">{kw}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Email Broadcast */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-black">
                      Email Launch Broadcast
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `Subject: ${adKit.emailBroadcast.subject}\nPreview: ${adKit.emailBroadcast.previewText}\n\n${adKit.emailBroadcast.body}`,
                          'email-ad',
                          'Email broadcast copy copied.'
                        )
                      }
                      className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'email-ad' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedKey === 'email-ad' ? 'Copied' : 'Copy Email'}
                      </span>
                    </button>
                  </div>
                  <div className="text-sm text-black space-y-1.5">
                    <div>
                      <strong>Subject:</strong> {adKit.emailBroadcast.subject}
                    </div>
                    <div>
                      <strong>Preview:</strong> {adKit.emailBroadcast.previewText}
                    </div>
                    <p className="pt-2 border-t border-[#DAD4C6]/70 whitespace-pre-line leading-relaxed">
                      {adKit.emailBroadcast.body}
                    </p>
                  </div>
                </div>

                {/* LinkedIn Post */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-black">
                      LinkedIn Sponsored Post
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `${adKit.linkedinPost.hook}\n\n${adKit.linkedinPost.body}\n\n${adKit.linkedinPost.cta}`,
                          'linkedin-ad',
                          'LinkedIn post copy copied.'
                        )
                      }
                      className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'linkedin-ad' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedKey === 'linkedin-ad' ? 'Copied' : 'Copy Post'}
                      </span>
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-black">
                    {adKit.linkedinPost.hook}
                  </div>
                  <p className="text-sm text-black leading-relaxed whitespace-pre-line">
                    {adKit.linkedinPost.body}
                  </p>
                  <div className="text-sm font-semibold text-[#1D4ED8]">
                    {adKit.linkedinPost.cta}
                  </div>
                </div>

                {/* Interactive 7-Day Launch Checklist */}
                <div className="bg-white border border-[#DAD4C6] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-black">
                      7-Day Launch Action Plan
                    </h3>
                    <span className="text-xs font-mono text-black tabular-nums">
                      {
                        adKit.launchChecklist.filter((_, idx) => checkedSteps[idx])
                          .length
                      }
                      /{adKit.launchChecklist.length} complete
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-black">
                    {adKit.launchChecklist.map((step, i) => {
                      const done = Boolean(checkedSteps[i]);
                      return (
                        <li key={i}>
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() =>
                                setCheckedSteps((prev) => ({
                                  ...prev,
                                  [i]: !prev[i],
                                }))
                              }
                              className="mt-1"
                            />
                            <span className={done ? 'line-through opacity-60' : ''}>
                              <strong className="font-mono mr-1.5">
                                {String(i + 1).padStart(2, '0')}.
                              </strong>
                              {step}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PIXELS, PROMO BAR & UTM BUILDER */}
        {subTab === 'tracking' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Tracking Pixels, Schema & Promo Bar */}
            <div className="bg-white border border-[#DAD4C6] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-black font-display">
                  Ad Pixels &amp; Analytics Tags
                </h2>
                <p className="text-xs text-black mt-1">
                  Embedded automatically into your exported HTML and live deployed site. Republish after updating IDs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-black">
                      Google Analytics 4 ID
                    </label>
                    {ga4Status === 'valid' && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Valid
                      </span>
                    )}
                    {ga4Status === 'invalid' && (
                      <span className="text-xs font-semibold text-[#B45309]">
                        Use G-XXXXXXXX
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={mkt.ga4MeasurementId || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ ga4MeasurementId: e.target.value })
                    }
                    placeholder="G-XXXXXXXXXX"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black placeholder:text-black/60"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-black">
                      Google Ads Tag ID
                    </label>
                    {adsStatus === 'valid' && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Valid
                      </span>
                    )}
                    {adsStatus === 'invalid' && (
                      <span className="text-xs font-semibold text-[#B45309]">
                        Use AW-123456
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={mkt.googleAdsId || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ googleAdsId: e.target.value })
                    }
                    placeholder="AW-123456789"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black placeholder:text-black/60"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-black">
                      Meta (Facebook) Pixel ID
                    </label>
                    {metaStatus === 'valid' && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Valid
                      </span>
                    )}
                    {metaStatus === 'invalid' && (
                      <span className="text-xs font-semibold text-[#B45309]">
                        8–22 digits
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={mkt.metaPixelId || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ metaPixelId: e.target.value })
                    }
                    placeholder="123456789012345"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black placeholder:text-black/60"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-black">
                      LinkedIn Partner ID
                    </label>
                    {liStatus === 'valid' && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Valid
                      </span>
                    )}
                    {liStatus === 'invalid' && (
                      <span className="text-xs font-semibold text-[#B45309]">
                        4–16 digits
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={mkt.linkedinPartnerId || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ linkedinPartnerId: e.target.value })
                    }
                    placeholder="5678901"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black placeholder:text-black/60"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FAF9F5] border border-[#DAD4C6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(mkt.enableJsonLd)}
                  onChange={(e) =>
                    onUpdateMarketing({ enableJsonLd: e.target.checked })
                  }
                  className="mt-0.5"
                />
                <div className="text-xs text-black leading-relaxed">
                  <span className="font-semibold block">
                    Emit Schema.org JSON-LD Structured Data
                  </span>
                  Helps Google &amp; AI search engines index your site name, description, and canonical URL.
                </div>
              </label>

              {/* Site-wide Promo Announcement Bar */}
              <div className="pt-4 border-t border-[#DAD4C6] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-black">
                    Site Promotional Banner
                  </span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(mkt.announcementEnabled)}
                      onChange={(e) =>
                        onUpdateMarketing({
                          announcementEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>Enable Top Promo Bar</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={mkt.announcementText || ''}
                  onChange={(e) =>
                    onUpdateMarketing({ announcementText: e.target.value })
                  }
                  placeholder="Spring Launch Offer: Book an audit this month and save 20%."
                  className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={mkt.announcementCtaLabel || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ announcementCtaLabel: e.target.value })
                    }
                    placeholder="Claim Offer"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm text-black placeholder:text-black/60"
                  />
                  <input
                    type="text"
                    value={mkt.announcementCtaHref || ''}
                    onChange={(e) =>
                      onUpdateMarketing({ announcementCtaHref: e.target.value })
                    }
                    placeholder="#contact"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-3 py-2 text-sm font-mono text-black placeholder:text-black/60"
                  />
                </div>

                {/* Live Theme-Matched Preview */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-medium text-black">
                    Live Banner Preview (styled with active site palette)
                  </div>
                  <div
                    className="rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-center gap-3 text-center border border-black/15"
                    style={{
                      backgroundColor: project.theme.contrastBgColor,
                      color: '#FFFFFF',
                      fontFamily: `"${project.theme.bodyFont}", system-ui, sans-serif`,
                    }}
                  >
                    <span className="text-xs sm:text-sm font-medium">
                      {mkt.announcementText?.trim() ||
                        'Spring Launch Offer: Book an audit this month and save 20%.'}
                    </span>
                    <span
                      className="px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                      style={{
                        backgroundColor: project.theme.primaryColor,
                        color: project.theme.accentTextColor,
                        borderRadius: project.theme.radius,
                      }}
                    >
                      {mkt.announcementCtaLabel?.trim() || 'Claim Offer'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* UTM Campaign Link Builder */}
            <div className="bg-white border border-[#DAD4C6] rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-black font-display flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Trackable UTM Campaign Link Builder</span>
                </h2>
                <p className="text-xs text-black mt-1">
                  Share these links in Google Ads, Instagram, LinkedIn, or newsletters. Visits automatically attribute in Analytics and Campaign Orders.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    utm_source
                  </label>
                  <input
                    type="text"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    placeholder="google"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm font-mono text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    utm_medium
                  </label>
                  <input
                    type="text"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    placeholder="cpc"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm font-mono text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    utm_campaign
                  </label>
                  <input
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="spring-launch"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm font-mono text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    utm_content (optional variant)
                  </label>
                  <input
                    type="text"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                    placeholder="hero-banner-v1"
                    className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm font-mono text-black placeholder:text-black/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  ['Google Search', 'google', 'cpc'],
                  ['Instagram Ad', 'instagram', 'paid_social'],
                  ['LinkedIn Post', 'linkedin', 'sponsored'],
                  ['Newsletter', 'newsletter', 'email'],
                ].map(([label, src, med]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setUtmSource(src);
                      setUtmMedium(med);
                    }}
                    className="px-2.5 py-1 rounded-md border border-[#DAD4C6] bg-[#FAF9F5] hover:border-[#1D4ED8] text-xs font-medium text-black cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-[#13151A] text-white space-y-3">
                <div className="text-xs font-semibold text-white/75">
                  Tracked Destination URL
                </div>
                <div className="text-xs font-mono break-all leading-relaxed">
                  {trackedCampaignUrl}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        trackedCampaignUrl,
                        'utm-url',
                        'Campaign UTM link copied.'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1D4ED8] hover:bg-[#163B9E] text-white text-xs font-semibold cursor-pointer"
                  >
                    {copiedKey === 'utm-url' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedKey === 'utm-url' ? 'Copied URL' : 'Copy Campaign URL'}
                    </span>
                  </button>
                  {selectedSiteInfo.isPublished && (
                    <a
                      href={trackedCampaignUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/25 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                    >
                      <span>Test Tracked Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CAMPAIGN ORDERS LEDGER */}
        {subTab === 'orders' && (
          <div className="bg-white border border-[#DAD4C6] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#DAD4C6] bg-[#F8F6F1] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-black">
                  Paid Website Marketing Orders
                </h2>
                <p className="text-xs text-black">
                  Manage billing status, UTM attribution performance, attached AI ad kits, and active campaign states.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Filter orders..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#DAD4C6] bg-white text-xs text-black placeholder:text-black/60 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('launch')}
                  className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#163B9E] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  + New Campaign Order
                </button>
              </div>
            </div>

            {/* Status Filter Bar */}
            <div className="px-6 py-2.5 border-b border-[#DAD4C6] bg-white flex flex-wrap items-center gap-1">
              {(
                [
                  ['all', 'All'],
                  ['pending_payment', 'Pending'],
                  ['paid', 'Paid'],
                  ['active', 'Live'],
                  ['paused', 'Paused'],
                  ['completed', 'Completed'],
                ] as Array<[OrderStatusFilter, string]>
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    statusFilter === st
                      ? 'bg-[#13151A] text-white'
                      : 'text-black hover:bg-[#EAE6DC]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-black">
                  {orders.length === 0
                    ? 'No marketing orders yet'
                    : 'No campaign orders match the current filter'}
                </p>
                <p className="text-xs text-black">
                  {orders.length === 0
                    ? 'Select a package in "Pay & Launch" to create your first paid website promotion order.'
                    : 'Clear search or switch status filter to see all orders.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#DAD4C6]">
                {filteredOrders.map((order) => {
                  const attr = getOrderAttribution(order);
                  const orderUtmUrl = buildOrderTrackedUrl(order);
                  const kitExpanded = expandedOrderKitId === order.id;

                  return (
                    <div key={order.id} className="p-5 hover:bg-[#FAF9F5]/60 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-black">
                            <span className="text-base font-bold text-black">
                              {order.siteName}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-xs">
                              /sites/{order.siteSlug}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`text-xs font-semibold ${
                                order.status === 'active'
                                  ? 'text-emerald-700'
                                  : order.status === 'paid'
                                  ? 'text-[#1D4ED8]'
                                  : order.status === 'pending_payment'
                                  ? 'text-[#B45309]'
                                  : 'text-black'
                              }`}
                            >
                              {formatStatusLabel(order.status)}
                            </span>
                          </div>

                          <div className="text-sm text-black">
                            <strong>{order.packageName}</strong>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono text-xs">
                              {order.customerEmail}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{order.campaignGoal}</span>
                          </div>

                          <div className="text-xs text-black flex flex-wrap items-center gap-2 tabular-nums">
                            <span>
                              Channels: <strong>{order.channels.join(', ')}</strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              UTM: {order.utmCampaign}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Attributed Visits: <strong>{attr.utmVisits}</strong> (Site Views:{' '}
                              {attr.siteViews}, Leads: {attr.siteLeads})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-lg font-bold font-mono text-black tabular-nums">
                              ${order.totalUsd.toLocaleString()}
                            </div>
                            <div className="text-xs text-black font-mono tabular-nums">
                              Fee ${order.serviceFeeUsd} + Ad Spend $
                              {order.adBudgetUsd}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                copyText(
                                  orderUtmUrl,
                                  `order-utm-${order.id}`,
                                  'Order UTM tracking link copied.'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DAD4C6] bg-white hover:bg-[#FAF9F5] text-black text-xs font-semibold cursor-pointer"
                            >
                              {copiedKey === `order-utm-${order.id}` ? (
                                <Check className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <Link2 className="w-3 h-3 text-[#1D4ED8]" />
                              )}
                              <span>
                                {copiedKey === `order-utm-${order.id}`
                                  ? 'Copied Link'
                                  : 'Copy UTM'}
                              </span>
                            </button>

                            {order.generatedKit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedOrderKitId(
                                    kitExpanded ? null : order.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DAD4C6] bg-white hover:bg-[#FAF9F5] text-black text-xs font-semibold cursor-pointer"
                              >
                                <span>Ad Kit</span>
                                {kitExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}

                            {order.status === 'pending_payment' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(order.id, 'paid')
                                }
                                className="px-2.5 py-1 rounded bg-[#13151A] hover:bg-black text-white text-xs font-semibold cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            )}
                            {(order.status === 'paid' ||
                              order.status === 'paused') && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(order.id, 'active')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1D4ED8] hover:bg-[#163B9E] text-white text-xs font-semibold cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Activate</span>
                              </button>
                            )}
                            {order.status === 'active' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(order.id, 'paused')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DAD4C6] bg-white hover:bg-[#FAF9F5] text-black text-xs font-semibold cursor-pointer"
                              >
                                <Pause className="w-3 h-3" />
                                <span>Pause</span>
                              </button>
                            )}
                            {order.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(order.id, 'completed')
                                }
                                className="px-2.5 py-1 rounded border border-[#DAD4C6] bg-white hover:bg-[#FAF9F5] text-black text-xs font-semibold cursor-pointer"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete order"
                              aria-label="Delete campaign order"
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-1.5 rounded border border-[#DAD4C6] bg-white hover:bg-red-50 hover:text-red-700 text-black cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {kitExpanded && order.generatedKit && (
                        <div className="p-4 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-black">
                          <div className="space-y-1">
                            <div className="font-bold">Google Search Headlines</div>
                            {order.generatedKit.googleSearchAd.headlines.map(
                              (h, idx) => (
                                <div key={idx} className="text-[#1D4ED8] font-medium">
                                  {h}
                                </div>
                              )
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold">Meta Social Ad</div>
                            <div className="font-semibold">
                              {order.generatedKit.metaSocialAd.headline}
                            </div>
                            <p className="leading-relaxed">
                              {order.generatedKit.metaSocialAd.primaryText}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold">Email Broadcast Subject</div>
                            <div className="font-semibold">
                              {order.generatedKit.emailBroadcast.subject}
                            </div>
                            <div className="pt-1 font-mono">
                              Keywords:{' '}
                              {order.generatedKit.targetKeywords
                                .slice(0, 5)
                                .join(', ')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
