import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', '.data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const LEGACY_DEPLOYMENTS_FILE = path.resolve(__dirname, '..', '.deployments', 'sites.json');

export interface ProjectRecord {
  id: string;
  clientName: string;
  name: string;
  slug: string;
  description: string;
  theme: Record<string, unknown>;
  blocks: Array<Record<string, unknown>>;
  seo: Record<string, unknown>;
  marketing?: Record<string, unknown>;
  lastDeployedSlug?: string | null;
  lastDeployedUrl?: string | null;
  lastDeployedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentRecord {
  slug: string;
  projectId?: string | null;
  clientName: string;
  name: string;
  description: string;
  html: string;
  blockCount: number;
  customDomain?: string | null;
  domainVerified?: boolean;
  domainVerifiedAt?: string | null;
  deployedAt: string;
}

export interface LeadSubmissionRecord {
  id: string;
  siteSlug: string;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}

export type AnalyticsEventType = 'page_view' | 'cta_click' | 'form_submit';
export type DeviceCategory = 'desktop' | 'tablet' | 'mobile';

export interface AnalyticsEventRecord {
  id: string;
  siteSlug: string;
  eventType: AnalyticsEventType;
  deviceType: DeviceCategory;
  referrer: string;
  targetLabel: string;
  createdAt: string;
}

export interface MarketingOrderDbRecord {
  id: string;
  siteSlug: string;
  siteName: string;
  clientName: string;
  customerEmail: string;
  packageId: string;
  packageName: string;
  billingType: 'one_time' | 'monthly';
  adBudgetUsd: number;
  serviceFeeUsd: number;
  totalUsd: number;
  channels: string[];
  targetAudience: string;
  campaignGoal: string;
  utmCampaign: string;
  status: 'pending_payment' | 'paid' | 'active' | 'paused' | 'completed';
  paymentProvider: 'stripe' | 'invoice';
  stripeSessionId?: string | null;
  generatedKit?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface LocalStoreData {
  projects: Record<string, ProjectRecord>;
  deployments: Record<string, DeploymentRecord>;
  leads: LeadSubmissionRecord[];
  events: AnalyticsEventRecord[];
  marketingOrders: MarketingOrderDbRecord[];
}

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readLocalStore(): LocalStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let initial: LocalStoreData = {
    projects: {},
    deployments: {},
    leads: [],
    events: [],
    marketingOrders: [],
  };

  if (fs.existsSync(STORE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as Partial<LocalStoreData>;
      initial = {
        projects: parsed.projects || {},
        deployments: parsed.deployments || {},
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        marketingOrders: Array.isArray(parsed.marketingOrders) ? parsed.marketingOrders : [],
      };
    } catch {
      // Fallback to empty store
    }
  } else if (fs.existsSync(LEGACY_DEPLOYMENTS_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_DEPLOYMENTS_FILE, 'utf-8')) as Record<
        string,
        Partial<DeploymentRecord>
      >;
      for (const [slug, rec] of Object.entries(legacy)) {
        if (rec && rec.html) {
          initial.deployments[slug] = {
            slug,
            clientName: 'Studio Client',
            name: rec.name || slug,
            description: rec.description || '',
            html: rec.html,
            blockCount: Number(rec.blockCount || 0),
            deployedAt: rec.deployedAt || new Date().toISOString(),
          };
        }
      }
      writeLocalStore(initial);
    } catch {
      // Ignore legacy parse errors
    }
  }

  return initial;
}

