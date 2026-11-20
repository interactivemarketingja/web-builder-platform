import express from 'express';
import path from 'path';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  createLeadSubmission,
  createMarketingOrder,
  deleteDeploymentBySlug,
  deleteLeadSubmission,
  deleteMarketingOrder,
  getAnalyticsData,
  getDeploymentByDomain,
  getDeploymentBySlug,
  getMarketingOrderByStripeSession,
  listDeployments,
  listLeadSubmissions,
  listMarketingOrders,
  listProjects,
  markDeploymentDomainVerified,
  recordAnalyticsEvent,
  removeProject,
  saveDeployment,
  setDeploymentDomain,
  updateMarketingOrder,
  upsertProject,
} from './server/storage.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Lightweight sliding-window rate limiter for AI and public submission routes
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

function sanitizeSlug(input: string): string {
  const clean = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || `site-${Date.now().toString(36)}`;
}

function getStudioHost(req?: express.Request): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl) {
    try {
      return new URL(envAppUrl).hostname.toLowerCase();
    } catch {
      // Fallback to request header
    }
  }
  const hostHeader = req?.headers['x-forwarded-host'] || req?.headers.host || '';
  const first = String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  return first || 'localhost';
}

function normalizeCustomDomain(input: string, studioHost?: string): string {
  let raw = String(input || '').trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//, '');
  raw = raw.split('/')[0].split('?')[0].split('#')[0];
  raw = raw.replace(/:\d+$/, '').replace(/\.$/, '');

  if (!raw) {
    throw new Error('Please enter a domain name (for example, www.yourbrand.com).');
  }
  if (raw === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    throw new Error('Please enter a valid public domain name, not localhost or an IP address.');
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw)) {
    throw new Error('Invalid domain format. Example: yourbrand.com or www.yourbrand.com');
  }
  if (studioHost && raw === studioHost.toLowerCase()) {
    throw new Error('Cannot connect the Studio host domain itself.');
  }
  return raw;
}

function buildDnsInstructions(domain: string, slug: string, targetHost: string) {
  const parts = domain.split('.');
  const isApex = parts.length <= 2;
  const cnameHost = isApex ? '@' : parts.slice(0, -2).join('.');
  const txtHost = isApex ? '_atelier-frame' : `_atelier-frame.${cnameHost}`;
  return {
    domain,
    cnameHost,
    cnameTarget: targetHost,
    txtHost,
    txtValue: `atelier-site=${slug}`,
  };
}

function detectDeviceFromUa(ua: string): 'desktop' | 'tablet' | 'mobile' {
  const lower = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(lower)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(lower)) return 'mobile';
  return 'desktop';
}

function extractReferrerHost(referer?: string): string {
  if (!referer) return 'Direct';
  try {
    const parsed = new URL(referer);
    return parsed.hostname || 'Direct';
  } catch {
    return 'Direct';
  }
}

