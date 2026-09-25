import { humanDuration, type CrossingModel, type StepCall } from "./model/decide";
import { windowSum } from "./model/bucket";
import { dayLabel, hhmm, round5 } from "./model/time";
import { STEP_MS, type Call, type Crossing, type Detour, type Series } from "./model/types";
import { t, type Lang } from "./i18n";

export interface CallView {
  crossing: Crossing;
  model: CrossingModel;
  step: StepCall;
  call: Call;
  verb: string;
  reason: string;
  action?: string;
  detour?: Detour;
  detourCall?: Call;
  footer: string;
  sub: string;
  pct: number;
  band: { lo: number; mid: number; hi: number };
  bandText: string;
  level: number;
  rainHour: number;
  rain3h: number;
  nReports: number;
  estimate: boolean;
  aria: string;
  /** EAT clock time the crossing is expected to clear, if flooded */
  clearsAt?: string;
  floodsBy?: string;
}

export const fmtMm = (x: number) => (x >= 10 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString());

export function durText(min: number, lang: Lang): string {
  const d = humanDuration(min);
  if (d.unit === "min") return lang === "sw" ? `dakika ${d.value}` : `${d.value} min`;
  const v = Number.isInteger(d.value) ? d.value.toString() : d.value.toFixed(1);
  // Swahili reads "saa 1½", not "saa 1.5"
  const sw = Number.isInteger(d.value) ? v : `${Math.floor(d.value)}½`;
  return lang === "sw" ? `saa ${sw}` : `${v} h`;
}

export function callView(
  series: Series,
  models: Record<string, CrossingModel>,
  id: string,
  i: number,
  lang: Lang,
): CallView | null {
  const model = models[id];
  if (!model) return null;
  const c = model.crossing;
  const step = model.calls[Math.max(0, Math.min(i, model.calls.length - 1))];
  const now = series.start + (i + 1) * STEP_MS;
  const call = step.call;
  const vars: Record<string, string | number> = {};
  if (step.tClearMin != null && Number.isFinite(step.tClearMin)) {
    vars.time = hhmm(round5(now + step.tClearMin * 60_000));
    vars.dur = durText(step.tClearMin, lang);
  } else if (step.tClearMin === Infinity) {
    vars.dur = lang === "sw" ? "zaidi ya saa 12" : "12+ h";
    vars.time = lang === "sw" ? "kesho" : "tomorrow";
  }
  const floodsBy = step.tFloodMin != null ? hhmm(round5(now + step.tFloodMin * 60_000)) : undefined;
  if (floodsBy && call === "cross") vars.time = floodsBy;
  if (step.reportAgoMin != null) vars.ago = step.reportAgoMin;

  const reason = t(lang, `reason.${step.reason}`, vars);
  const detour = step.detourIdx != null ? c.detours[step.detourIdx] : undefined;
  const detourCall = detour?.crossingId ? models[detour.crossingId]?.calls[i]?.call : undefined;
  const action = detour ? t(lang, "action.use", { road: detour.via, min: detour.extraMin }) : undefined;
  const pct = Math.round(step.p * 100);
  const band = model.band;
  const bandText = `${Math.round(band.lo)}–${Math.round(band.hi)} mm`;
  const nReports = model.obs.length;
  const estimate = nReports === 0;
  const rainHour = windowSum(model.rain, i, 4);
  const rain3h = windowSum(model.rain, i, 12);
  const footer = [
    `${pct}%`,
    `${lang === "sw" ? "kiwango" : "trigger"} ${bandText}`,
    estimate ? (lang === "sw" ? "makadirio" : "estimate") : `${nReports} ${lang === "sw" ? "ripoti" : nReports === 1 ? "report" : "reports"}`,
  ].join(" · ");

  let sub: string;
  switch (call) {
    case "cross":
      sub = floodsBy ? t(lang, "sub.rising", { time: floodsBy }) : t(lang, "reason.clear");
      break;
    case "wait":
      sub =
        step.reason === "clears_at" && vars.time
          ? t(lang, "sub.clears", { time: vars.time })
          : step.reason === "reported"
            ? reason
            : t(lang, "sub.maybe", { p: pct });
      break;
    case "reroute":
      sub = `${t(lang, "sub.clears", { time: vars.time ?? "?" })} · ${detour?.via ?? ""}`;
      break;
    default:
      sub = t(lang, "sub.nodata");
  }

  const verb = t(lang, `verb.${call}`);
  const aria = `${c.name}: ${verb.toLowerCase()}. ${reason}.${action ? ` ${action}.` : ""}`;

  return {
    crossing: c,
    model,
    step,
    call,
    verb,
    reason,
    action,
    detour,
    detourCall,
    footer,
    sub,
    pct,
    band,
    bandText,
    level: step.level,
    rainHour,
    rain3h,
    nReports,
    estimate,
    aria,
    clearsAt: typeof vars.time === "string" && call !== "cross" ? vars.time : undefined,
    floodsBy,
  };
}

/** The WhatsApp-ready message: the artifact a rider sends to the stage group. */
export function shareMessage(v: CallView, series: Series, i: number, gaugeName: string, url: string, lang: Lang): string {
  const now = series.start + (i + 1) * STEP_MS;
  const when = `${hhmm(now)}, ${dayLabel(now, lang)}`;
  const name = v.crossing.name;
  const lines: string[] = [];
  if (lang === "sw") {
    if (v.call === "reroute") lines.push(`${name}: HUENDA IMEFURIKA hadi ~${v.clearsAt}.`, `${v.action}.`);
    else if (v.call === "wait") lines.push(`${name}: SUBIRI. ${v.reason}.`);
    else if (v.call === "cross") lines.push(`${name}: INAPITIKA sasa. ${v.reason === t("sw", "reason.clear") ? "" : v.reason + "."}`.trim());
    else lines.push(`${name}: HAIJULIKANI. Kipimo cha mvua hakipatikani; angalia kabla ya kuvuka.`);
    lines.push(`Mvua pale ${gaugeName}: ${fmtMm(v.rain3h)} mm ndani ya saa 3 zilizopita (${when}).`);
  } else {
    if (v.call === "reroute") lines.push(`${name}: likely FLOODED until about ${v.clearsAt}.`, `${v.action}.`);
    else if (v.call === "wait") lines.push(`${name}: WAIT. ${v.reason}.`);
    else if (v.call === "cross") lines.push(`${name}: CLEAR now. ${v.reason === t("en", "reason.clear") ? "" : v.reason + "."}`.trim());
    else lines.push(`${name}: NO CALL. Gauge silent; check before you cross.`);
    lines.push(`Rain at ${gaugeName}: ${fmtMm(v.rain3h)} mm in the last 3 h (${when}).`);
  }
  lines.push(`Crossing Watch · ${url}`);
  return lines.join("\n");
}
