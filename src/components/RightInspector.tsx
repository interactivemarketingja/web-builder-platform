import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Globe,
  GripVertical,
  Layers,
  Link2,
  Megaphone,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { STUDIO_IMAGES } from '../data/presets';
import {
  BackgroundVariant,
  PaddingSize,
  SiteBlock,
  SiteProject,
  SiteSeo,
} from '../types/builder';

export type RightInspectorTab = 'inspector' | 'seo';

interface RightInspectorProps {
  project: SiteProject;
  blocks: SiteBlock[];
  selectedBlock: SiteBlock | null;
  isRefining: boolean;
  refineError: string | null;
  onSelectBlock: (id: string | null) => void;
  onMoveBlock: (index: number, direction: -1 | 1) => void;
  onUpdateBlock: (updated: SiteBlock) => void;
  onRefineBlock: (block: SiteBlock, instruction: string) => Promise<void>;
  onDeleteBlock: (id: string) => void;
  onUpdateSeo: (patch: Partial<SiteSeo>) => void;
  onOpenMarketing?: () => void;
}

function TextInput({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-black mb-1">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        />
      )}
    </div>
  );
}

function ImageAssetPicker({
  value,
  alt,
  onChangeUrl,
  onChangeAlt,
}: {
  value: string;
  alt: string;
  onChangeUrl: (url: string) => void;
  onChangeAlt: (alt: string) => void;
}) {
  return (
    <div className="space-y-2.5 pt-2 border-t border-slate-200">
      <div className="text-[13px] font-semibold text-black">
        Media Asset
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STUDIO_IMAGES.map((asset) => {
          const active = value === asset.url;
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                onChangeUrl(asset.url);
                if (!alt) onChangeAlt(asset.alt);
              }}
              className={`text-left rounded-lg overflow-hidden border transition-all cursor-pointer ${
                active
                  ? 'border-blue-600 ring-2 ring-blue-600/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <img
                src={asset.url}
                alt={asset.alt}
                referrerPolicy="no-referrer"
                className="w-full h-14 object-cover"
              />
              <div className="px-2 py-1 text-xs font-medium text-black truncate bg-white">
                {asset.label}
              </div>
            </button>
          );
        })}
      </div>
      <TextInput label="Custom Image URL" value={value} onChange={onChangeUrl} />
      <TextInput label="Alt Description" value={alt} onChange={onChangeAlt} />
    </div>
  );
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English (en)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'fr', label: 'French (fr)' },
  { code: 'de', label: 'German (de)' },
  { code: 'pt', label: 'Portuguese (pt)' },
  { code: 'it', label: 'Italian (it)' },
  { code: 'nl', label: 'Dutch (nl)' },
  { code: 'ja', label: 'Japanese (ja)' },
];

function normalizeCanonicalPreview(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  project,
  blocks,
  selectedBlock,
  isRefining,
  refineError,
  onSelectBlock,
  onMoveBlock,
  onUpdateBlock,
  onRefineBlock,
  onDeleteBlock,
  onUpdateSeo,
  onOpenMarketing,
}) => {
  const [activeTab, setActiveTab] = useState<RightInspectorTab>('inspector');
  const [refinePrompt, setRefinePrompt] = useState('');

  const seoTitleValue = project.seo?.title ?? '';
  const seoDescValue = project.seo?.description ?? '';
  const seoCanonicalValue = project.seo?.canonicalUrl ?? '';
  const seoLangValue = project.seo?.language || 'en';

  const resolvedTitle = seoTitleValue.trim() || project.name || 'Untitled Site';
  const resolvedDesc =
    seoDescValue.trim() ||
    project.description ||
    'Add a concise meta description to improve search click-through rates.';
  const fallbackDomainCanonical = project.seo?.customDomain?.trim()
    ? normalizeCanonicalPreview(project.seo.customDomain)
    : '';
  const resolvedCanonical =
    normalizeCanonicalPreview(seoCanonicalValue) || fallbackDomainCanonical;
  const serpDisplayUrl =
    resolvedCanonical ||
    (project.lastDeployedUrl ? project.lastDeployedUrl : `https://atelierframe.app/sites/${project.slug || 'site'}`);

  const hasHeroHeading = blocks.some(
    (b) => b.type === 'hero' && b.props.headline.trim().length > 0
  );
  const titleLength = resolvedTitle.length;
  const descLength = resolvedDesc.length;
  const canonicalIsValid =
    !seoCanonicalValue.trim() ||
    /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalizeCanonicalPreview(seoCanonicalValue));

  const tabSwitcher = (
    <div className="p-2.5 border-b border-[#DAD4C6] bg-[#F8F6F1] shrink-0">
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAE6DC] rounded-lg border border-[#DAD4C6]/70">
        <button
          type="button"
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'inspector'
              ? 'bg-white text-black shadow-xs border border-[#DAD4C6]/60'
              : 'text-black hover:bg-white/60'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#1D4ED8]" />
          <span>{selectedBlock ? 'Section' : 'Outline'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seo')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'seo'
              ? 'bg-white text-black shadow-xs border border-[#DAD4C6]/60'
              : 'text-black hover:bg-white/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-[#1D4ED8]" />
          <span>SEO</span>
        </button>
      </div>
    </div>
  );

  if (activeTab === 'seo') {
    const connectedDomainSuggestion = project.seo?.customDomain?.trim()
      ? normalizeCanonicalPreview(project.seo.customDomain)
      : '';
    const deployedUrlSuggestion = project.lastDeployedUrl
      ? `${window.location.origin}${project.lastDeployedUrl.startsWith('/') ? '' : '/'}${project.lastDeployedUrl}`
      : '';

    return (
      <aside className="w-[336px] shrink-0 bg-white border-l border-[#DAD4C6] flex flex-col h-full overflow-hidden">
        {tabSwitcher}

        <div className="px-4 py-3 border-b border-[#DAD4C6] bg-[#FAF9F5] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            <h2 className="text-sm font-semibold text-black truncate">
              Site-Wide SEO Tags
            </h2>
          </div>
          <span className="text-xs font-mono font-semibold text-black bg-[#EAE6DC] px-2 py-0.5 rounded">
            &lt;head&gt;
          </span>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
          {/* Live Search Engine Snippet Preview */}
          <div className="p-3.5 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] space-y-1.5">
            <div className="text-xs font-semibold text-black">
              Search Snippet Preview
            </div>
            <div className="text-xs text-black truncate font-mono">
              {serpDisplayUrl}
            </div>
            <div className="text-[15px] font-semibold text-[#1D4ED8] leading-snug line-clamp-2">
              {resolvedTitle}
            </div>
            <p className="text-[13px] text-black leading-relaxed line-clamp-3">
              {resolvedDesc}
            </p>
          </div>

          {/* Site-Wide Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="seo-title-input"
                className="text-[13px] font-semibold text-black"
              >
                Site Title (&lt;title&gt;)
              </label>
              <span className="text-xs font-mono tabular-nums text-black">
                {titleLength}/60
              </span>
            </div>
            <input
              id="seo-title-input"
              type="text"
              value={seoTitleValue}
              onChange={(e) => onUpdateSeo({ title: e.target.value })}
              placeholder={project.name}
              className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
            <p className="text-xs text-black leading-relaxed">
              Populates both <span className="font-mono">&lt;title&gt;</span> and{' '}
              <span className="font-mono">og:title</span>. Aim for 30–60 characters.
            </p>
          </div>

          {/* Meta Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="seo-description-input"
                className="text-[13px] font-semibold text-black"
              >
                Meta Description
              </label>
              <span className="text-xs font-mono tabular-nums text-black">
                {descLength}/160
              </span>
            </div>
            <textarea
              id="seo-description-input"
              rows={3}
              value={seoDescValue}
              onChange={(e) => onUpdateSeo({ description: e.target.value })}
              placeholder={project.description || 'Describe this site for search engines...'}
              className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm text-black placeholder:text-black/60 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] resize-y"
            />
            <p className="text-xs text-black leading-relaxed">
              Populates <span className="font-mono">meta[name="description"]</span> and{' '}
              <span className="font-mono">og:description</span>. Aim for 70–160 characters.
            </p>
          </div>

          {/* Canonical URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="seo-canonical-input"
                className="text-[13px] font-semibold text-black"
              >
                Canonical URL
              </label>
              {seoCanonicalValue.trim() && (
                <button
                  type="button"
                  onClick={() => onUpdateSeo({ canonicalUrl: '' })}
                  className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <Link2 className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="seo-canonical-input"
                type="url"
                value={seoCanonicalValue}
                onChange={(e) => onUpdateSeo({ canonicalUrl: e.target.value })}
                placeholder={fallbackDomainCanonical || 'https://yourdomain.com/'}
                className="w-full rounded-lg border border-[#DAD4C6] bg-white pl-8 pr-2.5 py-2 text-sm font-mono text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
            {!canonicalIsValid && (
              <p className="text-xs font-medium text-red-700">
                Enter a valid absolute URL (e.g. https://yourdomain.com/).
              </p>
            )}
            <p className="text-xs text-black leading-relaxed">
              Sets <span className="font-mono">&lt;link rel="canonical"&gt;</span> and{' '}
              <span className="font-mono">og:url</span> to prevent duplicate-content indexing.
            </p>
            {(connectedDomainSuggestion || deployedUrlSuggestion) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {connectedDomainSuggestion &&
                  seoCanonicalValue.trim() !== connectedDomainSuggestion && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSeo({ canonicalUrl: connectedDomainSuggestion })
                      }
                      className="text-xs font-medium text-black px-2 py-1 rounded border border-[#DAD4C6] bg-[#FAF9F5] hover:border-[#1D4ED8] hover:bg-white cursor-pointer"
                    >
                      Use connected domain
                    </button>
                  )}
                {deployedUrlSuggestion &&
                  seoCanonicalValue.trim() !== deployedUrlSuggestion && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSeo({ canonicalUrl: deployedUrlSuggestion })
                      }
                      className="text-xs font-medium text-black px-2 py-1 rounded border border-[#DAD4C6] bg-[#FAF9F5] hover:border-[#1D4ED8] hover:bg-white cursor-pointer"
                    >
                      Use live deploy URL
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* Document Language */}
          <div className="space-y-1.5">
            <label
              htmlFor="seo-language-select"
              className="block text-[13px] font-semibold text-black"
            >
              Document Language (&lt;html lang&gt;)
            </label>
            <select
              id="seo-language-select"
              value={seoLangValue}
              onChange={(e) => onUpdateSeo({ language: e.target.value })}
              className="w-full rounded-lg border border-[#DAD4C6] bg-white px-2.5 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Discoverability Checklist */}
          <div className="p-3.5 rounded-lg border border-[#DAD4C6] bg-white space-y-2.5">
            <div className="text-[13px] font-semibold text-black">
              Discoverability Checklist
            </div>
            <div className="space-y-2 text-xs text-black">
              <div className="flex items-start gap-2">
                {titleLength >= 10 && titleLength <= 65 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                )}
                <span>
                  Title tag length ({titleLength} chars — ideal 30–60)
                </span>
              </div>
              <div className="flex items-start gap-2">
                {descLength >= 50 && descLength <= 165 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                )}
                <span>
                  Meta description ({descLength} chars — ideal 70–160)
                </span>
              </div>
              <div className="flex items-start gap-2">
                {resolvedCanonical && canonicalIsValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                )}
                <span>
                  {resolvedCanonical
                    ? 'Canonical URL tag emitted in <head>'
                    : 'Add a canonical URL for primary domain indexing'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                {hasHeroHeading ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                )}
                <span>
                  {hasHeroHeading
                    ? 'Primary <h1> hero heading present'
                    : 'Add a Hero section for a semantic <h1> heading'}
                </span>
              </div>
            </div>
          </div>

          {/* Generated Head Tags Preview */}
          <div className="space-y-1.5">
            <div className="text-[13px] font-semibold text-black">
              Compiled &lt;head&gt; Tags
            </div>
            <pre className="p-3 rounded-lg bg-[#13151A] text-white text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
              {`<html lang="${seoLangValue}">
<title>${resolvedTitle}</title>
<meta name="description" content="${resolvedDesc}" />${
                resolvedCanonical
                  ? `\n<link rel="canonical" href="${resolvedCanonical}" />`
                  : ''
              }`}
            </pre>
          </div>

          {onOpenMarketing && (
            <button
              type="button"
              onClick={onOpenMarketing}
              className="w-full py-2.5 px-3 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] hover:bg-white hover:border-[#1D4ED8] text-xs font-semibold text-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Megaphone className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Configure Pixels, Promo Bar &amp; Paid Ads</span>
            </button>
          )}
        </div>
      </aside>
    );
  }

  if (!selectedBlock) {
    return (
      <aside className="w-[336px] shrink-0 bg-white border-l border-[#DAD4C6] flex flex-col h-full overflow-hidden">
        {tabSwitcher}
        <div className="px-4 py-3.5 border-b border-[#DAD4C6] bg-[#F8F6F1] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#1D4ED8]" />
          <h2 className="text-sm font-semibold text-black">Page Sections</h2>
          <span className="ml-auto text-sm font-semibold text-black tabular-nums">
            {blocks.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-1.5">
          {blocks.length === 0 ? (
            <div className="p-4 text-center text-sm text-black leading-relaxed">
              No sections yet. Drag an element from the left rail or generate a template with AI.
            </div>
          ) : (
            blocks.map((blk, i) => (
              <div
                key={blk.id}
                className="group w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#DAD4C6] bg-white hover:border-[#1D4ED8] hover:bg-[#FAF9F5] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectBlock(blk.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                >
                  <GripVertical className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="text-[13px] font-mono text-black tabular-nums w-4 shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-black truncate flex-1">
                    {blk.label}
                  </span>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => onMoveBlock(i, -1)}
                    title="Move section up"
                    className="p-1 rounded text-black hover:bg-[#EAE6DC] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={i === blocks.length - 1}
                    onClick={() => onMoveBlock(i, 1)}
                    title="Move section down"
                    className="p-1 rounded text-black hover:bg-[#EAE6DC] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t border-[#DAD4C6] bg-[#F8F6F1] text-sm text-black leading-relaxed">
          Click any section on the canvas or in this outline to edit its copy, surface tone, and layout.
        </div>
      </aside>
    );
  }

  const selectedIndex = blocks.findIndex((b) => b.id === selectedBlock.id);

  const updateProps = (patch: Record<string, any>) => {
    onUpdateBlock({
      ...selectedBlock,
      props: {
        ...selectedBlock.props,
        ...patch,
      },
    } as SiteBlock);
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinePrompt.trim() || isRefining) return;
    await onRefineBlock(selectedBlock, refinePrompt.trim());
    setRefinePrompt('');
  };

  return (
    <aside className="w-[336px] shrink-0 bg-white border-l border-[#DAD4C6] flex flex-col h-full overflow-hidden">
      {tabSwitcher}
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#DAD4C6] bg-[#F8F6F1] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-black truncate">
            {selectedBlock.label}
          </div>
          <div className="text-[13px] text-black capitalize tabular-nums">
            Section {selectedIndex + 1} of {blocks.length} · {selectedBlock.type}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => selectedIndex > 0 && onSelectBlock(blocks[selectedIndex - 1].id)}
            title="Previous section"
            className="p-1 rounded text-black hover:bg-[#EAE6DC] disabled:opacity-30 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedIndex >= blocks.length - 1}
            onClick={() =>
              selectedIndex < blocks.length - 1 &&
              onSelectBlock(blocks[selectedIndex + 1].id)
            }
            title="Next section"
            className="p-1 rounded text-black hover:bg-[#EAE6DC] disabled:opacity-30 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSelectBlock(null)}
            className="text-[13px] font-medium text-black px-2 py-1 rounded hover:bg-[#EAE6DC] cursor-pointer"
          >
            Outline
          </button>
          <button
            type="button"
            onClick={() => onDeleteBlock(selectedBlock.id)}
            title="Delete block"
            className="p-1.5 rounded text-black hover:text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
        {/* AI Refine Selected Block */}
        <form
          onSubmit={handleRefineSubmit}
          className="p-3 rounded-lg border border-[#DAD4C6] bg-[#FAF9F5] space-y-2"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-black">
            <Sparkles className="w-4 h-4 text-[#1D4ED8]" />
            <span>AI Section Rewrite</span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="e.g. Make copy punchier for enterprise"
              className="flex-1 min-w-0 rounded-md border border-[#DAD4C6] bg-white px-2.5 py-1.5 text-sm text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
            <button
              type="submit"
              disabled={isRefining || !refinePrompt.trim()}
              className="px-3 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#163B9E] disabled:bg-blue-400 text-white text-sm font-semibold shrink-0 cursor-pointer"
            >
              {isRefining ? '...' : 'Apply'}
            </button>
          </div>
          {refineError && (
            <p className="text-[13px] text-red-600">{refineError}</p>
          )}
        </form>

        {/* Surface & Padding */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-black">
            Surface &amp; Spacing
          </div>
          <div>
            <div className="text-[13px] text-black mb-1">Background Band</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#EAE6DC] rounded-lg">
              {(['canvas', 'surface', 'contrast'] as BackgroundVariant[]).map(
                (v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      onUpdateBlock({ ...selectedBlock, backgroundVariant: v })
                    }
                    className={`py-1.5 text-[13px] font-medium capitalize rounded-md cursor-pointer ${
                      selectedBlock.backgroundVariant === v
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black'
                    }`}
                  >
                    {v}
                  </button>
                )
              )}
            </div>
          </div>

          {selectedBlock.type !== 'navbar' && (
            <div>
              <div className="text-[13px] text-black mb-1">
                Vertical Padding
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#EAE6DC] rounded-lg">
                {(['compact', 'normal', 'spacious'] as PaddingSize[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      onUpdateBlock({ ...selectedBlock, paddingY: p })
                    }
                    className={`py-1.5 text-[13px] font-medium capitalize rounded-md cursor-pointer ${
                      selectedBlock.paddingY === p
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Block-Specific Fields */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <div className="text-sm font-semibold text-black">Content</div>

          {selectedBlock.type === 'navbar' && (
            <>
              <TextInput
                label="Brand Wordmark"
                value={selectedBlock.props.brandName}
                onChange={(v) => updateProps({ brandName: v })}
              />
              <TextInput
                label="Primary CTA Label"
                value={selectedBlock.props.ctaLabel}
                onChange={(v) => updateProps({ ctaLabel: v })}
              />
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-black">
                    Navigation Links
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateProps({
                        links: [
                          ...selectedBlock.props.links,
                          { label: 'New Link', href: '#section' },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 text-[13px] text-blue-600 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {selectedBlock.props.links.map((link, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const next = [...selectedBlock.props.links];
                        next[idx] = { ...link, label: e.target.value };
                        updateProps({ links: next });
                      }}
                      className="flex-1 min-w-0 rounded border border-slate-200 px-2 py-1 text-sm text-black"
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={(e) => {
                        const next = [...selectedBlock.props.links];
                        next[idx] = { ...link, href: e.target.value };
                        updateProps({ links: next });
                      }}
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm text-black font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = selectedBlock.props.links.filter(
                          (_, i) => i !== idx
                        );
                        updateProps({ links: next });
                      }}
                      className="text-black hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedBlock.type === 'hero' && (
            <>
              <div>
                <div className="text-[13px] text-black mb-1">Layout</div>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['split', 'centered', 'banner'] as const).map((lay) => (
                    <button
                      key={lay}
                      type="button"
                      onClick={() => updateProps({ layout: lay })}
                      className={`py-1.5 text-[13px] font-medium capitalize rounded-md cursor-pointer ${
                        selectedBlock.props.layout === lay
                          ? 'bg-white text-black shadow-xs'
                          : 'text-black'
                      }`}
                    >
                      {lay}
                    </button>
                  ))}
                </div>
              </div>
              <TextInput
                label="Kicker"
                value={selectedBlock.props.kicker}
                onChange={(v) => updateProps({ kicker: v })}
              />
              <TextInput
                label="Headline"
                value={selectedBlock.props.headline}
                onChange={(v) => updateProps({ headline: v })}
                multiline
              />
              <TextInput
                label="Subtitle"
                value={selectedBlock.props.subtitle}
                onChange={(v) => updateProps({ subtitle: v })}
                multiline
              />
              <TextInput
                label="Primary Button"
                value={selectedBlock.props.primaryCtaLabel}
                onChange={(v) => updateProps({ primaryCtaLabel: v })}
              />
              <TextInput
                label="Secondary Button"
                value={selectedBlock.props.secondaryCtaLabel}
                onChange={(v) => updateProps({ secondaryCtaLabel: v })}
              />
              <ImageAssetPicker
                value={selectedBlock.props.imageUrl}
                alt={selectedBlock.props.imageAlt}
                onChangeUrl={(url) => updateProps({ imageUrl: url })}
                onChangeAlt={(alt) => updateProps({ imageAlt: alt })}
              />
            </>
          )}

          {selectedBlock.type === 'stats' && (
            <>
              <TextInput
                label="Section Label"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
              />
              <div className="space-y-3 pt-2">
                {selectedBlock.props.items.map((stat, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-black">
                        Metric {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateProps({
                            items: selectedBlock.props.items.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="text-black hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <TextInput
                      label="Value"
                      value={stat.value}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...stat, value: v };
                        updateProps({ items: next });
                      }}
                    />
                    <TextInput
                      label="Label"
                      value={stat.label}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...stat, label: v };
                        updateProps({ items: next });
                      }}
                    />
                    <TextInput
                      label="Context"
                      value={stat.context}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...stat, context: v };
                        updateProps({ items: next });
                      }}
                    />
                  </div>
                ))}
                {selectedBlock.props.items.length < 4 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateProps({
                        items: [
                          ...selectedBlock.props.items,
                          { value: '100%', label: 'New Metric', context: 'Verified outcome' },
                        ],
                      })
                    }
                    className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-black hover:bg-slate-50 cursor-pointer"
                  >
                    + Add Metric
                  </button>
                )}
              </div>
            </>
          )}

          {selectedBlock.type === 'features' && (
            <>
              <div>
                <div className="text-[13px] text-black mb-1">Columns</div>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  {([2, 3] as const).map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      onClick={() => updateProps({ columns: cols })}
                      className={`py-1.5 text-[13px] font-medium rounded-md cursor-pointer ${
                        selectedBlock.props.columns === cols
                          ? 'bg-white text-black shadow-xs'
                          : 'text-black'
                      }`}
                    >
                      {cols} Columns
                    </button>
                  ))}
                </div>
              </div>
              <TextInput
                label="Eyebrow"
                value={selectedBlock.props.eyebrow}
                onChange={(v) => updateProps({ eyebrow: v })}
              />
              <TextInput
                label="Heading"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
                multiline
              />
              <TextInput
                label="Intro"
                value={selectedBlock.props.intro}
                onChange={(v) => updateProps({ intro: v })}
                multiline
              />
              <div className="space-y-3 pt-2">
                {selectedBlock.props.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-black">
                        Card {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateProps({
                            items: selectedBlock.props.items.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="text-black hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <TextInput
                      label="Meta"
                      value={item.meta || ''}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...item, meta: v };
                        updateProps({ items: next });
                      }}
                    />
                    <TextInput
                      label="Title"
                      value={item.title}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...item, title: v };
                        updateProps({ items: next });
                      }}
                    />
                    <TextInput
                      label="Description"
                      value={item.description}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...item, description: v };
                        updateProps({ items: next });
                      }}
                      multiline
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateProps({
                      items: [
                        ...selectedBlock.props.items,
                        {
                          title: 'New Capability',
                          description: 'Describe the specific engineering or service outcome.',
                          meta: 'Phase',
                        },
                      ],
                    })
                  }
                  className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-black hover:bg-slate-50 cursor-pointer"
                >
                  + Add Feature Card
                </button>
              </div>
            </>
          )}

          {selectedBlock.type === 'showcase' && (
            <>
              <div>
                <div className="text-[13px] text-black mb-1">
                  Image Position
                </div>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['left', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateProps({ imagePosition: pos })}
                      className={`py-1.5 text-[13px] font-medium capitalize rounded-md cursor-pointer ${
                        selectedBlock.props.imagePosition === pos
                          ? 'bg-white text-black shadow-xs'
                          : 'text-black'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <TextInput
                label="Eyebrow"
                value={selectedBlock.props.eyebrow}
                onChange={(v) => updateProps({ eyebrow: v })}
              />
              <TextInput
                label="Heading"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
              />
              <TextInput
                label="Narrative Body"
                value={selectedBlock.props.body}
                onChange={(v) => updateProps({ body: v })}
                multiline
              />
              <TextInput
                label="Bullet Points (one per line)"
                value={selectedBlock.props.bullets.join('\n')}
                onChange={(v) =>
                  updateProps({
                    bullets: v
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                multiline
              />
              <TextInput
                label="Button Label"
                value={selectedBlock.props.ctaLabel}
                onChange={(v) => updateProps({ ctaLabel: v })}
              />
              <ImageAssetPicker
                value={selectedBlock.props.imageUrl}
                alt={selectedBlock.props.imageAlt}
                onChangeUrl={(url) => updateProps({ imageUrl: url })}
                onChangeAlt={(alt) => updateProps({ imageAlt: alt })}
              />
            </>
          )}

          {selectedBlock.type === 'pricing' && (
            <>
              <TextInput
                label="Eyebrow"
                value={selectedBlock.props.eyebrow}
                onChange={(v) => updateProps({ eyebrow: v })}
              />
              <TextInput
                label="Heading"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
              />
              <TextInput
                label="Intro"
                value={selectedBlock.props.intro}
                onChange={(v) => updateProps({ intro: v })}
                multiline
              />
              <div className="space-y-3 pt-2">
                {selectedBlock.props.tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-black">
                        Tier {idx + 1}
                      </span>
                      <label className="flex items-center gap-1.5 text-[13px] text-black cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.highlighted}
                          onChange={(e) => {
                            const next = [...selectedBlock.props.tiers];
                            next[idx] = { ...tier, highlighted: e.target.checked };
                            updateProps({ tiers: next });
                          }}
                        />
                        Featured
                      </label>
                    </div>
                    <TextInput
                      label="Tier Name"
                      value={tier.name}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.tiers];
                        next[idx] = { ...tier, name: v };
                        updateProps({ tiers: next });
                      }}
                    />
                    <TextInput
                      label="Target Audience"
                      value={tier.audience}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.tiers];
                        next[idx] = { ...tier, audience: v };
                        updateProps({ tiers: next });
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <TextInput
                        label="Price"
                        value={tier.price}
                        onChange={(v) => {
                          const next = [...selectedBlock.props.tiers];
                          next[idx] = { ...tier, price: v };
                          updateProps({ tiers: next });
                        }}
                      />
                      <TextInput
                        label="Cadence"
                        value={tier.cadence}
                        onChange={(v) => {
                          const next = [...selectedBlock.props.tiers];
                          next[idx] = { ...tier, cadence: v };
                          updateProps({ tiers: next });
                        }}
                      />
                    </div>
                    <TextInput
                      label="Features (one per line)"
                      value={tier.features.join('\n')}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.tiers];
                        next[idx] = {
                          ...tier,
                          features: v.split('\n').filter((x) => x.trim().length > 0),
                        };
                        updateProps({ tiers: next });
                      }}
                      multiline
                    />
                    <TextInput
                      label="CTA Label"
                      value={tier.ctaLabel}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.tiers];
                        next[idx] = { ...tier, ctaLabel: v };
                        updateProps({ tiers: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedBlock.type === 'testimonial' && (
            <>
              <TextInput
                label="Quote"
                value={selectedBlock.props.quote}
                onChange={(v) => updateProps({ quote: v })}
                multiline
              />
              <TextInput
                label="Author Name"
                value={selectedBlock.props.authorName}
                onChange={(v) => updateProps({ authorName: v })}
              />
              <TextInput
                label="Author Role"
                value={selectedBlock.props.authorRole}
                onChange={(v) => updateProps({ authorRole: v })}
              />
              <TextInput
                label="Company"
                value={selectedBlock.props.company}
                onChange={(v) => updateProps({ company: v })}
              />
              <TextInput
                label="Measured Outcome"
                value={selectedBlock.props.outcome}
                onChange={(v) => updateProps({ outcome: v })}
              />
            </>
          )}

          {selectedBlock.type === 'faq' && (
            <>
              <TextInput
                label="Eyebrow"
                value={selectedBlock.props.eyebrow}
                onChange={(v) => updateProps({ eyebrow: v })}
              />
              <TextInput
                label="Heading"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
              />
              <div className="space-y-3 pt-2">
                {selectedBlock.props.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-black">
                        Question {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateProps({
                            items: selectedBlock.props.items.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="text-black hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <TextInput
                      label="Question"
                      value={item.question}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...item, question: v };
                        updateProps({ items: next });
                      }}
                    />
                    <TextInput
                      label="Answer"
                      value={item.answer}
                      onChange={(v) => {
                        const next = [...selectedBlock.props.items];
                        next[idx] = { ...item, answer: v };
                        updateProps({ items: next });
                      }}
                      multiline
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateProps({
                      items: [
                        ...selectedBlock.props.items,
                        {
                          question: 'New Question',
                          answer: 'Clear, direct answer for prospective visitors.',
                        },
                      ],
                    })
                  }
                  className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-black hover:bg-slate-50 cursor-pointer"
                >
                  + Add FAQ Row
                </button>
              </div>
            </>
          )}

          {selectedBlock.type === 'cta' && (
            <>
              <TextInput
                label="Headline"
                value={selectedBlock.props.headline}
                onChange={(v) => updateProps({ headline: v })}
                multiline
              />
              <TextInput
                label="Description"
                value={selectedBlock.props.description}
                onChange={(v) => updateProps({ description: v })}
                multiline
              />
              <TextInput
                label="Primary Button"
                value={selectedBlock.props.primaryCtaLabel}
                onChange={(v) => updateProps({ primaryCtaLabel: v })}
              />
              <TextInput
                label="Secondary Button"
                value={selectedBlock.props.secondaryCtaLabel}
                onChange={(v) => updateProps({ secondaryCtaLabel: v })}
              />
            </>
          )}

          {selectedBlock.type === 'contact' && (
            <>
              <TextInput
                label="Eyebrow"
                value={selectedBlock.props.eyebrow}
                onChange={(v) => updateProps({ eyebrow: v })}
              />
              <TextInput
                label="Heading"
                value={selectedBlock.props.heading}
                onChange={(v) => updateProps({ heading: v })}
              />
              <TextInput
                label="Description"
                value={selectedBlock.props.description}
                onChange={(v) => updateProps({ description: v })}
                multiline
              />
              <TextInput
                label="Contact Email"
                value={selectedBlock.props.email}
                onChange={(v) => updateProps({ email: v })}
              />
              <TextInput
                label="Office Location"
                value={selectedBlock.props.location}
                onChange={(v) => updateProps({ location: v })}
              />
              <TextInput
                label="Submit Button Label"
                value={selectedBlock.props.submitLabel}
                onChange={(v) => updateProps({ submitLabel: v })}
              />
            </>
          )}

          {selectedBlock.type === 'footer' && (
            <>
              <TextInput
                label="Brand Name"
                value={selectedBlock.props.brandName}
                onChange={(v) => updateProps({ brandName: v })}
              />
              <TextInput
                label="Summary"
                value={selectedBlock.props.summary}
                onChange={(v) => updateProps({ summary: v })}
                multiline
              />
              <TextInput
                label="Copyright"
                value={selectedBlock.props.copyright}
                onChange={(v) => updateProps({ copyright: v })}
              />
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