function extractAttribution(req: express.Request): string {
  const utmSource = String(req.query?.utm_source || '').trim().slice(0, 40);
  const utmCampaign = String(req.query?.utm_campaign || '').trim().slice(0, 48);
  if (utmSource || utmCampaign) {
    return utmSource && utmCampaign
      ? `utm:${utmSource}/${utmCampaign}`
      : utmSource
      ? `utm:${utmSource}`
      : `utm:campaign/${utmCampaign}`;
  }
  return extractReferrerHost(req.headers.referer);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VERIFIED_ASSETS = [
  {
    id: 'studio-loft',
    url: '/src/assets/images/hero_studio_architecture_1794976771485.jpg',
    description: 'Sunlit concrete and oak architectural design studio interior',
  },
  {
    id: 'hardware-desk',
    url: '/src/assets/images/product_hardware_craft_1794976773858.jpg',
    description: 'Precision machined anodized aluminum hardware instrument and headphones on slate',
  },
  {
    id: 'atelier-team',
    url: '/src/assets/images/team_atelier_portrait_1794976774786.jpg',
    description: 'Product designers and engineers collaborating around a birch worktable',
  },
  {
    id: 'botanical-pavilion',
    url: '/src/assets/images/abstract_botanical_glass_1794976774281.jpg',
    description: 'Minimalist glass conservatory with limestone floor and olive trees',
  },
  {
    id: 'roastery-bar',
    url: '/src/assets/images/hero_roastery_coffee_1795062577796.jpg',
    description: 'Minimalist specialty coffee roastery and oak pour-over bar',
  },
  {
    id: 'saas-telemetry',
    url: '/src/assets/images/hero_saas_telemetry_1795062578275.jpg',
    description: 'Modern cold-chain logistics telemetry command studio',
  },
  {
    id: 'wellness-sanctuary',
    url: '/src/assets/images/hero_wellness_sanctuary_1795062577433.jpg',
    description: 'Serene travertine and cedar preventive longevity wellness clinic',
  },
  {
    id: 'fellowship-workshop',
    url: '/src/assets/images/hero_fellowship_workshop_1795062577617.jpg',
    description: 'Contemporary design and engineering fellowship studio workshop',
  },
];

function resolveAssetUrl(candidate?: string): string {
  if (!candidate) return VERIFIED_ASSETS[0].url;
  const matched = VERIFIED_ASSETS.find((a) => a.url === candidate || a.id === candidate);
  if (matched) return matched.url;
  return VERIFIED_ASSETS[0].url;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  // Baseline security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Client Projects CRUD (persisted to Supabase or disk store)
  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await listProjects();
      res.json({ projects });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.id || !body.name || !body.theme || !Array.isArray(body.blocks)) {
        res.status(400).json({ error: 'Valid project payload (id, name, theme, blocks) is required.' });
        return;
      }
      const saved = await upsertProject({
        id: String(body.id).slice(0, 80),
        clientName: String(body.clientName || 'Internal Studio').slice(0, 120),
        name: String(body.name).slice(0, 140),
        slug: sanitizeSlug(body.slug || body.name),
        description: String(body.description || '').slice(0, 400),
        theme: body.theme,
        blocks: body.blocks,
        seo: body.seo || {},
        marketing: body.marketing || {},
        lastDeployedSlug: body.lastDeployedSlug || null,
        lastDeployedUrl: body.lastDeployedUrl || null,
        lastDeployedAt: body.lastDeployedAt || null,
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      res.json({ project: saved });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save project.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').slice(0, 80);
      await removeProject(id);
      res.json({ ok: true, id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project.';
      res.status(500).json({ error: message });
    }
  });

  // Generate responsive template from user prompt via Gemini
  app.post('/api/generate-template', async (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(`gen:${clientIp}`, 20, 60_000)) {
      res.status(429).json({ error: 'Rate limit reached. Please wait a minute before generating again.' });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || '').trim();
      const stylePreference = String(req.body?.style || 'auto').trim();
      if (!prompt) {
        res.status(400).json({ error: 'Please provide a website prompt.' });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are a senior web design director and copywriter building bespoke, responsive websites.
Generate a complete, cohesive website specification for the user's prompt.

Design & Copy Rules:
- Write specific, domain-authentic copy tailored to the prompt. Never use generic filler ("Lorem ipsum", "Revolutionize your workflow", "Unlock the future", "Next-gen AI").
- Use realistic names, concrete metrics with units, and human editorial tone.
- Choose a cohesive 60-30-10 color palette (backgroundColor, surfaceColor, contrastBgColor, textColor, mutedTextColor, borderColor, primaryColor, accentTextColor). On light backgrounds, set both textColor and mutedTextColor to "#000000" for crisp black typography without grey text.
- Choose displayFont from: "Plus Jakarta Sans", "Outfit", "Bricolage Grotesque", "Manrope", "Playfair Display", "Cormorant Garamond".
- Choose bodyFont from: "DM Sans", "Plus Jakarta Sans", "Manrope", "Lora".
- Choose radius from: "0px", "6px", "12px".
- Choose spacing from: "compact", "balanced", "airy".
- For imageUrl fields, you MUST pick one of these exact verified asset URLs that best fits the prompt:
  1. "/src/assets/images/hero_studio_architecture_1794976771485.jpg" (architecture, studio, agency, workspace, interior)
  2. "/src/assets/images/product_hardware_craft_1794976773858.jpg" (hardware, audio, electronics, industrial product, tech)
  3. "/src/assets/images/team_atelier_portrait_1794976774786.jpg" (consulting, engineering team, workshop, creative studio, B2B)
  4. "/src/assets/images/abstract_botanical_glass_1794976774281.jpg" (hospitality, botanical, luxury venue, gallery, real estate)
  5. "/src/assets/images/hero_roastery_coffee_1795062577796.jpg" (coffee, cafe, roastery, food & beverage, retail)
  6. "/src/assets/images/hero_saas_telemetry_1795062578275.jpg" (SaaS, logistics, telemetry, analytics, enterprise software)
  7. "/src/assets/images/hero_wellness_sanctuary_1795062577433.jpg" (wellness, healthcare, longevity clinic, spa, architecture)
  8. "/src/assets/images/hero_fellowship_workshop_1795062577617.jpg" (education, cohort, fellowship, design sprint, tech studio)
- Build 6 to 8 well-paced sections always starting with "navbar", followed by "hero", a balanced mix of middle sections ("stats", "features", "showcase", "pricing", "testimonial", "faq", "cta", "contact"), and ending with "footer".
- Every section object must populate the matching *Props object corresponding to its "type".`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a responsive website template for: "${prompt}". Style preference: ${stylePreference}.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              theme: {
                type: Type.OBJECT,
                properties: {
                  primaryColor: { type: Type.STRING },
                  accentTextColor: { type: Type.STRING },
                  backgroundColor: { type: Type.STRING },
                  surfaceColor: { type: Type.STRING },
                  contrastBgColor: { type: Type.STRING },
                  textColor: { type: Type.STRING },
                  mutedTextColor: { type: Type.STRING },
                  borderColor: { type: Type.STRING },
                  displayFont: { type: Type.STRING },
                  bodyFont: { type: Type.STRING },
                  radius: { type: Type.STRING },
                  spacing: { type: Type.STRING },
                },
                required: [
                  'primaryColor',
                  'accentTextColor',
                  'backgroundColor',
                  'surfaceColor',
                  'contrastBgColor',
                  'textColor',
                  'mutedTextColor',
                  'borderColor',
                  'displayFont',
                  'bodyFont',
                  'radius',
                  'spacing',
                ],
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      enum: [
                        'navbar',
                        'hero',
                        'features',
                        'showcase',
                        'stats',
                        'pricing',
                        'testimonial',
                        'faq',
                        'cta',
                        'contact',
                        'footer',
                      ],
                    },
                    label: { type: Type.STRING },
                    backgroundVariant: {
                      type: Type.STRING,
                      enum: ['canvas', 'surface', 'contrast'],
                    },
                    paddingY: {
                      type: Type.STRING,
                      enum: ['compact', 'normal', 'spacious'],
                    },
                    navbarProps: {
                      type: Type.OBJECT,
                      properties: {
                        brandName: { type: Type.STRING },
                        links: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              label: { type: Type.STRING },
                              href: { type: Type.STRING },
                            },
                            required: ['label', 'href'],
                          },
                        },
                        ctaLabel: { type: Type.STRING },
                        ctaHref: { type: Type.STRING },
                      },
                    },
                    heroProps: {
                      type: Type.OBJECT,
                      properties: {
                        layout: { type: Type.STRING, enum: ['split', 'centered', 'banner'] },
                        kicker: { type: Type.STRING },
                        headline: { type: Type.STRING },
                        subtitle: { type: Type.STRING },
                        primaryCtaLabel: { type: Type.STRING },
                        primaryCtaHref: { type: Type.STRING },
                        secondaryCtaLabel: { type: Type.STRING },
                        secondaryCtaHref: { type: Type.STRING },
                        imageUrl: { type: Type.STRING },
                        imageAlt: { type: Type.STRING },
                      },
                    },
                    featuresProps: {
                      type: Type.OBJECT,
                      properties: {
                        eyebrow: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        intro: { type: Type.STRING },
                        columns: { type: Type.INTEGER },
                        items: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING },
                              meta: { type: Type.STRING },
                            },
                            required: ['title', 'description'],
                          },
                        },
                      },
                    },
                    showcaseProps: {
                      type: Type.OBJECT,
                      properties: {
                        eyebrow: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        body: { type: Type.STRING },
                        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                        ctaLabel: { type: Type.STRING },
                        ctaHref: { type: Type.STRING },
                        imageUrl: { type: Type.STRING },
                        imageAlt: { type: Type.STRING },
                        imagePosition: { type: Type.STRING, enum: ['left', 'right'] },
                      },
                    },
                    statsProps: {
                      type: Type.OBJECT,
                      properties: {
                        heading: { type: Type.STRING },
                        items: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              value: { type: Type.STRING },
                              label: { type: Type.STRING },
                              context: { type: Type.STRING },
                            },
                            required: ['value', 'label', 'context'],
                          },
                        },
                      },
                    },
                    pricingProps: {
                      type: Type.OBJECT,
                      properties: {
                        eyebrow: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        intro: { type: Type.STRING },
                        tiers: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              audience: { type: Type.STRING },
                              price: { type: Type.STRING },
                              cadence: { type: Type.STRING },
                              description: { type: Type.STRING },
                              features: { type: Type.ARRAY, items: { type: Type.STRING } },
                              ctaLabel: { type: Type.STRING },
                              highlighted: { type: Type.BOOLEAN },
                            },
                            required: ['name', 'audience', 'price', 'cadence', 'description', 'features', 'ctaLabel', 'highlighted'],
                          },
                        },
                      },
                    },
                    testimonialProps: {
                      type: Type.OBJECT,
                      properties: {
                        quote: { type: Type.STRING },
                        authorName: { type: Type.STRING },
                        authorRole: { type: Type.STRING },
                        company: { type: Type.STRING },
                        outcome: { type: Type.STRING },
                      },
                    },
                    faqProps: {
                      type: Type.OBJECT,
                      properties: {
                        eyebrow: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        items: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              question: { type: Type.STRING },
                              answer: { type: Type.STRING },
                            },
                            required: ['question', 'answer'],
                          },
                        },
                      },
                    },
                    ctaProps: {
                      type: Type.OBJECT,
                      properties: {
                        headline: { type: Type.STRING },
                        description: { type: Type.STRING },
                        primaryCtaLabel: { type: Type.STRING },
                        primaryCtaHref: { type: Type.STRING },
                        secondaryCtaLabel: { type: Type.STRING },
                        secondaryCtaHref: { type: Type.STRING },
                      },
                    },
                    contactProps: {
                      type: Type.OBJECT,
                      properties: {
                        eyebrow: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        description: { type: Type.STRING },
                        email: { type: Type.STRING },
                        location: { type: Type.STRING },
                        submitLabel: { type: Type.STRING },
                      },
                    },
                    footerProps: {
                      type: Type.OBJECT,
                      properties: {
                        brandName: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        columns: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              heading: { type: Type.STRING },
                              links: {
                                type: Type.ARRAY,
                                items: {
                                  type: Type.OBJECT,
                                  properties: {
                                    label: { type: Type.STRING },
                                    href: { type: Type.STRING },
                                  },
                                  required: ['label', 'href'],
                                },
                              },
                            },
                            required: ['heading', 'links'],
                          },
                        },
                        copyright: { type: Type.STRING },
                      },
                    },
                  },
                  required: ['type', 'label', 'backgroundVariant', 'paddingY'],
                },
              },
            },
            required: ['name', 'description', 'theme', 'sections'],
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      const generated = JSON.parse(rawText);

      const allowedRadius = ['0px', '6px', '12px'];
      const allowedSpacing = ['compact', 'balanced', 'airy'];

      const theme = {
        primaryColor: generated.theme?.primaryColor || '#1D4ED8',
        accentTextColor: generated.theme?.accentTextColor || '#FFFFFF',
        backgroundColor: generated.theme?.backgroundColor || '#FFFFFF',
        surfaceColor: generated.theme?.surfaceColor || '#F4F6F8',
        contrastBgColor: generated.theme?.contrastBgColor || '#0F172A',
        textColor: '#000000',
        mutedTextColor: '#000000',
        borderColor: generated.theme?.borderColor || '#E2E8F0',
        displayFont: generated.theme?.displayFont || 'Plus Jakarta Sans',
        bodyFont: generated.theme?.bodyFont || 'DM Sans',
        radius: allowedRadius.includes(generated.theme?.radius) ? generated.theme.radius : '6px',
        spacing: allowedSpacing.includes(generated.theme?.spacing) ? generated.theme.spacing : 'balanced',
      };

      const rawSections: Array<Record<string, any>> = Array.isArray(generated.sections)
        ? generated.sections
        : [];

      const blocks = rawSections
        .map((sec) => {
          const type = sec.type;
          const base = {
            id: uid(type),
            type,
            label: sec.label || type,
            backgroundVariant: ['canvas', 'surface', 'contrast'].includes(sec.backgroundVariant)
              ? sec.backgroundVariant
              : 'canvas',
            paddingY: ['compact', 'normal', 'spacious'].includes(sec.paddingY)
              ? sec.paddingY
              : 'normal',
          };

          if (type === 'navbar' && sec.navbarProps) {
            return {
              ...base,
              props: {
                brandName: sec.navbarProps.brandName || generated.name || 'Studio',
                links: Array.isArray(sec.navbarProps.links) ? sec.navbarProps.links.slice(0, 5) : [],
                ctaLabel: sec.navbarProps.ctaLabel || 'Get Started',
                ctaHref: sec.navbarProps.ctaHref || '#contact',
              },
            };
          }
          if (type === 'hero' && sec.heroProps) {
            return {
              ...base,
              props: {
                layout: ['split', 'centered', 'banner'].includes(sec.heroProps.layout)
                  ? sec.heroProps.layout
                  : 'split',
                kicker: sec.heroProps.kicker || '',
                headline: sec.heroProps.headline || generated.name || 'Welcome',
                subtitle: sec.heroProps.subtitle || generated.description || '',
                primaryCtaLabel: sec.heroProps.primaryCtaLabel || 'Learn More',
                primaryCtaHref: sec.heroProps.primaryCtaHref || '#contact',
                secondaryCtaLabel: sec.heroProps.secondaryCtaLabel || '',
                secondaryCtaHref: sec.heroProps.secondaryCtaHref || '#work',
                imageUrl: resolveAssetUrl(sec.heroProps.imageUrl),
                imageAlt: sec.heroProps.imageAlt || generated.name || 'Featured visual',
              },
            };
          }
          if (type === 'features' && sec.featuresProps) {
            return {
              ...base,
              props: {
                eyebrow: sec.featuresProps.eyebrow || 'Capabilities',
                heading: sec.featuresProps.heading || 'Core Features',
                intro: sec.featuresProps.intro || '',
                columns: sec.featuresProps.columns === 2 ? 2 : 3,
                items: Array.isArray(sec.featuresProps.items) ? sec.featuresProps.items : [],
              },
            };
          }
          if (type === 'showcase' && sec.showcaseProps) {
            return {
              ...base,
              props: {
                eyebrow: sec.showcaseProps.eyebrow || 'Spotlight',
                heading: sec.showcaseProps.heading || 'Featured Work',
                body: sec.showcaseProps.body || '',
                bullets: Array.isArray(sec.showcaseProps.bullets) ? sec.showcaseProps.bullets : [],
                ctaLabel: sec.showcaseProps.ctaLabel || 'View Details',
                ctaHref: sec.showcaseProps.ctaHref || '#contact',
                imageUrl: resolveAssetUrl(sec.showcaseProps.imageUrl),
                imageAlt: sec.showcaseProps.imageAlt || 'Showcase visual',
                imagePosition: sec.showcaseProps.imagePosition === 'left' ? 'left' : 'right',
              },
            };
          }
          if (type === 'stats' && sec.statsProps) {
            return {
              ...base,
              props: {
                heading: sec.statsProps.heading || 'Key Benchmarks',
                items: Array.isArray(sec.statsProps.items) ? sec.statsProps.items.slice(0, 4) : [],
              },
            };
          }
          if (type === 'pricing' && sec.pricingProps) {
            return {
              ...base,
              props: {
                eyebrow: sec.pricingProps.eyebrow || 'Pricing',
                heading: sec.pricingProps.heading || 'Plans & Scope',
                intro: sec.pricingProps.intro || '',
                tiers: Array.isArray(sec.pricingProps.tiers) ? sec.pricingProps.tiers : [],
              },
            };
          }
          if (type === 'testimonial' && sec.testimonialProps) {
            return {
              ...base,
              props: {
                quote: sec.testimonialProps.quote || '',
                authorName: sec.testimonialProps.authorName || 'Client Partner',
                authorRole: sec.testimonialProps.authorRole || 'Director',
                company: sec.testimonialProps.company || 'Partner Organization',
                outcome: sec.testimonialProps.outcome || '',
              },
            };
          }
          if (type === 'faq' && sec.faqProps) {
            return {
              ...base,
              props: {
                eyebrow: sec.faqProps.eyebrow || 'FAQ',
                heading: sec.faqProps.heading || 'Common Questions',
                items: Array.isArray(sec.faqProps.items) ? sec.faqProps.items : [],
              },
            };
          }
          if (type === 'cta' && sec.ctaProps) {
            return {
              ...base,
              props: {
                headline: sec.ctaProps.headline || 'Ready to start?',
                description: sec.ctaProps.description || '',
                primaryCtaLabel: sec.ctaProps.primaryCtaLabel || 'Get in Touch',
                primaryCtaHref: sec.ctaProps.primaryCtaHref || '#contact',
                secondaryCtaLabel: sec.ctaProps.secondaryCtaLabel || '',
                secondaryCtaHref: sec.ctaProps.secondaryCtaHref || '#work',
              },
            };
          }
          if (type === 'contact' && sec.contactProps) {
            return {
              ...base,
              props: {
                eyebrow: sec.contactProps.eyebrow || 'Contact',
                heading: sec.contactProps.heading || 'Start a Conversation',
                description: sec.contactProps.description || '',
                email: sec.contactProps.email || 'hello@studio.example',
                location: sec.contactProps.location || 'San Francisco, CA',
                submitLabel: sec.contactProps.submitLabel || 'Send Message',
              },
            };
          }
          if (type === 'footer' && sec.footerProps) {
            return {
              ...base,
              props: {
                brandName: sec.footerProps.brandName || generated.name || 'Studio',
                summary: sec.footerProps.summary || generated.description || '',
                columns: Array.isArray(sec.footerProps.columns) ? sec.footerProps.columns : [],
                copyright: sec.footerProps.copyright || `© 2026 ${generated.name || 'Studio'}.`,
              },
            };
          }
          return null;
        })
        .filter(Boolean);

      res.json({
        name: generated.name || 'Generated Site',
        description: generated.description || prompt,
        theme,
        blocks,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate template.';
      console.error('Generate template error:', error);
      res.status(500).json({ error: message });
    }
  });

  // Refine a single selected block with Gemini
  app.post('/api/refine-block', async (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(`refine:${clientIp}`, 30, 60_000)) {
      res.status(429).json({ error: 'Rate limit reached. Please wait briefly before retrying.' });
      return;
    }

    try {
      const block = req.body?.block;
      const instruction = String(req.body?.instruction || '').trim();
      const siteContext = String(req.body?.siteContext || '').trim();

      if (!block || !instruction) {
        res.status(400).json({ error: 'Block data and refinement instruction are required.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Refine the "props" object of this "${block.type}" website section block according to the instruction.
Site context: ${siteContext}
Instruction: ${instruction}
Current block JSON: ${JSON.stringify(block)}

Return ONLY valid JSON with keys: "label" (string), "backgroundVariant" ("canvas"|"surface"|"contrast"), and "props" (preserving exact property keys and structure of the current block's props, only improving copy/values; if imageUrl exists, keep a valid "/src/assets/images/..." path).`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const refined = JSON.parse((response.text || '{}').trim());
      res.json({
        ...block,
        label: refined.label || block.label,
        backgroundVariant: ['canvas', 'surface', 'contrast'].includes(refined.backgroundVariant)
          ? refined.backgroundVariant
          : block.backgroundVariant,
        props: {
          ...block.props,
          ...(refined.props && typeof refined.props === 'object' ? refined.props : {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refine block.';
      console.error('Refine block error:', error);
      res.status(500).json({ error: message });
    }
  });

  // One-click deployment endpoints
  app.get('/api/deployments', async (_req, res) => {
    try {
      const deployments = await listDeployments();
      res.json({ deployments });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load deployments.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/deploy', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.body?.slug || req.body?.name || 'site');
      const projectId = req.body?.projectId ? String(req.body.projectId).slice(0, 80) : null;
      const clientName = String(req.body?.clientName || 'Studio Client').slice(0, 120);
      const name = String(req.body?.name || 'Deployed Site').slice(0, 120);
      const description = String(req.body?.description || '').slice(0, 300);
      const html = String(req.body?.html || '');
      const blockCount = Number(req.body?.blockCount || 0);
      const studioHost = getStudioHost(req);

      let customDomain: string | null | undefined = undefined;
      if (typeof req.body?.customDomain === 'string') {
        const trimmed = req.body.customDomain.trim();
        customDomain = trimmed ? normalizeCustomDomain(trimmed, studioHost) : null;
      }

      if (!html || !html.includes('<html')) {
        res.status(400).json({ error: 'Compiled HTML document is required for deployment.' });
        return;
      }

      const deployedAt = new Date().toISOString();
      const saved = await saveDeployment({
        slug,
        projectId,
        clientName,
        name,
        description,
        html,
        blockCount,
        customDomain,
        deployedAt,
      });

      res.json({
        slug: saved.slug,
        projectId: saved.projectId,
        clientName: saved.clientName,
        name: saved.name,
        description: saved.description,
        deployedAt: saved.deployedAt,
        blockCount: saved.blockCount,
        customDomain: saved.customDomain ?? null,
        domainVerified: Boolean(saved.domainVerified),
        domainVerifiedAt: saved.domainVerifiedAt ?? null,
        url: `/sites/${saved.slug}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deployment failed.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/deployments/:slug', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const deleted = await deleteDeploymentBySlug(slug);
      if (!deleted) {
        res.status(404).json({ error: 'Deployment not found.' });
        return;
      }
      res.json({ ok: true, slug });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove deployment.';
      res.status(500).json({ error: message });
    }
  });

  // Custom Domain Connection & Real DNS Verification
  app.post('/api/deployments/:slug/domain', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const studioHost = getStudioHost(req);
      const rawDomain = String(req.body?.customDomain || '').trim();
      const customDomain = rawDomain ? normalizeCustomDomain(rawDomain, studioHost) : null;

      const updated = await setDeploymentDomain(slug, customDomain, false);
      const instructions = updated.customDomain
        ? buildDnsInstructions(updated.customDomain, slug, studioHost)
        : null;

      res.json({
        slug: updated.slug,
        customDomain: updated.customDomain ?? null,
        domainVerified: Boolean(updated.domainVerified),
        domainVerifiedAt: updated.domainVerifiedAt ?? null,
        instructions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save custom domain.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/deployments/:slug/verify-domain', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const studioHost = getStudioHost(req);

      let deployment = await getDeploymentBySlug(slug);
      if (!deployment) {
        res.status(404).json({ error: `No deployment found at /sites/${slug}. Publish the site first.` });
        return;
      }

      if (typeof req.body?.customDomain === 'string' && req.body.customDomain.trim()) {
        const nextDomain = normalizeCustomDomain(req.body.customDomain, studioHost);
        if (nextDomain !== deployment.customDomain) {
          deployment = await setDeploymentDomain(slug, nextDomain, false);
        }
      }

      if (!deployment.customDomain) {
        res.status(400).json({ error: 'No custom domain is assigned to this site yet.' });
        return;
      }

      const domain = deployment.customDomain;
      const instructions = buildDnsInstructions(domain, slug, studioHost);

      let resolvedCnames: string[] = [];
      let resolvedIps: string[] = [];
      let resolvedTxt: string[] = [];
      let studioIps: string[] = [];

      try {
        resolvedCnames = (await dns.resolveCname(domain)).map((c) =>
          c.toLowerCase().replace(/\.$/, '')
        );
      } catch {
        // CNAME may not exist for apex or unconfigured domains
      }

      try {
        const [v4, v6] = await Promise.all([
          dns.resolve4(domain).catch(() => [] as string[]),
          dns.resolve6(domain).catch(() => [] as string[]),
        ]);
        resolvedIps = [...v4, ...v6];
      } catch {
        // Ignore resolution failures
      }

      try {
        const [studioV4, studioV6] = await Promise.all([
          dns.resolve4(studioHost).catch(() => [] as string[]),
          dns.resolve6(studioHost).catch(() => [] as string[]),
        ]);
        studioIps = [...studioV4, ...studioV6];
      } catch {
        // Ignore studio host IP lookup failure on localhost
      }

      try {
        const txtRecords = await Promise.all([
          dns.resolveTxt(`_atelier-frame.${domain}`).catch(() => [] as string[][]),
          dns.resolveTxt(domain).catch(() => [] as string[][]),
        ]);
        resolvedTxt = txtRecords
          .flat()
          .map((chunks) => chunks.join('').trim())
          .filter(Boolean);
      } catch {
        // Ignore TXT lookup failures
      }

      const targetLower = studioHost.toLowerCase();
      const cnameMatched = resolvedCnames.some(
        (c) => c === targetLower || c.endsWith(`.${targetLower}`)
      );
      const txtMatched = resolvedTxt.some((t) => t === instructions.txtValue);
      const aRecordMatched =
        studioIps.length > 0 && resolvedIps.some((ip) => studioIps.includes(ip));

      const verified = cnameMatched || txtMatched || aRecordMatched;
      const updated = await markDeploymentDomainVerified(slug, verified);

      res.json({
        slug,
        customDomain: domain,
        verified,
        domainVerifiedAt: updated?.domainVerifiedAt ?? null,
        instructions,
        checks: {
          cnameMatched,
          txtMatched,
          aRecordMatched,
          resolvedCnames,
          resolvedIps,
          resolvedTxt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DNS verification failed.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/deployments/:slug/domain', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const updated = await setDeploymentDomain(slug, null, false);
      res.json({
        ok: true,
        slug: updated.slug,
        customDomain: null,
        domainVerified: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect domain.';
      res.status(400).json({ error: message });
    }
  });

  // Allow CORS on public deployed-site submission & analytics beacon endpoints
  app.use('/api/sites/:slug', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Live Lead Capture for Deployed Client Sites
  app.post('/api/sites/:slug/submit', async (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(`lead:${clientIp}`, 15, 60_000)) {
      res.status(429).json({ error: 'Too many submissions. Please try again shortly.' });
      return;
    }

    try {
      const slug = sanitizeSlug(req.params.slug);
      const name = String(req.body?.name || '').trim().slice(0, 120);
      const email = String(req.body?.email || '').trim().slice(0, 160);
      const message = String(req.body?.message || '').trim().slice(0, 2000);

      if (!name || !email || !message || !email.includes('@')) {
        res.status(400).json({ error: 'Please provide a valid name, email, and message.' });
        return;
      }

      const lead = await createLeadSubmission({
        siteSlug: slug,
        name,
        email,
        message,
      });

      void recordAnalyticsEvent({
        siteSlug: slug,
        eventType: 'form_submit',
        deviceType: detectDeviceFromUa(req.headers['user-agent'] || ''),
        referrer: extractReferrerHost(req.headers.referer),
        targetLabel: 'Contact Form',
      });

      res.status(201).json({ ok: true, id: lead.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to record inquiry.';
      res.status(500).json({ error: message });
    }
  });

  // Public beacon endpoint for CTA click tracking on deployed sites
  app.post('/api/sites/:slug/event', (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(`evt:${clientIp}`, 60, 60_000)) {
      res.status(429).json({ ok: false });
      return;
    }

    const slug = sanitizeSlug(req.params.slug);
    const eventType = req.body?.eventType === 'cta_click' ? 'cta_click' : 'page_view';
    const targetLabel = String(req.body?.targetLabel || '').trim().slice(0, 100);

    void recordAnalyticsEvent({
      siteSlug: slug,
      eventType,
      deviceType: detectDeviceFromUa(req.headers['user-agent'] || ''),
      referrer: extractReferrerHost(req.headers.referer),
      targetLabel,
    });

    res.status(202).json({ ok: true });
  });

  // Website Analytics Aggregation Endpoint
  app.get('/api/analytics', async (req, res) => {
    try {
      const slug = req.query.slug ? String(req.query.slug) : 'all';
      const days = req.query.days ? Number(req.query.days) : 14;
      const analytics = await getAnalyticsData({
        slug: slug === 'all' ? 'all' : sanitizeSlug(slug),
        days,
      });
      res.json(analytics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analytics.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/leads', async (req, res) => {
    try {
      const slug = req.query.slug ? sanitizeSlug(String(req.query.slug)) : undefined;
      const leads = await listLeadSubmissions(slug);
      res.json({ leads });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load leads.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/leads/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').slice(0, 80);
      await deleteLeadSubmission(id);
      res.json({ ok: true, id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete lead.';
      res.status(500).json({ error: message });
    }
  });

  // Digital Marketing Packages, Paid Checkout & AI Campaign Kit
  const MARKETING_PACKAGE_CATALOG: Record<
    string,
    { name: string; serviceFeeUsd: number; billingType: 'one_time' | 'monthly' }
  > = {
    seo_boost: {
      name: 'Search & Local SEO Boost',
      serviceFeeUsd: 149,
      billingType: 'one_time',
    },
    social_launch: {
      name: 'Paid Social Launch',
      serviceFeeUsd: 299,
      billingType: 'monthly',
    },
    full_funnel: {
      name: 'Full-Funnel Growth Retainer',
      serviceFeeUsd: 599,
      billingType: 'monthly',
    },
    ad_booster: {
      name: 'Custom Ad Spend Booster',
      serviceFeeUsd: 49,
      billingType: 'one_time',
    },
  };

  app.get('/api/marketing/config', (_req, res) => {
    res.json({
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    });
  });

  app.get('/api/marketing/orders', async (_req, res) => {
    try {
      const orders = await listMarketingOrders();
      res.json({ orders });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load marketing orders.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/marketing/checkout', async (req, res) => {
    try {
      const body = req.body || {};
      const packageId = String(body.packageId || '');
      const pkg = MARKETING_PACKAGE_CATALOG[packageId];
      if (!pkg) {
        res.status(400).json({ error: 'Invalid marketing package selected.' });
        return;
      }

      const siteSlug = sanitizeSlug(body.siteSlug || 'site');
      const siteName = String(body.siteName || 'Website Campaign').slice(0, 140);
      const clientName = String(body.clientName || 'Internal Studio').slice(0, 120);
      const customerEmail = String(body.customerEmail || '').trim().slice(0, 160);
      if (!customerEmail || !customerEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid billing email address.' });
        return;
      }

      const rawBudget = Number(body.adBudgetUsd || 0);
      const adBudgetUsd = Number.isFinite(rawBudget)
        ? Math.max(0, Math.min(25000, Math.round(rawBudget)))
        : 0;
      if (packageId === 'ad_booster' && adBudgetUsd < 50) {
        res.status(400).json({
          error: 'Custom Ad Spend Booster requires at least $50 in ad spend budget.',
        });
        return;
      }

      const serviceFeeUsd = pkg.serviceFeeUsd;
      const totalUsd = serviceFeeUsd + adBudgetUsd;
      const channels = Array.isArray(body.channels)
        ? body.channels.map((c: unknown) => String(c).slice(0, 50)).slice(0, 8)
        : ['Google Search'];
      const targetAudience = String(body.targetAudience || '').trim().slice(0, 400);
      const campaignGoal = String(body.campaignGoal || 'Leads & Inquiries')
        .trim()
        .slice(0, 100);
      const utmCampaign = sanitizeSlug(
        body.utmCampaign || `${siteSlug}-${packageId}`
      );
      const generatedKit =
        body.generatedKit && typeof body.generatedKit === 'object'
          ? body.generatedKit
          : null;

      const orderId = uid('mkt');
      const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

      if (stripeSecret) {
        const origin =
          process.env.APP_URL?.trim() ||
          `${req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'}`;
        const cleanOrigin = origin.replace(/\/$/, '');

        const form = new URLSearchParams();
        form.set('mode', 'payment');
        form.set('customer_email', customerEmail);
        form.set(
          'success_url',
          `${cleanOrigin}/?marketing_session_id={CHECKOUT_SESSION_ID}`
        );
        form.set('cancel_url', `${cleanOrigin}/?marketing_cancelled=1`);
        form.set('line_items[0][price_data][currency]', 'usd');
        form.set('line_items[0][price_data][unit_amount]', String(serviceFeeUsd * 100));
        form.set(
          'line_items[0][price_data][product_data][name]',
          `${pkg.name} — ${siteName}`
        );
        form.set('line_items[0][quantity]', '1');

        if (adBudgetUsd > 0) {
          form.set('line_items[1][price_data][currency]', 'usd');
          form.set('line_items[1][price_data][unit_amount]', String(adBudgetUsd * 100));
          form.set(
            'line_items[1][price_data][product_data][name]',
            `Ad Spend Budget (${channels.join(', ') || 'Multi-channel'})`
          );
          form.set('line_items[1][quantity]', '1');
        }

        form.set('metadata[orderId]', orderId);
        form.set('metadata[siteSlug]', siteSlug);

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });
        const stripeJson = (await stripeRes.json()) as Record<string, any>;
        if (!stripeRes.ok || !stripeJson.id || !stripeJson.url) {
          throw new Error(
            stripeJson?.error?.message || 'Unable to create Stripe Checkout session.'
          );
        }

        const order = await createMarketingOrder({
          id: orderId,
          siteSlug,
          siteName,
          clientName,
          customerEmail,
          packageId,
          packageName: pkg.name,
          billingType: pkg.billingType,
          adBudgetUsd,
          serviceFeeUsd,
          totalUsd,
          channels,
          targetAudience,
          campaignGoal,
          utmCampaign,
          status: 'pending_payment',
          paymentProvider: 'stripe',
          stripeSessionId: String(stripeJson.id),
          generatedKit,
        });

        res.status(201).json({
          order,
          checkoutUrl: String(stripeJson.url),
          stripeConfigured: true,
        });
        return;
      }

      const order = await createMarketingOrder({
        id: orderId,
        siteSlug,
        siteName,
        clientName,
        customerEmail,
        packageId,
        packageName: pkg.name,
        billingType: pkg.billingType,
        adBudgetUsd,
        serviceFeeUsd,
        totalUsd,
        channels,
        targetAudience,
        campaignGoal,
        utmCampaign,
        status: 'pending_payment',
        paymentProvider: 'invoice',
        stripeSessionId: null,
        generatedKit,
      });

      res.status(201).json({
        order,
        checkoutUrl: null,
        stripeConfigured: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create marketing order.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/marketing/verify-session', async (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId) {
        res.status(400).json({ error: 'Stripe sessionId is required.' });
        return;
      }
      const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
      if (!stripeSecret) {
        res.status(400).json({ error: 'STRIPE_SECRET_KEY is not configured.' });
        return;
      }

      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        {
          headers: { Authorization: `Bearer ${stripeSecret}` },
        }
      );
      const sessionJson = (await stripeRes.json()) as Record<string, any>;
      if (!stripeRes.ok) {
        throw new Error(
          sessionJson?.error?.message || 'Unable to verify Stripe payment session.'
        );
      }

      const existing = await getMarketingOrderByStripeSession(sessionId);
      if (!existing) {
        res.status(404).json({ error: 'Matching campaign order not found.' });
        return;
      }

      const isPaid = sessionJson.payment_status === 'paid';
      const updated = isPaid
        ? await updateMarketingOrder(existing.id, { status: 'paid' })
        : existing;

      res.json({
        paid: isPaid,
        order: updated || existing,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Payment verification failed.';
      res.status(400).json({ error: message });
    }
  });

  app.patch('/api/marketing/orders/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').slice(0, 80);
      const allowedStatuses = new Set([
        'pending_payment',
        'paid',
        'active',
        'paused',
        'completed',
      ]);
      const patch: Record<string, any> = {};
      if (typeof req.body?.status === 'string') {
        if (!allowedStatuses.has(req.body.status)) {
          res.status(400).json({ error: 'Invalid campaign status.' });
          return;
        }
        patch.status = req.body.status;
      }
      if (req.body?.generatedKit && typeof req.body.generatedKit === 'object') {
        patch.generatedKit = req.body.generatedKit;
      }
      const updated = await updateMarketingOrder(id, patch);
      if (!updated) {
        res.status(404).json({ error: 'Campaign order not found.' });
        return;
      }
      res.json({ order: updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update campaign order.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/marketing/orders/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').slice(0, 80);
      await deleteMarketingOrder(id);
      res.json({ ok: true, id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete campaign order.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/marketing/generate-kit', async (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(`mkt:${clientIp}`, 20, 60_000)) {
      res.status(429).json({
        error: 'Rate limit reached. Please wait a minute before generating another ad kit.',
      });
      return;
    }

    try {
      const siteName = String(req.body?.siteName || '').trim();
      const siteDescription = String(req.body?.siteDescription || '').trim();
      const targetAudience = String(req.body?.targetAudience || '').trim();
      const campaignGoal = String(req.body?.campaignGoal || 'Leads & Inquiries').trim();
      const tone = String(req.body?.tone || 'Direct & Authoritative').trim();
      const offer = String(req.body?.offer || '').trim();
      const channels = Array.isArray(req.body?.channels) ? req.body.channels : [];
      const highlights = String(req.body?.highlights || '').trim();

      if (!siteName) {
        res.status(400).json({ error: 'Website name is required to generate a marketing kit.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate a high-converting digital marketing campaign kit for:
Website: ${siteName}
Description: ${siteDescription}
Key Highlights from Page Sections: ${highlights || 'N/A'}
Target Audience: ${targetAudience || 'Decision makers & prospective customers'}
Primary Goal: ${campaignGoal}
Campaign Tone & Angle: ${tone}
Key Offer or Hook: ${offer || 'Book a consultation or explore our offerings'}
Selected Channels: ${channels.join(', ') || 'Google Search, Meta, LinkedIn, Email'}`,
        config: {
          systemInstruction: `You are a senior growth marketing strategist and performance copywriter.
Write specific, grounded, high-converting ad copy tailored directly to the website details and requested tone (${tone}).
Rules:
- Google Search ad headlines must each be concise (under 30 characters). Descriptions under 90 characters.
- Avoid generic hype ("revolutionize", "unlock the future", "game-changer").
- Include concrete value propositions, clear CTAs, and realistic target keywords.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              targetKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              googleSearchAd: {
                type: Type.OBJECT,
                properties: {
                  headlines: { type: Type.ARRAY, items: { type: Type.STRING } },
                  descriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['headlines', 'descriptions'],
              },
              metaSocialAd: {
                type: Type.OBJECT,
                properties: {
                  primaryText: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  callToAction: { type: Type.STRING },
                },
                required: ['primaryText', 'headline', 'callToAction'],
              },
              linkedinPost: {
                type: Type.OBJECT,
                properties: {
                  hook: { type: Type.STRING },
                  body: { type: Type.STRING },
                  cta: { type: Type.STRING },
                },
                required: ['hook', 'body', 'cta'],
              },
              emailBroadcast: {
                type: Type.OBJECT,
                properties: {
                  subject: { type: Type.STRING },
                  previewText: { type: Type.STRING },
                  body: { type: Type.STRING },
                },
                required: ['subject', 'previewText', 'body'],
              },
              launchChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'summary',
              'targetKeywords',
              'googleSearchAd',
              'metaSocialAd',
              'linkedinPost',
              'emailBroadcast',
              'launchChecklist',
            ],
          },
        },
      });

      const kit = JSON.parse((response.text || '{}').trim());
      res.json({ kit });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate marketing kit.';
      console.error('Generate marketing kit error:', error);
      res.status(500).json({ error: message });
    }
  });

  // Live hosted route for deployed websites
  app.get('/sites/:slug', async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const record = await getDeploymentBySlug(slug);
      if (!record) {
        res.status(404).type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Site Not Found</title>
<style>body{font-family:system-ui,sans-serif;font-size:18px;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f7f8;color:#000000;text-align:center;padding:24px}a{color:#1d4ed8;font-weight:600;text-decoration:none}</style></head>
<body><div><h1>No deployment at /sites/${slug}</h1><p>This site may have been unpublished or moved.</p><p><a href="/">Return to Atelier Frame Builder</a></p></div></body>
</html>`);
        return;
      }

      void recordAnalyticsEvent({
        siteSlug: slug,
        eventType: 'page_view',
        deviceType: detectDeviceFromUa(req.headers['user-agent'] || ''),
        referrer: extractAttribution(req),
        targetLabel: '/',
      });

      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(record.html);
    } catch (error) {
      res.status(500).type('text').send('Unable to load deployed site.');
    }
  });

  // Custom Domain Hostname Routing Middleware (serves connected client sites at "/")
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const reqPath = req.path || '/';
    if (
      reqPath.startsWith('/api/') ||
      reqPath.startsWith('/sites/') ||
      reqPath.startsWith('/src/') ||
      reqPath.startsWith('/assets/') ||
      reqPath.startsWith('/@') ||
      reqPath.startsWith('/node_modules/')
    ) {
      next();
      return;
    }

    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const incomingHost = String(Array.isArray(rawHost) ? rawHost[0] : rawHost)
      .split(',')[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');

    const studioHost = getStudioHost(req);
    if (
      !incomingHost ||
      incomingHost === 'localhost' ||
      incomingHost === '127.0.0.1' ||
      incomingHost === studioHost
    ) {
      next();
      return;
    }

    try {
      const site = await getDeploymentByDomain(incomingHost);
      if (!site) {
        next();
        return;
      }

      void recordAnalyticsEvent({
        siteSlug: site.slug,
        eventType: 'page_view',
        deviceType: detectDeviceFromUa(req.headers['user-agent'] || ''),
        referrer: extractAttribution(req),
        targetLabel: reqPath,
      });

      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(site.html);
    } catch {
      next();
    }
  });

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Frame server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
