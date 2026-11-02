// Role: renders a drift outcome for people (renderOutcome: lines) and for scripts (renderJson: the DriftReport, or the outcome when there is none).
// Informs HERDR-ADR-0009 (the report lists added and removed separately) and the atalaya CLI wording it ports.
import { DriftExitCode, DriftOutcomeKind } from '../constants.ts';
import { DriftFacet, DriftName } from './constants.ts';
import { hasMovement } from './name-diff.ts';
import type { DriftOutcome, DriftReport, NameDiff } from './types.ts';

export function renderOutcome(outcome: DriftOutcome): string[] {
  switch (outcome.kind) {
    case DriftOutcomeKind.Usage:
      return [statusLine(DriftExitCode.Usage, `USAGE: ${outcome.message}`)];
    case DriftOutcomeKind.NotCovered:
      return [statusLine(DriftExitCode.NotCovered, `NOT COVERED: ${outcome.reason}`)];
    case DriftOutcomeKind.Report:
      return reportLines(outcome.report);
  }
}

export function renderJson(outcome: DriftOutcome): string {
  return JSON.stringify(outcome.kind === DriftOutcomeKind.Report ? outcome.report : outcome, null, 2);
}

function reportLines(report: DriftReport): string[] {
  const findings = findingsOf(report);
  if (findings.length === 0) {
    return [statusLine(DriftExitCode.Clean, `clean (protocol ${report.protocol.installed}, herdr ${report.herdrVersion.installed})`)];
  }
  return [...findings, statusLine(DriftExitCode.Drift, `${findings.length} finding(s)`)];
}

function findingsOf(report: DriftReport): string[] {
  const findings: string[] = [];
  if (report.protocol.committed !== report.protocol.installed) {
    findings.push(`protocol moved ${report.protocol.committed} -> ${report.protocol.installed}`);
  }
  if (report.herdrVersion.committed !== report.herdrVersion.installed) {
    findings.push(`herdr version moved ${report.herdrVersion.committed} -> ${report.herdrVersion.installed}`);
  }
  const facets: readonly (readonly [string, NameDiff])[] = [
    [DriftFacet.Methods, report.methods],
    [DriftFacet.ResultTags, report.resultTags],
    [DriftFacet.EventKinds, report.eventKinds],
    [DriftFacet.SubscriptionTypes, report.subscriptionTypes],
  ];
  for (const [label, diff] of facets) {
    if (hasMovement(diff)) {
      findings.push(facetLine(label, diff));
    }
  }
  if (report.changedShapes.length > 0) {
    findings.push(`field shapes changed: ${report.changedShapes.join(', ')}`);
  }
  if (report.unmappedMethods.length > 0) {
    findings.push(`methods without a METHOD_RESULT row: ${report.unmappedMethods.join(', ')}`);
  }
  return findings;
}

function facetLine(label: string, diff: NameDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    parts.push(`herdr ADDED ${diff.added.length} the copy lacks: ${diff.added.join(', ')}`);
  }
  if (diff.removed.length > 0) {
    parts.push(`herdr REMOVED ${diff.removed.length} the copy still has: ${diff.removed.join(', ')}`);
  }
  return `${label}: ${parts.join(' · ')}`;
}

function statusLine(code: DriftExitCode, text: string): string {
  return `${DriftName}: ${code} — ${text}`;
}