function writeLocalStore(data: LocalStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`Supabase listProjects failed: ${error.message}`);
    return (data || []).map((row) => {
      const rawSeo = (row.seo || {}) as Record<string, unknown>;
      const { _marketing, ...cleanSeo } = rawSeo;
      return {
        id: row.id,
        clientName: row.client_name,
        name: row.name,
        slug: row.slug,
        description: row.description,
        theme: row.theme,
        blocks: row.blocks,
        seo: cleanSeo,
        marketing:
          (_marketing && typeof _marketing === 'object'
            ? (_marketing as Record<string, unknown>)
            : {}) || {},
        lastDeployedSlug: row.last_deployed_slug,
        lastDeployedUrl: row.last_deployed_url,
        lastDeployedAt: row.last_deployed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  const store = readLocalStore();
  return Object.values(store.projects).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function upsertProject(project: ProjectRecord): Promise<ProjectRecord> {
  const now = new Date().toISOString();
  const record: ProjectRecord = {
    ...project,
    clientName: project.clientName || 'Internal Studio',
    seo: project.seo || {},
    marketing: project.marketing || {},
    createdAt: project.createdAt || now,
    updatedAt: now,
  };

  const sb = getSupabaseClient();
  if (sb) {
    const seoWithMarketing = {
      ...record.seo,
      ...(record.marketing && Object.keys(record.marketing).length > 0
        ? { _marketing: record.marketing }
        : {}),
    };
    const { error } = await sb.from('af_projects').upsert({
      id: record.id,
      client_name: record.clientName,
      name: record.name,
      slug: record.slug,
      description: record.description,
      theme: record.theme,
      blocks: record.blocks,
      seo: seoWithMarketing,
      last_deployed_slug: record.lastDeployedSlug ?? null,
      last_deployed_url: record.lastDeployedUrl ?? null,
      last_deployed_at: record.lastDeployedAt ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
    if (error) throw new Error(`Supabase upsertProject failed: ${error.message}`);
    return record;
  }

  const store = readLocalStore();
  store.projects[record.id] = record;
  writeLocalStore(store);
  return record;
}

export async function removeProject(id: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_projects').delete().eq('id', id);
    if (error) throw new Error(`Supabase removeProject failed: ${error.message}`);
    return true;
  }

  const store = readLocalStore();
  if (!store.projects[id]) return false;
  delete store.projects[id];
  writeLocalStore(store);
  return true;
}

export async function listDeployments(): Promise<Array<Omit<DeploymentRecord, 'html'> & { url: string }>> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_deployments')
      .select(
        'slug, project_id, client_name, name, description, block_count, custom_domain, domain_verified, domain_verified_at, deployed_at'
      )
      .order('deployed_at', { ascending: false });
    if (error) throw new Error(`Supabase listDeployments failed: ${error.message}`);
    return (data || []).map((d) => ({
      slug: d.slug,
      projectId: d.project_id,
      clientName: d.client_name,
      name: d.name,
      description: d.description,
      blockCount: d.block_count,
      customDomain: d.custom_domain ?? null,
      domainVerified: Boolean(d.domain_verified),
      domainVerifiedAt: d.domain_verified_at ?? null,
      deployedAt: d.deployed_at,
      url: `/sites/${d.slug}`,
    }));
  }

  const store = readLocalStore();
  return Object.values(store.deployments)
    .map((d) => ({
      slug: d.slug,
      projectId: d.projectId ?? null,
      clientName: d.clientName || 'Studio Client',
      name: d.name,
      description: d.description,
      blockCount: d.blockCount,
      customDomain: d.customDomain ?? null,
      domainVerified: Boolean(d.domainVerified),
      domainVerifiedAt: d.domainVerifiedAt ?? null,
      deployedAt: d.deployedAt,
      url: `/sites/${d.slug}`,
    }))
    .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());
}

export async function saveDeployment(record: DeploymentRecord): Promise<DeploymentRecord> {
  const existing = await getDeploymentBySlug(record.slug);
  const resolvedDomain =
    record.customDomain !== undefined
      ? record.customDomain
      : existing?.customDomain ?? null;
  const domainChanged =
    record.customDomain !== undefined &&
    (record.customDomain || null) !== (existing?.customDomain || null);
  const resolvedVerified = domainChanged
    ? Boolean(record.domainVerified)
    : record.domainVerified !== undefined
    ? record.domainVerified
    : Boolean(existing?.domainVerified);
  const resolvedVerifiedAt = domainChanged
    ? record.domainVerifiedAt ?? null
    : record.domainVerifiedAt !== undefined
    ? record.domainVerifiedAt
    : existing?.domainVerifiedAt ?? null;

  const finalRecord: DeploymentRecord = {
    ...record,
    customDomain: resolvedDomain,
    domainVerified: resolvedVerified,
    domainVerifiedAt: resolvedVerifiedAt,
  };

  const sb = getSupabaseClient();
  if (sb) {
    if (finalRecord.customDomain) {
      const { data: conflict } = await sb
        .from('af_deployments')
        .select('slug')
        .ilike('custom_domain', finalRecord.customDomain)
        .neq('slug', finalRecord.slug)
        .maybeSingle();
      if (conflict) {
        throw new Error(
          `Domain "${finalRecord.customDomain}" is already connected to /sites/${conflict.slug}.`
        );
      }
    }

    const { error } = await sb.from('af_deployments').upsert({
      slug: finalRecord.slug,
      project_id: finalRecord.projectId ?? null,
      client_name: finalRecord.clientName || 'Studio Client',
      name: finalRecord.name,
      description: finalRecord.description,
      html: finalRecord.html,
      block_count: finalRecord.blockCount,
      custom_domain: finalRecord.customDomain ?? null,
      domain_verified: Boolean(finalRecord.domainVerified),
      domain_verified_at: finalRecord.domainVerifiedAt ?? null,
      deployed_at: finalRecord.deployedAt,
    });
    if (error) throw new Error(`Supabase saveDeployment failed: ${error.message}`);
    return finalRecord;
  }

  const store = readLocalStore();
  if (finalRecord.customDomain) {
    const conflict = Object.values(store.deployments).find(
      (d) =>
        d.slug !== finalRecord.slug &&
        d.customDomain?.toLowerCase() === finalRecord.customDomain?.toLowerCase()
    );
    if (conflict) {
      throw new Error(
        `Domain "${finalRecord.customDomain}" is already connected to /sites/${conflict.slug}.`
      );
    }
  }
  store.deployments[finalRecord.slug] = finalRecord;
  writeLocalStore(store);
  return finalRecord;
}

export async function getDeploymentBySlug(slug: string): Promise<DeploymentRecord | null> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_deployments')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(`Supabase getDeploymentBySlug failed: ${error.message}`);
    if (!data) return null;
    return {
      slug: data.slug,
      projectId: data.project_id,
      clientName: data.client_name,
      name: data.name,
      description: data.description,
      html: data.html,
      blockCount: data.block_count,
      customDomain: data.custom_domain ?? null,
      domainVerified: Boolean(data.domain_verified),
      domainVerifiedAt: data.domain_verified_at ?? null,
      deployedAt: data.deployed_at,
    };
  }

  const store = readLocalStore();
  return store.deployments[slug] || null;
}

