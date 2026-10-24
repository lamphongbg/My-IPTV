import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  FileCode,
  Layers,
  Sparkles,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  Terminal,
  Activity,
  ArrowRight,
} from 'lucide-react';
import type { Channel } from '../types/iptv';
import type { SubtitleDiagnosticReport } from '../services/subtitleDiagnostic';

interface SubtitleDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel?: Channel | null;
  initialStreamUrl?: string;
  onApplyTracksToChannel?: (tracks: any[]) => void;
}

export const SubtitleDiagnosticModal: React.FC<SubtitleDiagnosticModalProps> = ({
  isOpen,
  onClose,
  channel,
  initialStreamUrl,
  onApplyTracksToChannel,
}) => {
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [report, setReport] = useState<SubtitleDiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tracks' | 'variants' | 'manifest' | 'advice'>('tracks');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync stream URL when modal opens or channel changes
  useEffect(() => {
    if (isOpen) {
      const targetUrl = initialStreamUrl || channel?.stream_url || '';
      setStreamUrl(targetUrl);
      if (targetUrl) {
        handleRunDiagnostic(targetUrl);
      }
    } else {
      setReport(null);
      setError(null);
      setCurrentStep(0);
      setSaveSuccess(false);
    }
  }, [isOpen, channel, initialStreamUrl]);

  const handleRunDiagnostic = useCallback(async (urlToScan?: string) => {
    const target = (urlToScan || streamUrl).trim();
    if (!target) return;

    setLoading(true);
    setError(null);
    setCurrentStep(1);
    setSaveSuccess(false);

    try {
      // Step simulation for visual feedback
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 250);
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 600);
      const stepTimer3 = setTimeout(() => setCurrentStep(4), 1000);

      const res = await fetch('/api/channels/diagnose-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamUrl: target,
          channelId: channel?.id,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setCurrentStep(5);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Lỗi máy chủ chẩn đoán (HTTP ${res.status})`);
      }

      const data: SubtitleDiagnosticReport = await res.json();
      setReport(data);

      if (data.subtitleTracks && data.subtitleTracks.length > 0) {
        setActiveTab('tracks');
      } else if (data.closedCaptionsTracks && data.closedCaptionsTracks.length > 0) {
        setActiveTab('tracks');
      } else {
        setActiveTab('advice');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể thực hiện chẩn đoán luồng phát');
    } finally {
      setLoading(false);
    }
  }, [streamUrl, channel]);

  const handleCopyReport = () => {
    if (!report) return;

    const summaryText = `=== BÁO CÁO CHẨN ĐOÁN HLS SUBTITLES ===
Kênh: ${report.channelName || channel?.name || 'N/A'} (ID: ${report.channelId || channel?.id || 'N/A'})
URL: ${report.streamUrl}
Thời gian: ${new Date(report.checkedAt).toLocaleString('vi-VN')}
Kết luận: ${report.verdictTitle}
Mô tả: ${report.verdictMessage}

1. Thẻ HLS phát hiện:
- #EXT-X-MEDIA:TYPE=SUBTITLES: ${report.hasSubtitleTags ? `${report.subtitleTracks.length} track` : 'Không có (0)'}
- #EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS: ${report.hasClosedCaptionsTags ? `${report.closedCaptionsTracks.length} track` : 'Không có (0)'}
- CLOSED-CAPTIONS trong Variant: ${report.hasInStreamCaptionsDeclared ? 'Có khai báo' : report.hasClosedCaptionsNone ? 'Khai báo NONE' : 'Không có'}

2. Chi tiết Subtitle Tracks:
${
  report.subtitleTracks.length > 0
    ? report.subtitleTracks
        .map(
          (t, idx) =>
            `[Track ${idx + 1}] Tên: ${t.name} | Ngôn ngữ: ${t.language} | Group: ${t.groupId} | Phản hồi: HTTP ${t.httpStatus || 'N/A'} (${t.responseTimeMs || 0}ms) | Phân đoạn: ${t.segmentCount || 0} segs | WebVTT: ${t.sampleSegmentHasWebVttHeader ? 'HỢP LỆ' : 'KHÔNG'}`
        )
        .join('\n')
    : 'Không có track WebVTT'
}

3. Khuyến nghị:
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    navigator.clipboard.writeText(summaryText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleSaveToChannel = async () => {
    if (!report || !channel?.id) return;

    try {
      const extractedTracks = [
        ...report.subtitleTracks.map((t) => ({
          name: t.name,
          lang: t.language,
          type: 'vtt',
          isDefault: t.isDefault,
          uri: t.resolvedUri || t.uri,
        })),
        ...report.closedCaptionsTracks.map((c) => ({
          name: c.name,
          lang: c.language,
          type: 'cea608',
          isDefault: c.isDefault,
        })),
      ];

      const res = await fetch(`/api/channels/${channel.id}/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          has_subtitles: extractedTracks.length > 0,
          subtitle_tracks: extractedTracks,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (onApplyTracksToChannel) {
          onApplyTracksToChannel(extractedTracks);
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Công Cụ Chẩn Đoán Phụ Đề HLS</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                  Manifest Deep Scanner v2.0
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kiểm tra tính hợp lệ và khả năng truy cập của thẻ <code>#EXT-X-MEDIA:TYPE=SUBTITLES</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Target & Scan Bar */}
        <div className="p-4 bg-neutral-900/30 border-b border-neutral-800/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunDiagnostic();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="Nhập URL luồng HLS .m3u8 cần quét sâu..."
                className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono tracking-tight"
              />
              {channel && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-400/90 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 font-medium">
                  {channel.name}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !streamUrl.trim()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10 flex-shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang quét sâu...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Quét & Chẩn đoán HLS</span>
                </>
              )}
            </button>
          </form>

          {/* Scanning Progress Steps */}
          {loading && (
            <div className="mt-3 pt-3 border-t border-neutral-800/60">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>
                    {currentStep === 1 && 'Giai đoạn 1/4: Kết nối máy chủ & tải Master Manifest...'}
                    {currentStep === 2 && 'Giai đoạn 2/4: Phân tích thẻ EXT-X-MEDIA & STREAM-INF...'}
                    {currentStep === 3 && 'Giai đoạn 3/4: Thăm dò danh sách phụ đề con (Sub-playlists)...'}
                    {currentStep >= 4 && 'Giai đoạn 4/4: Kiểm tra phân đoạn WebVTT (.vtt) thực tế...'}
                  </span>
                </span>
                <span className="font-mono text-neutral-400">{currentStep * 25}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                  style={{ width: `${currentStep * 25}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lỗi quét manifest:</span> {error}
              </div>
            </div>
          )}

          {report && (
            <>
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  report.verdict === 'verified'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : report.verdict === 'warning'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : report.verdict === 'missing_tags'
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {report.verdict === 'verified' && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                    {report.verdict === 'warning' && (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    )}
                    {report.verdict === 'missing_tags' && (
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    {['not_hls', 'offline'].includes(report.verdict) && (
                      <div className="w-8 h-8 rounded-xl bg-neutral-800 text-neutral-400 flex items-center justify-center border border-neutral-700">
                        <Radio className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-white">{report.verdictTitle}</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          report.verdict === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : report.verdict === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : report.verdict === 'missing_tags'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {report.verdict === 'verified' && 'HỢP LỆ & SẴN SÀNG'}
                        {report.verdict === 'warning' && 'CẢNH BÁO'}
                        {report.verdict === 'missing_tags' && 'THIẾU THẺ PHỤ ĐỀ'}
                        {report.verdict === 'not_hls' && 'KHÔNG PHẢI HLS'}
                        {report.verdict === 'offline' && 'NGOẠI TUYẾN'}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                      {report.verdictMessage}
                    </p>

                    {/* Warning detail for missing tags */}
                    {report.verdict === 'missing_tags' && (
                      <div className="mt-3 p-3 bg-black/50 border border-rose-500/30 rounded-xl text-xs space-y-1 text-rose-300/90">
                        <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Chi tiết cảnh báo nguồn phát:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Trong file danh sách phát HLS Master, không tìm thấy bất kỳ thẻ <code>#EXT-X-MEDIA:TYPE=SUBTITLES</code> nào. 
                          Điều này giải thích tại sao luồng phát không hiển thị nút phụ đề đài truyền hình hoặc không có phụ đề đi kèm từ nguồn.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Technical Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                    Phản hồi Master
                  </div>
                  <div className="text-base font-bold text-white mt-0.5 flex items-center gap-1">
                    <span className={report.masterHttpStatus === 200 ? 'text-emerald-400' : 'text-rose-400'}>
                      HTTP {report.masterHttpStatus}
                    </span>
                    <span className="text-[11px] font-normal text-neutral-400 font-mono">
                      ({report.masterLatencyMs}ms)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                    Thẻ WebVTT (Subtitles)
                  </div>
                  <div className="text-base font-bold mt-0.5 flex items-center gap-1.5">
                    {report.hasSubtitleTags ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        {report.subtitleTracks.length} Track
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <X className="w-4 h-4" />
                        Không có (0)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                    Thẻ Closed-Captions
                  </div>
                  <div className="text-base font-bold mt-0.5 flex items-center gap-1.5">
                    {report.hasClosedCaptionsTags || report.hasInStreamCaptionsDeclared ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Radio className="w-4 h-4" />
                        {report.closedCaptionsTracks.length > 0
                          ? `${report.closedCaptionsTracks.length} Track (CC)`
                          : 'Nhúng in-stream'}
                      </span>
                    ) : report.hasClosedCaptionsNone ? (
                      <span className="text-neutral-400 text-xs font-mono">NONE</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">Không khai báo</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                    Luồng Video Variant
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {report.variantStreams.length > 0 ? `${report.variantStreams.length} mức phân giải` : 'Đơn luồng'}
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-neutral-800 gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('tracks')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'tracks'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Track Phụ Đề ({report.subtitleTracks.length + report.closedCaptionsTracks.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('variants')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'variants'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Variant Streams ({report.variantStreams.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('advice')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'advice'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Khuyến Nghị & Khắc Phục</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('manifest')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'manifest'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Manifest Gốc (.m3u8)</span>
                </button>
              </div>

              {/* Tab: Tracks */}
              {activeTab === 'tracks' && (
                <div className="space-y-3">
                  {report.subtitleTracks.length === 0 && report.closedCaptionsTracks.length === 0 ? (
                    <div className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                      <h5 className="font-bold text-sm text-white">Không phát hiện track phụ đề nào trong Manifest</h5>
                      <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
                        Nguồn phát không chứa bất kỳ thẻ <code>#EXT-X-MEDIA:TYPE=SUBTITLES</code> hoặc <code>CLOSED-CAPTIONS</code> nào.
                        Hãy xem tab "Khuyến nghị & Khắc phục" để giải quyết.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* WebVTT Tracks */}
                      {report.subtitleTracks.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                            <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Track WebVTT Độc Lập (#EXT-X-MEDIA:TYPE=SUBTITLES)</span>
                          </div>

                          <div className="grid gap-2.5">
                            {report.subtitleTracks.map((track, idx) => (
                              <div
                                key={track.id || idx}
                                className={`p-3.5 rounded-xl border transition-all ${
                                  track.accessible
                                    ? 'bg-neutral-900/80 border-emerald-500/30'
                                    : 'bg-rose-950/20 border-rose-500/30'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-white">
                                        {track.name}
                                      </span>
                                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                                        Lang: {track.language}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                                        Group: {track.groupId}
                                      </span>
                                      {track.isDefault && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/60">
                                          DEFAULT
                                        </span>
                                      )}
                                      {track.autoSelect && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                                          AUTOSELECT
                                        </span>
                                      )}
                                    </div>

                                    {/* URI Detail */}
                                    {track.resolvedUri && (
                                      <div className="mt-1.5 text-[11px] font-mono text-neutral-400 truncate flex items-center gap-1">
                                        <ArrowRight className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                                        <span className="truncate">{track.resolvedUri}</span>
                                      </div>
                                    )}

                                    {/* Verification Badges */}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                                      {track.accessible ? (
                                        <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-600/40 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                          <Check className="w-3 h-3" />
                                          <span>Sub-playlist HTTP {track.httpStatus} ({track.responseTimeMs}ms)</span>
                                        </span>
                                      ) : (
                                        <span className="text-rose-400 bg-rose-950/80 border border-rose-600/40 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                          <X className="w-3 h-3" />
                                          <span>Lỗi: {track.error || `HTTP ${track.httpStatus}`}</span>
                                        </span>
                                      )}

                                      {track.segmentCount !== undefined && (
                                        <span className="text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded font-mono">
                                          {track.segmentCount} phân đoạn video
                                        </span>
                                      )}

                                      {track.sampleSegmentHasWebVttHeader && (
                                        <span className="text-cyan-300 bg-cyan-950/80 border border-cyan-600/40 px-2 py-0.5 rounded font-semibold">
                                          Header WEBVTT chuẩn
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Closed Captions Tracks */}
                      {report.closedCaptionsTracks.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                            <Radio className="w-3.5 h-3.5 text-amber-400" />
                            <span>Phụ Đề Ẩn Nhúng In-stream (#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS)</span>
                          </div>

                          <div className="grid gap-2">
                            {report.closedCaptionsTracks.map((track, idx) => (
                              <div
                                key={track.id || idx}
                                className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-xs text-neutral-200 flex items-center gap-2">
                                    <span>{track.name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                                      {track.instreamId || 'CC1'}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      Lang: {track.language}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-neutral-400 mt-0.5">
                                    Được đóng gói trong gói tin video NAL SEI (CEA-608). Trình phát tự động nhận dạng khi phát sóng.
                                  </p>
                                </div>
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded font-semibold border border-emerald-800/60">
                                  Sẵn sàng
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tab: Variant Streams */}
              {activeTab === 'variants' && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400 mb-2">
                    Các luồng video thành phần được khai báo trong Master Playlist và nhóm phụ đề được gán:
                  </p>

                  <div className="grid gap-2">
                    {report.variantStreams.map((v, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1 mr-3">
                          <div className="flex items-center gap-2 font-mono text-neutral-200">
                            <span className="font-bold text-amber-400">
                              {v.resolution || `Mức ${idx + 1}`}
                            </span>
                            {v.bandwidth && (
                              <span className="text-neutral-400 text-[11px]">
                                {Math.round(v.bandwidth / 1000)} kbps
                              </span>
                            )}
                            {v.codecs && (
                              <span className="text-[10px] text-neutral-400 truncate max-w-xs">
                                Codecs: {v.codecs}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 truncate mt-1">
                            URL: {v.uri}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded font-mono ${
                              v.subtitlesGroup
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                : 'bg-neutral-800 text-neutral-500'
                            }`}
                          >
                            SUBTITLES: {v.subtitlesGroup || 'NONE'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono ${
                              v.closedCaptionsGroup && v.closedCaptionsGroup !== 'NONE'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-neutral-800 text-neutral-500'
                            }`}
                          >
                            CC: {v.closedCaptionsGroup || 'NONE'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Recommendations */}
              {activeTab === 'advice' && (
                <div className="space-y-3">
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-3">
                    <h5 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Hướng Dẫn & Phương Án Khắc Phục</span>
                    </h5>

                    <div className="space-y-2.5">
                      {report.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-xl text-xs text-neutral-300 flex items-start gap-2.5 leading-relaxed"
                        >
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 border border-amber-500/30">
                            {idx + 1}
                          </span>
                          <div className="flex-1">{rec}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Standard HLS Tag Spec Guide for IPTV Admins */}
                  <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl text-xs space-y-2">
                    <div className="font-bold text-neutral-200 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>Mẫu khai báo chuẩn HLS Subtitles (RFC 8216) cho nhà đài:</span>
                    </div>
                    <pre className="p-3 bg-black/80 rounded-xl text-[11px] font-mono text-cyan-300/90 overflow-x-auto border border-neutral-800">
{`# Thẻ khai báo phụ đề WebVTT độc lập
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Tiếng Việt",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="vie",URI="sub_vi.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=NO,AUTOSELECT=YES,FORCED=NO,LANGUAGE="eng",URI="sub_en.m3u8"

# Thẻ liên kết với luồng video
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,SUBTITLES="subs",CLOSED-CAPTIONS="CC"
video_720p.m3u8`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab: Raw Manifest */}
              {activeTab === 'manifest' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>Nội dung Master Manifest thực tế nhận được từ máy chủ stream:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(report.rawMasterSnippet);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[10px] flex items-center gap-1 transition"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedUrl ? 'Đã sao chép' : 'Sao chép Manifest'}
                    </button>
                  </div>

                  <pre className="p-3.5 bg-black/90 border border-neutral-800 rounded-xl text-[11px] font-mono text-amber-200/90 overflow-x-auto max-h-72 leading-relaxed">
                    {report.rawMasterSnippet || '// Không có dữ liệu text'}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-neutral-800/80 bg-neutral-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {report && (
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition border border-neutral-700"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                {copiedReport ? 'Đã sao chép báo cáo' : 'Sao chép báo cáo'}
              </button>
            )}

            {channel && report && (report.subtitleTracks.length > 0 || report.closedCaptionsTracks.length > 0) && (
              <button
                type="button"
                onClick={handleSaveToChannel}
                disabled={saveSuccess}
                className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {saveSuccess ? 'Đã lưu vào kênh!' : 'Lưu track phụ đề vào kênh'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