export async function setDeploymentDomain(
  slug: string,
  customDomain: string | null,
  verified = false
): Promise<DeploymentRecord> {
  const existing = await getDeploymentBySlug(slug);
  if (!existing) {
    throw new Error(`No deployment found at /sites/${slug}. Publish the site first.`);
  }

  const normalized = customDomain ? customDomain.toLowerCase().trim() : null;
  const domainVerifiedAt = verified ? new Date().toISOString() : null;

  const sb = getSupabaseClient();
  if (sb) {
    if (normalized) {
      const { data: conflict } = await sb
        .from('af_deployments')
        .select('slug')
        .ilike('custom_domain', normalized)
        .neq('slug', slug)
        .maybeSingle();
      if (conflict) {
        throw new Error(
          `Domain "${normalized}" is already connected to /sites/${conflict.slug}.`
        );
      }
    }

    const { error } = await sb
      .from('af_deployments')
      .update({
        custom_domain: normalized,
        domain_verified: verified,
        domain_verified_at: domainVerifiedAt,
      })
      .eq('slug', slug);
    if (error) throw new Error(`Supabase setDeploymentDomain failed: ${error.message}`);
    return {
      ...existing,
      customDomain: normalized,
      domainVerified: verified,
      domainVerifiedAt,
    };
  }

  const store = readLocalStore();
  if (normalized) {
    const conflict = Object.values(store.deployments).find(
      (d) => d.slug !== slug && d.customDomain?.toLowerCase() === normalized
    );
    if (conflict) {
      throw new Error(
        `Domain "${normalized}" is already connected to /sites/${conflict.slug}.`
      );
    }
  }
  const updated: DeploymentRecord = {
    ...store.deployments[slug],
    customDomain: normalized,
    domainVerified: verified,
    domainVerifiedAt,
  };
  store.deployments[slug] = updated;
  writeLocalStore(store);
  return updated;
}

export async function markDeploymentDomainVerified(
  slug: string,
  verified: boolean
): Promise<DeploymentRecord | null> {
  const existing = await getDeploymentBySlug(slug);
  if (!existing) return null;

  const domainVerifiedAt = verified ? new Date().toISOString() : null;
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb
      .from('af_deployments')
      .update({
        domain_verified: verified,
        domain_verified_at: domainVerifiedAt,
      })
      .eq('slug', slug);
    if (error) throw new Error(`Supabase markDeploymentDomainVerified failed: ${error.message}`);
    return { ...existing, domainVerified: verified, domainVerifiedAt };
  }

  const store = readLocalStore();
  if (!store.deployments[slug]) return null;
  store.deployments[slug] = {
    ...store.deployments[slug],
    domainVerified: verified,
    domainVerifiedAt,
  };
  writeLocalStore(store);
  return store.deployments[slug];
}

export async function getDeploymentByDomain(hostname: string): Promise<DeploymentRecord | null> {
  const clean = hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '').trim();
  if (!clean) return null;

  const alt = clean.startsWith('www.') ? clean.slice(4) : `www.${clean}`;
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_deployments')
      .select('*')
      .or(`custom_domain.ilike.${clean},custom_domain.ilike.${alt}`)
      .limit(2);
    if (error || !data || data.length === 0) return null;
    const match =
      data.find((d) => d.custom_domain?.toLowerCase() === clean) || data[0];
    return {
      slug: match.slug,
      projectId: match.project_id,
      clientName: match.client_name,
      name: match.name,
      description: match.description,
      html: match.html,
      blockCount: match.block_count,
      customDomain: match.custom_domain ?? null,
      domainVerified: Boolean(match.domain_verified),
      domainVerifiedAt: match.domain_verified_at ?? null,
      deployedAt: match.deployed_at,
    };
  }

  const store = readLocalStore();
  const list = Object.values(store.deployments);
  return (
    list.find((d) => d.customDomain?.toLowerCase() === clean) ||
    list.find((d) => d.customDomain?.toLowerCase() === alt) ||
    null
  );
}

export async function deleteDeploymentBySlug(slug: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_deployments').delete().eq('slug', slug);
    if (error) throw new Error(`Supabase deleteDeploymentBySlug failed: ${error.message}`);
    return true;
  }

  const store = readLocalStore();
  if (!store.deployments[slug]) return false;
  delete store.deployments[slug];
  writeLocalStore(store);
  return true;
}

export async function createLeadSubmission(
  input: Omit<LeadSubmissionRecord, 'id' | 'submittedAt'>
): Promise<LeadSubmissionRecord> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_form_submissions')
      .insert({
        site_slug: input.siteSlug,
        name: input.name,
        email: input.email,
        message: input.message,
      })
      .select('*')
      .single();
    if (error) throw new Error(`Supabase createLeadSubmission failed: ${error.message}`);
    return {
      id: data.id,
      siteSlug: data.site_slug,
      name: data.name,
      email: data.email,
      message: data.message,
      submittedAt: data.submitted_at,
    };
  }

  const store = readLocalStore();
  const record: LeadSubmissionRecord = {
    id: `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    siteSlug: input.siteSlug,
    name: input.name,
    email: input.email,
    message: input.message,
    submittedAt: new Date().toISOString(),
  };
  store.leads.unshift(record);
  if (store.leads.length > 500) {
    store.leads = store.leads.slice(0, 500);
  }
  writeLocalStore(store);
  return record;
}

export async function listLeadSubmissions(siteSlug?: string): Promise<LeadSubmissionRecord[]> {
  const sb = getSupabaseClient();
  if (sb) {
    let query = sb
      .from('af_form_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (siteSlug) {
      query = query.eq('site_slug', siteSlug);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase listLeadSubmissions failed: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      siteSlug: row.site_slug,
      name: row.name,
      email: row.email,
      message: row.message,
      submittedAt: row.submitted_at,
    }));
  }

  const store = readLocalStore();
  const list = siteSlug
    ? store.leads.filter((l) => l.siteSlug === siteSlug)
    : store.leads;
  return list;
}

export async function deleteLeadSubmission(id: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_form_submissions').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteLeadSubmission failed: ${error.message}`);
    return true;
  }

  const store = readLocalStore();
  const before = store.leads.length;
  store.leads = store.leads.filter((l) => l.id !== id);
  if (store.leads.length === before) return false;
  writeLocalStore(store);
  return true;
}

export async function recordAnalyticsEvent(
  input: Omit<AnalyticsEventRecord, 'id' | 'createdAt'>
): Promise<void> {
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_analytics_events').insert({
      site_slug: input.siteSlug,
      event_type: input.eventType,
      device_type: input.deviceType,
      referrer: input.referrer || 'Direct',
      target_label: input.targetLabel || '',
    });
    if (error) {
      console.error('Supabase recordAnalyticsEvent failed:', error.message);
    }
    return;
  }

  const store = readLocalStore();
  const record: AnalyticsEventRecord = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    siteSlug: input.siteSlug,
    eventType: input.eventType,
    deviceType: input.deviceType,
    referrer: input.referrer || 'Direct',
    targetLabel: input.targetLabel || '',
    createdAt: new Date().toISOString(),
  };
  store.events.unshift(record);
  if (store.events.length > 5000) {
    store.events = store.events.slice(0, 5000);
  }
  writeLocalStore(store);
}

export async function getAnalyticsData(options: { slug?: string; days?: number }) {
  const days = Math.min(Math.max(Number(options.days || 14), 1), 90);
  const slugFilter = options.slug && options.slug !== 'all' ? options.slug : undefined;
  const cutoffMs = Date.now() - days * 86_400_000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const [deployments, projects, leads] = await Promise.all([
    listDeployments(),
    listProjects(),
    listLeadSubmissions(slugFilter),
  ]);

  let events: AnalyticsEventRecord[] = [];
  const sb = getSupabaseClient();
  if (sb) {
    let query = sb
      .from('af_analytics_events')
      .select('*')
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (slugFilter) {
      query = query.eq('site_slug', slugFilter);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase getAnalyticsData failed: ${error.message}`);
    events = (data || []).map((row) => ({
      id: row.id,
      siteSlug: row.site_slug,
      eventType: row.event_type,
      deviceType: row.device_type,
      referrer: row.referrer,
      targetLabel: row.target_label,
      createdAt: row.created_at,
    }));
  } else {
    const store = readLocalStore();
    events = store.events.filter((ev) => {
      if (slugFilter && ev.siteSlug !== slugFilter) return false;
      return new Date(ev.createdAt).getTime() >= cutoffMs;
    });
  }

  // Build daily buckets
  const dayMap = new Map<
    string,
    { date: string; views: number; clicks: number; leads: number }
  >();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { date: key, views: 0, clicks: 0, leads: 0 });
  }

  const deviceCounts: Record<DeviceCategory, number> = {
    desktop: 0,
    tablet: 0,
    mobile: 0,
  };
  const referrerCounts = new Map<string, number>();
  const ctaCounts = new Map<string, number>();
  const perSite = new Map<
    string,
    { views: number; clicks: number; leads: number }
  >();

  for (const dep of deployments) {
    perSite.set(dep.slug, { views: 0, clicks: 0, leads: 0 });
  }

  let totalViews = 0;
  let totalClicks = 0;

  for (const ev of events) {
    const dayKey = ev.createdAt.slice(0, 10);
    const bucket = dayMap.get(dayKey);
    const siteStats = perSite.get(ev.siteSlug) || { views: 0, clicks: 0, leads: 0 };

    if (ev.eventType === 'page_view') {
      totalViews++;
      siteStats.views++;
      if (bucket) bucket.views++;
      deviceCounts[ev.deviceType] = (deviceCounts[ev.deviceType] || 0) + 1;
      const ref = ev.referrer || 'Direct';
      referrerCounts.set(ref, (referrerCounts.get(ref) || 0) + 1);
    } else if (ev.eventType === 'cta_click') {
      totalClicks++;
      siteStats.clicks++;
      if (bucket) bucket.clicks++;
      const label = ev.targetLabel || 'Button';
      ctaCounts.set(label, (ctaCounts.get(label) || 0) + 1);
    }
    perSite.set(ev.siteSlug, siteStats);
  }

  const filteredLeads = leads.filter(
    (l) => new Date(l.submittedAt).getTime() >= cutoffMs
  );
  for (const lead of filteredLeads) {
    const dayKey = lead.submittedAt.slice(0, 10);
    const bucket = dayMap.get(dayKey);
    if (bucket) bucket.leads++;
    const siteStats = perSite.get(lead.siteSlug) || { views: 0, clicks: 0, leads: 0 };
    siteStats.leads++;
    perSite.set(lead.siteSlug, siteStats);
  }

  const siteMetrics = deployments.map((dep) => {
    const st = perSite.get(dep.slug) || { views: 0, clicks: 0, leads: 0 };
    const conversionRate = st.views > 0 ? (st.leads / st.views) * 100 : 0;
    return {
      slug: dep.slug,
      name: dep.name,
      clientName: dep.clientName || 'Studio Client',
      url: dep.url,
      blockCount: dep.blockCount,
      deployedAt: dep.deployedAt,
      views: st.views,
      clicks: st.clicks,
      leads: st.leads,
      conversionRate,
    };
  });

  const totalLeads = filteredLeads.length;
  const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

  return {
    summary: {
      totalViews,
      totalClicks,
      totalLeads,
      conversionRate,
      publishedSitesCount: deployments.length,
      savedProjectsCount: projects.length,
    },
    series: Array.from(dayMap.values()),
    devices: [
      { device: 'Desktop', count: deviceCounts.desktop },
      { device: 'Tablet', count: deviceCounts.tablet },
      { device: 'Mobile', count: deviceCounts.mobile },
    ],
    topReferrers: Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    topCtas: Array.from(ctaCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    sites: siteMetrics,
    leads: filteredLeads.slice(0, 100),
    recentEvents: events.slice(0, 40),
  };
}

function mapMarketingOrderRow(row: Record<string, any>): MarketingOrderDbRecord {
  return {
    id: row.id,
    siteSlug: row.site_slug,
    siteName: row.site_name,
    clientName: row.client_name || 'Internal Studio',
    customerEmail: row.customer_email,
    packageId: row.package_id,
    packageName: row.package_name,
    billingType: row.billing_type === 'monthly' ? 'monthly' : 'one_time',
    adBudgetUsd: Number(row.ad_budget_usd || 0),
    serviceFeeUsd: Number(row.service_fee_usd || 0),
    totalUsd: Number(row.total_usd || 0),
    channels: Array.isArray(row.channels) ? row.channels : [],
    targetAudience: row.target_audience || '',
    campaignGoal: row.campaign_goal || 'Leads & Inquiries',
    utmCampaign: row.utm_campaign || '',
    status: row.status || 'pending_payment',
    paymentProvider: row.payment_provider === 'stripe' ? 'stripe' : 'invoice',
    stripeSessionId: row.stripe_session_id ?? null,
    generatedKit: row.generated_kit ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMarketingOrders(): Promise<MarketingOrderDbRecord[]> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_marketing_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Supabase listMarketingOrders failed: ${error.message}`);
    return (data || []).map(mapMarketingOrderRow);
  }

  const store = readLocalStore();
  return [...store.marketingOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createMarketingOrder(
  order: Omit<MarketingOrderDbRecord, 'createdAt' | 'updatedAt'>
): Promise<MarketingOrderDbRecord> {
  const now = new Date().toISOString();
  const full: MarketingOrderDbRecord = {
    ...order,
    createdAt: now,
    updatedAt: now,
  };

  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_marketing_orders').insert({
      id: full.id,
      site_slug: full.siteSlug,
      site_name: full.siteName,
      client_name: full.clientName,
      customer_email: full.customerEmail,
      package_id: full.packageId,
      package_name: full.packageName,
      billing_type: full.billingType,
      ad_budget_usd: full.adBudgetUsd,
      service_fee_usd: full.serviceFeeUsd,
      total_usd: full.totalUsd,
      channels: full.channels,
      target_audience: full.targetAudience,
      campaign_goal: full.campaignGoal,
      utm_campaign: full.utmCampaign,
      status: full.status,
      payment_provider: full.paymentProvider,
      stripe_session_id: full.stripeSessionId ?? null,
      generated_kit: full.generatedKit ?? null,
      created_at: full.createdAt,
      updated_at: full.updatedAt,
    });
    if (error) throw new Error(`Supabase createMarketingOrder failed: ${error.message}`);
    return full;
  }

  const store = readLocalStore();
  store.marketingOrders.unshift(full);
  if (store.marketingOrders.length > 200) {
    store.marketingOrders = store.marketingOrders.slice(0, 200);
  }
  writeLocalStore(store);
  return full;
}

export async function getMarketingOrderByStripeSession(
  sessionId: string
): Promise<MarketingOrderDbRecord | null> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('af_marketing_orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (error) throw new Error(`Supabase getMarketingOrderByStripeSession failed: ${error.message}`);
    return data ? mapMarketingOrderRow(data) : null;
  }

  const store = readLocalStore();
  return store.marketingOrders.find((o) => o.stripeSessionId === sessionId) || null;
}

export async function updateMarketingOrder(
  id: string,
  patch: Partial<
    Pick<
      MarketingOrderDbRecord,
      'status' | 'stripeSessionId' | 'generatedKit' | 'paymentProvider'
    >
  >
): Promise<MarketingOrderDbRecord | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseClient();
  if (sb) {
    const payload: Record<string, unknown> = { updated_at: now };
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.stripeSessionId !== undefined) payload.stripe_session_id = patch.stripeSessionId;
    if (patch.generatedKit !== undefined) payload.generated_kit = patch.generatedKit;
    if (patch.paymentProvider !== undefined) payload.payment_provider = patch.paymentProvider;

    const { data, error } = await sb
      .from('af_marketing_orders')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Supabase updateMarketingOrder failed: ${error.message}`);
    return data ? mapMarketingOrderRow(data) : null;
  }

  const store = readLocalStore();
  const idx = store.marketingOrders.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const updated: MarketingOrderDbRecord = {
    ...store.marketingOrders[idx],
    ...patch,
    updatedAt: now,
  };
  store.marketingOrders[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function deleteMarketingOrder(id: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('af_marketing_orders').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteMarketingOrder failed: ${error.message}`);
    return true;
  }

  const store = readLocalStore();
  const prevLen = store.marketingOrders.length;
  store.marketingOrders = store.marketingOrders.filter((o) => o.id !== id);
  if (store.marketingOrders.length === prevLen) return false;
  writeLocalStore(store);
  return true;
}
