import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export interface NetworkEvidenceValidation {
  ok: boolean;
  messages: string[];
}

interface ArtifactRule {
  relativePath: string;
  headings: readonly RegExp[];
  references?: readonly string[];
  patterns?: readonly { description: string; pattern: RegExp }[];
}

const RULES: Readonly<Record<string, readonly ArtifactRule[]>> = {
  "01-02": [
    {
      relativePath: "evidence/baseline.md",
      headings: [
        /source facts/i,
        /assumptions before action/i,
        /expected before action/i,
        /initial state and preflight/i,
        /action start/i,
        /raw evidence reference/i,
        /observed topology guardrails/i,
        /observed alpha/i,
        /observed beta/i,
        /inference and unknowns/i
      ],
      references: [
        ".training/evidence/01-02/",
        "preflight.json",
        "events.jsonl",
        "topology-inspect.json",
        "baseline.txt"
      ],
      patterns: [
        {
          description: "нулевой initial labelled resource count",
          pattern: /initial[\s\S]{0,300}(?:labelled_)?containers?\s*[:=]\s*0[\s\S]{0,120}(?:labelled_)?networks?\s*[:=]\s*0/i
        },
        {
          description: "нулевой initial labelled volume count",
          pattern: /(?:labelled_)?volumes?\s*[:=]\s*0/i
        },
        {
          description: "local Docker unix endpoint",
          pattern: /(?:(?:endpoint|dockerEndpoint)[\s\S]{0,160}unix:\/\/|unix:\/\/[\s\S]{0,160}(?:endpoint|dockerEndpoint))/i
        },
        {
          description: "нулевой subnet conflict count",
          pattern: /(?:subnet_conflicts|conflictCount)\s*["`]?\s*[:=]\s*0/i
        },
        {
          description: "observed isolation/exposure guardrails",
          pattern: /internal\s*[:=]\s*true[\s\S]{0,300}(?:published[_ -]?ports?|port bindings?)\s*[:=]\s*0/i
        }
      ]
    },
    {
      relativePath: "evidence/post-check.md",
      headings: [
        /cleanup action/i,
        /raw post-check evidence/i,
        /observed status/i,
        /final state/i
      ],
      references: [".training/evidence/01-02/", "post-check.txt"],
      patterns: [
        {
          description: "фактический clean resource count",
          pattern: /(?:containers?|контейнер\w*)\s*[:=]\s*0[\s\S]{0,100}(?:networks?|сет\w*)\s*[:=]\s*0/i
        },
        {
          description: "фактический clean volume count",
          pattern: /volumes?\s*[:=]\s*0/i
        }
      ]
    }
  ],
  "01-03": [
    {
      relativePath: "frame-map.md",
      headings: [
        /source facts/i,
        /assumptions before action/i,
        /expected before action/i,
        /inspector action and raw evidence/i,
        /fixture identity/i,
        /frame 1 observations/i,
        /frame 1 boundary arithmetic/i,
        /frame 2 observations/i,
        /frame 2 boundary arithmetic/i,
        /^inference$/i,
        /unknowns and applicability limits/i,
        /offline inspector cleanup/i
      ],
      references: [
        ".training/evidence/01-03/",
        "preflight.txt",
        "events.jsonl",
        "inspect.txt",
        "post-check.txt",
        "fixtures/01-03/known-neighbour.pcap",
        "8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f"
      ],
      patterns: [
        {
          description: "IPv4 length с единицами",
          pattern: /\b60\s*(?:bytes?|байт(?:а|ов)?)\b/i
        },
        {
          description: "captured frame length с единицами",
          pattern: /\b74\s*(?:bytes?|байт(?:а|ов)?)\b/i
        },
        {
          description: "IPv4 total-length field",
          pattern: /ip\.len/i
        },
        {
          description: "captured-length field",
          pattern: /frame\.cap_len/i
        },
        { description: "frame 1 citation", pattern: /\bframe\s*(?:number\s*)?#?1\b/i },
        { description: "frame 2 citation", pattern: /\bframe\s*(?:number\s*)?#?2\b/i },
        {
          description: "offline cleanup marker",
          pattern: /exact_container_absent\s*=\s*true/i
        },
        {
          description: "нулевой labelled resource post-check",
          pattern:
            /(?:labelled[ _])?containers?\s*[:=]\s*0[\s\S]{0,160}(?:labelled[ _])?networks?\s*[:=]\s*0[\s\S]{0,160}(?:labelled[ _])?volumes?\s*[:=]\s*0/i
        }
      ]
    }
  ],
  "01-04": [
    {
      relativePath: "evidence/comparison.md",
      headings: [
        /source facts/i,
        /assumptions before action/i,
        /expected before action/i,
        /cold prediction/i,
        /warm prediction/i,
        /action start and raw evidence/i,
        /preflight and topology evidence/i,
        /cold observations/i,
        /warm observations/i,
        /comparison and inference/i,
        /alternative explanations and variable fields/i,
        /cleanup and post-check/i
      ],
      references: [
        ".training/evidence/01-04/",
        "preflight.json",
        "topology-inspect.json",
        "baseline.txt",
        "events.jsonl",
        "helpers/neigh-flush.json",
        "helpers/capture-cold.json",
        "helpers/probe-cold.json",
        "helpers/capture-warm.json",
        "helpers/probe-warm.json",
        "cold/neighbor-before.txt",
        "cold/neighbor-after.txt",
        "cold/capture.pcap",
        "cold/capture.sha256.txt",
        "cold/events.tsv",
        "warm/neighbor-before.txt",
        "warm/neighbor-after.txt",
        "warm/capture.pcap",
        "warm/capture.sha256.txt",
        "warm/events.tsv",
        "post-check.txt"
      ],
      patterns: [
        {
          description: "ссылки на raw pcap",
          pattern: /(?:cold|warm)[^\n]*\.pcap|\.pcap[^\n]*(?:cold|warm)/i
        },
        {
          description: "neighbor evidence",
          pattern: /neighbou?r|сосед/i
        },
        {
          description: "ARP и ICMP evidence",
          pattern: /ARP[\s\S]{0,500}ICMP/i
        },
        {
          description: "matching Echo identifier/sequence",
          pattern: /(?:ident(?:ifier)?|icmp\.ident)[\s\S]{0,120}(?:seq(?:uence)?|icmp\.seq)/i
        },
        {
          description: "advertised beta MAC mapping",
          pattern: /(?:arp\.src\.hw_mac|advertis\w*|реклам\w*)[\s\S]{0,160}02:42:ac:1e:00:14/i
        },
        {
          description: "local Docker unix endpoint",
          pattern: /(?:(?:endpoint|dockerEndpoint)[\s\S]{0,160}unix:\/\/|unix:\/\/[\s\S]{0,160}(?:endpoint|dockerEndpoint))/i
        },
        {
          description: "нулевой subnet conflict count",
          pattern: /(?:subnet_conflicts|conflictCount)\s*["`]?\s*[:=]\s*0/i
        },
        {
          description: "фактический clean resource count",
          pattern: /(?:containers?|контейнер\w*)\s*[:=]\s*0[\s\S]{0,100}(?:networks?|сет\w*)\s*[:=]\s*0/i
        },
        {
          description: "фактический clean volume count",
          pattern: /volumes?\s*[:=]\s*0/i
        }
      ]
    }
  ],
  "01-05": [
    {
      relativePath: "diagnosis.md",
      headings: [
        /source facts/i,
        /assumptions before inspector actions/i,
        /expected before inspector actions/i,
        /inspector run ledger/i,
        /case a.+interface-not-ready/i,
        /case b.+arp-no-reply/i,
        /case c.+icmp-no-reply/i,
        /cross-case comparison/i,
        /offline inspector cleanup/i
      ],
      references: [
        ".training/evidence/01-05/",
        "preflight.txt",
        "events.jsonl",
        "inspect.txt",
        "post-check.txt",
        "fixtures/01-05/interface-not-ready/",
        "fixtures/01-05/arp-no-reply/",
        "fixtures/01-05/icmp-no-reply/"
      ],
      patterns: [
        {
          description: "offline cleanup markers для трёх inspect runs",
          pattern: /exact_container_absent\s*=\s*true/i
        }
      ]
    }
  ],
  "01-06": [
    {
      relativePath: "packet-path.md",
      headings: [
        /expected before action/i,
        /inspector action and raw evidence/i,
        /fixture identity and provenance/i,
        /^source facts$/i,
        /^assumptions$/i,
        /frame inventory/i,
        /echo pair correlation/i,
        /causal stages/i,
        /^observations$/i,
        /^inferences$/i,
        /^unknowns$/i,
        /^counterfactual$/i,
        /final bounded conclusion/i,
        /cleanup status/i
      ],
      references: [
        ".training/evidence/01-06/",
        "preflight.txt",
        "events.jsonl",
        "inspect.txt",
        "post-check.txt",
        "fixtures/01-06/novel-local-exchange.pcap",
        "fixtures/01-06/novel-local-exchange.baseline.txt"
      ],
      patterns: [
        { description: "frame 1 citation", pattern: /\bframe\s*(?:number\s*)?#?1\b/i },
        { description: "frame 2 citation", pattern: /\bframe\s*(?:number\s*)?#?2\b/i },
        { description: "frame 3 citation", pattern: /\bframe\s*(?:number\s*)?#?3\b/i },
        { description: "frame 4 citation", pattern: /\bframe\s*(?:number\s*)?#?4\b/i },
        { description: "frame 5 citation", pattern: /\bframe\s*(?:number\s*)?#?5\b/i },
        { description: "frame 6 citation", pattern: /\bframe\s*(?:number\s*)?#?6\b/i },
        {
          description: "offline cleanup marker",
          pattern: /exact_container_absent\s*=\s*true/i
        },
        {
          description: "нулевой labelled resource post-check",
          pattern: /(?:labelled_)?containers?\s*[:=]\s*0[\s\S]{0,160}(?:labelled_)?networks?\s*[:=]\s*0[\s\S]{0,160}(?:labelled_)?volumes?\s*[:=]\s*0/i
        }
      ]
    }
  ]
};

const PLACEHOLDER =
  /\b(?:TODO|TBD|FIXME)\b|\{\{[^}]*\}\}|<\s*(?:fill|replace|answer)[^>]*>/i;

export async function validateNetworkEvidence(
  sessionDirectory: string,
  sessionId: string,
  workspaceRoot?: string
): Promise<NetworkEvidenceValidation> {
  const rules = RULES[sessionId];
  if (!rules) {
    return {
      ok: false,
      messages: [
        `network-evidence не имеет artifact contract для session ${sessionId}.`
      ]
    };
  }

  const failures: string[] = [];
  const sources = new Map<string, string>();
  for (const rule of rules) {
    const absolute = path.join(sessionDirectory, rule.relativePath);
    const metadata = await lstat(absolute).catch(() => null);
    if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) {
      failures.push(
        `${rule.relativePath}: нужен regular non-symlink Markdown artifact.`
      );
      continue;
    }
    const markdown = await readFile(absolute, "utf8");
    sources.set(rule.relativePath, markdown);
    if (PLACEHOLDER.test(markdown)) {
      failures.push(`${rule.relativePath}: остался TODO/placeholder.`);
    }

    const sections = parseSections(markdown);
    for (const heading of rule.headings) {
      const matches = sections.filter((section) => heading.test(section.heading));
      if (matches.length === 0) {
        failures.push(
          `${rule.relativePath}: отсутствует heading ${heading.source}.`
        );
      } else if (matches.every((section) => !isSubstantive(section.body))) {
        failures.push(
          `${rule.relativePath}: section ${matches[0]?.heading ?? heading.source} не заполнена.`
        );
      }
    }

    for (const reference of rule.references ?? []) {
      if (!markdown.includes(reference)) {
        failures.push(
          `${rule.relativePath}: нет evidence reference ${reference}.`
        );
      }
    }
    for (const requirement of rule.patterns ?? []) {
      if (!requirement.pattern.test(markdown)) {
        failures.push(
          `${rule.relativePath}: не найдено ${requirement.description}.`
        );
      }
    }

    if (sessionId === "01-05") {
      validateDiagnosticCases(rule.relativePath, sections, failures);
      const cleanupMarkers = markdown.match(
        /exact_container_absent\s*=\s*true/gi
      )?.length ?? 0;
      if (cleanupMarkers < 3) {
        failures.push(
          `${rule.relativePath}: нужны три фактических offline cleanup marker, найдено ${cleanupMarkers}.`
        );
      }
    }
    if (sessionId === "01-06") {
      validateMeaningfulUnknowns(rule.relativePath, sections, failures, 3);
      await validateEchoPairCorrelation(
        rule.relativePath,
        sections,
        workspaceRoot,
        failures
      );
    }
  }

  if (sessionId === "01-02") {
    validateBaselineLifecycle(sources, failures);
  }
  if (sessionId === "01-03") {
    validateSingleFixtureLifecycle(
      sources,
      "01-03",
      "frame-map.md",
      failures
    );
  }
  if (sessionId === "01-04") {
    validateCaptureLifecycle(sources, failures);
  }
  if (sessionId === "01-05") {
    validateMultipleFixtureLifecycles(
      sources,
      "01-05",
      "diagnosis.md",
      3,
      failures
    );
  }
  if (sessionId === "01-06") {
    validateSingleFixtureLifecycle(
      sources,
      "01-06",
      "packet-path.md",
      failures
    );
  }

  if (failures.length > 0) {
    return { ok: false, messages: failures };
  }
  return {
    ok: true,
    messages: [
      `network-evidence PASS: ${rules.map((rule) => rule.relativePath).join(", ")}`
    ]
  };
}

function validateBaselineLifecycle(
  sources: ReadonlyMap<string, string>,
  failures: string[]
): void {
  const baseline = sources.get("evidence/baseline.md");
  const postCheck = sources.get("evidence/post-check.md");
  if (!baseline || !postCheck) return;

  const baselineSections = parseSections(baseline);
  const postSections = parseSections(postCheck);
  const expectedAt = timestampInSection(
    baselineSections,
    /expected before action/i
  );
  const actionAt = timestampInSection(baselineSections, /action start/i);
  const cleanupAt = timestampInSection(postSections, /cleanup action/i);
  if (!expectedAt) {
    failures.push("evidence/baseline.md: Expected section не содержит ISO UTC timestamp.");
  }
  if (!actionAt) {
    failures.push("evidence/baseline.md: Action start не содержит ISO UTC timestamp.");
  }
  if (!cleanupAt) {
    failures.push("evidence/post-check.md: Cleanup action не содержит ISO UTC timestamp.");
  }
  if (expectedAt && actionAt && expectedAt >= actionAt) {
    failures.push("evidence/baseline.md: Expected timestamp должен быть раньше action start.");
  }
  if (actionAt && cleanupAt && actionAt >= cleanupAt) {
    failures.push("evidence/post-check.md: Cleanup timestamp должен быть позже action start.");
  }

  const baselineRuns = extractRunIds(baseline, "01-02");
  const postCheckRuns = extractRunIds(postCheck, "01-02");
  const allRuns = new Set([...baselineRuns, ...postCheckRuns]);
  if (baselineRuns.size !== 1 || postCheckRuns.size !== 1 || allRuns.size !== 1) {
    failures.push(
      "01-02 evidence: baseline и post-check должны ссылаться на один exact unique run id."
    );
  }
  for (const endpoint of ["alpha", "beta"] as const) {
    const section = baselineSections.find((candidate) =>
      new RegExp(`observed ${endpoint}`, "i").test(candidate.heading)
    );
    const expected =
      endpoint === "alpha"
        ? { mac: "02:42:ac:1e:00:0a", ipv4: "172.30.0.10" }
        : { mac: "02:42:ac:1e:00:14", ipv4: "172.30.0.20" };
    if (
      !section ||
      !/\bUP\b/.test(section.body) ||
      !/\bLOWER_UP\b/.test(section.body)
    ) {
      failures.push(
        `evidence/baseline.md: Observed ${endpoint} должен отдельно содержать UP и LOWER_UP flags.`
      );
    }
    if (
      !section ||
      !/\beth0\b/.test(section.body) ||
      !section.body.toLowerCase().includes(expected.mac) ||
      !section.body.includes(expected.ipv4)
    ) {
      failures.push(
        `evidence/baseline.md: Observed ${endpoint} должен отдельно содержать eth0, MAC ${expected.mac} и IPv4 ${expected.ipv4}.`
      );
    }
  }
}

function validateCaptureLifecycle(
  sources: ReadonlyMap<string, string>,
  failures: string[]
): void {
  const comparison = sources.get("evidence/comparison.md");
  if (!comparison) return;
  const sections = parseSections(comparison);
  const expectedAt = timestampInSection(sections, /expected before action/i);
  const actionAt = timestampInSection(sections, /action start and raw evidence/i);
  const cleanupAt = timestampInSection(sections, /cleanup and post-check/i);
  if (!expectedAt) {
    failures.push("evidence/comparison.md: Expected section не содержит ISO UTC timestamp.");
  }
  if (!actionAt) {
    failures.push("evidence/comparison.md: Action start не содержит ISO UTC timestamp.");
  }
  if (!cleanupAt) {
    failures.push("evidence/comparison.md: Cleanup section не содержит ISO UTC timestamp.");
  }
  if (expectedAt && actionAt && expectedAt >= actionAt) {
    failures.push("evidence/comparison.md: Expected timestamp должен быть раньше action start.");
  }
  if (actionAt && cleanupAt && actionAt >= cleanupAt) {
    failures.push("evidence/comparison.md: Cleanup timestamp должен быть позже action start.");
  }
  if (extractRunIds(comparison, "01-04").size !== 1) {
    failures.push("evidence/comparison.md: все raw references должны использовать один exact 01-04 run id.");
  }
  const hashes = comparison.match(/\b[a-f0-9]{64}\b/gi) ?? [];
  if (hashes.length < 2) {
    failures.push("evidence/comparison.md: нужны observed SHA-256 для cold и warm pcap.");
  }
}

function validateSingleFixtureLifecycle(
  sources: ReadonlyMap<string, string>,
  sessionId: string,
  relativePath: string,
  failures: string[]
): void {
  const source = sources.get(relativePath);
  if (!source) return;
  const sections = parseSections(source);
  const expectedAt = timestampInSection(sections, /expected before action/i);
  const actionAt = timestampInSection(
    sections,
    /inspector action and raw evidence/i
  );
  const cleanupAt = timestampInSection(
    sections,
    /offline inspector cleanup|cleanup status/i
  );
  if (!expectedAt) {
    failures.push(`${relativePath}: Expected section не содержит ISO UTC timestamp.`);
  }
  if (!actionAt) {
    failures.push(`${relativePath}: inspector action не содержит ISO UTC timestamp.`);
  }
  if (!cleanupAt) {
    failures.push(`${relativePath}: cleanup section не содержит ISO UTC timestamp.`);
  }
  if (expectedAt && actionAt && expectedAt >= actionAt) {
    failures.push(`${relativePath}: Expected timestamp должен быть раньше inspector action.`);
  }
  if (actionAt && cleanupAt && actionAt >= cleanupAt) {
    failures.push(`${relativePath}: cleanup timestamp должен быть позже inspector action.`);
  }

  const runs = extractRunIds(source, sessionId);
  if (runs.size !== 1) {
    failures.push(`${relativePath}: нужен один exact unique ${sessionId} inspector run id.`);
    return;
  }
  const [runId] = runs;
  if (!runId) return;
  for (const filename of [
    "preflight.txt",
    "events.jsonl",
    "inspect.txt",
    "post-check.txt"
  ]) {
    const reference = `.training/evidence/${sessionId}/${runId}/${filename}`;
    if (!source.includes(reference)) {
      failures.push(`${relativePath}: нет raw reference ${reference}.`);
    }
  }
}

function validateMultipleFixtureLifecycles(
  sources: ReadonlyMap<string, string>,
  sessionId: string,
  relativePath: string,
  expectedRunCount: number,
  failures: string[]
): void {
  const source = sources.get(relativePath);
  if (!source) return;
  const sections = parseSections(source);
  const expectedAt = timestampInSection(
    sections,
    /expected before inspector actions/i
  );
  if (!expectedAt) {
    failures.push(`${relativePath}: Expected section не содержит ISO UTC timestamp.`);
  }
  const ledger = sections.find((section) =>
    /inspector run ledger/i.test(section.heading)
  )?.body ?? "";
  const lifecycleRows = ledger
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /inspect_action_at\s*=/.test(line));
  if (lifecycleRows.length !== expectedRunCount) {
    failures.push(
      `${relativePath}: inspector ledger должен содержать ${expectedRunCount} inspect_action_at/cleanup_at rows.`
    );
  }
  const timestampPattern =
    "(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z)";
  const rowPattern = new RegExp(
    `inspect_action_at\\s*=\\s*${timestampPattern}[\\s\\S]*cleanup_at\\s*=\\s*${timestampPattern}`,
    "i"
  );
  for (const row of lifecycleRows) {
    const match = rowPattern.exec(row);
    const actionAt = match?.[1] ? Date.parse(match[1]) : Number.NaN;
    const cleanupAt = match?.[2] ? Date.parse(match[2]) : Number.NaN;
    if (!Number.isFinite(actionAt) || !Number.isFinite(cleanupAt)) {
      failures.push(`${relativePath}: ledger row не содержит parseable inspect_action_at/cleanup_at.`);
      continue;
    }
    if (expectedAt && expectedAt >= actionAt) {
      failures.push(`${relativePath}: Expected timestamp должен быть раньше каждого inspector action.`);
    }
    if (actionAt >= cleanupAt) {
      failures.push(`${relativePath}: cleanup_at должен быть позже inspect_action_at.`);
    }
    if (!/(?:labelled(?:_counts)?\s*=\s*)?0\s*\/\s*0\s*\/\s*0/i.test(row)) {
      failures.push(`${relativePath}: каждый ledger row должен содержать labelled counts 0/0/0.`);
    }
  }

  const runs = extractRunIds(source, sessionId);
  if (runs.size !== expectedRunCount) {
    failures.push(
      `${relativePath}: нужны ${expectedRunCount} unique ${sessionId} inspector run ids.`
    );
  }
  for (const runId of runs) {
    for (const filename of [
      "preflight.txt",
      "events.jsonl",
      "inspect.txt",
      "post-check.txt"
    ]) {
      const reference = `.training/evidence/${sessionId}/${runId}/${filename}`;
      if (!source.includes(reference)) {
        failures.push(`${relativePath}: нет raw reference ${reference}.`);
      }
    }
  }
}

function timestampInSection(
  sections: readonly MarkdownSection[],
  heading: RegExp
): number | null {
  const body = sections.find((section) => heading.test(section.heading))?.body;
  const value = body?.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\b/)?.[0];
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRunIds(source: string, sessionId: string): Set<string> {
  const escapedSessionId = sessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\.training/evidence/${escapedSessionId}/([A-Za-z0-9-]+)/`,
    "g"
  );
  return new Set(
    [...source.matchAll(pattern)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value))
  );
}

interface MarkdownSection {
  level: number;
  heading: string;
  body: string;
}

function parseSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\r?\n/);
  const headings: { index: number; level: number; heading: string }[] = [];
  for (const [index, line] of lines.entries()) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match?.[1] && match[2]) {
      headings.push({
        index,
        level: match[1].length,
        heading: normalizeHeading(match[2])
      });
    }
  }
  return headings.map((heading, index) => {
    const next = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level);
    return {
      level: heading.level,
      heading: heading.heading,
      body: lines.slice(heading.index + 1, next?.index ?? lines.length).join("\n")
    };
  });
}

function validateDiagnosticCases(
  relativePath: string,
  sections: readonly MarkdownSection[],
  failures: string[]
): void {
  const cases = [
    /case a.+interface-not-ready/i,
    /case b.+arp-no-reply/i,
    /case c.+icmp-no-reply/i
  ];
  const required = [
    /verified inputs and observations/i,
    /last proven stage/i,
    /earliest disproven or not-proven transition/i,
    /bounded inference/i,
    /remaining unknowns/i,
    /next discriminating observation/i
  ];
  for (const caseHeading of cases) {
    const section = sections.find((candidate) =>
      caseHeading.test(candidate.heading)
    );
    if (!section) continue;
    const nested = parseSections(section.body);
    for (const heading of required) {
      const match = nested.find((candidate) => heading.test(candidate.heading));
      if (!match || !isSubstantive(match.body)) {
        failures.push(
          `${relativePath}: ${section.heading} не содержит заполненный section ${heading.source}.`
        );
      }
    }
    const inputs = nested.find((candidate) =>
      /verified inputs and observations/i.test(candidate.heading)
    )?.body ?? "";
    const caseId = caseHeading.source.match(
      /(interface-not-ready|arp-no-reply|icmp-no-reply)/
    )?.[1];
    if (
      !caseId ||
      !new RegExp(
        `fixtures/01-05/${caseId}/(?:baseline\\.txt|action\\.txt|events\\.tsv|capture\\.pcap|provenance\\.md|sha256\\.txt)`,
        "i"
      ).test(inputs)
    ) {
      failures.push(
        `${relativePath}: ${section.heading} не содержит точную file evidence citation.`
      );
    }
    validateMeaningfulUnknowns(relativePath, nested, failures, 2, section.heading);
  }
}

function validateMeaningfulUnknowns(
  relativePath: string,
  sections: readonly MarkdownSection[],
  failures: string[],
  minimum: number,
  context = "artifact"
): void {
  const body = sections.find((candidate) =>
    /^(?:remaining )?unknowns(?: and applicability limits)?$/i.test(
      candidate.heading
    )
  )?.body;
  const items = body?.match(/^\s*[-*]\s+\S.+$/gm) ?? [];
  if (items.length < minimum) {
    failures.push(
      `${relativePath}: ${context} должен перечислить минимум ${minimum} отдельных unknowns.`
    );
  }
}

interface EchoFrameObservation {
  frame: 3 | 4 | 5 | 6;
  ethSrc: string;
  ethDst: string;
  ipSrc: string;
  ipDst: string;
  type: number;
  ident: number;
  sequence: number;
}

async function validateEchoPairCorrelation(
  relativePath: string,
  sections: readonly MarkdownSection[],
  workspaceRoot: string | undefined,
  failures: string[]
): Promise<void> {
  const matchingSections = sections.filter((section) =>
    /echo pair correlation/i.test(section.heading)
  );
  if (matchingSections.length !== 1) {
    failures.push(
      `${relativePath}: нужна ровно одна section Echo pair correlation.`
    );
  }
  const body = matchingSections.map((section) => section.body).join("\n");
  if (!body) return;

  const markerPattern = /^\s*(?:[-*]\s*)?echo_frame\s*=\s*(3|4|5|6)\b.*$/gim;
  const markerCounts = new Map<number, number>();
  for (const marker of body.matchAll(markerPattern)) {
    const frame = Number(marker[1]);
    markerCounts.set(frame, (markerCounts.get(frame) ?? 0) + 1);
  }

  const rowPattern =
    /^\s*(?:[-*]\s*)?echo_frame\s*=\s*(3|4|5|6)\s+eth\.src\s*=\s*([0-9a-f:]+)\s+eth\.dst\s*=\s*([0-9a-f:]+)\s+ip\.src\s*=\s*([0-9.]+)\s+ip\.dst\s*=\s*([0-9.]+)\s+icmp\.type\s*=\s*(\d+)\s+icmp\.ident\s*=\s*(\d+)\s+icmp\.seq\s*=\s*(\d+)\s*$/gim;
  const rows: EchoFrameObservation[] = [...body.matchAll(rowPattern)].map(
    (match) => ({
      frame: Number(match[1]) as EchoFrameObservation["frame"],
      ethSrc: match[2]?.toLowerCase() ?? "",
      ethDst: match[3]?.toLowerCase() ?? "",
      ipSrc: match[4] ?? "",
      ipDst: match[5] ?? "",
      type: Number(match[6]),
      ident: Number(match[7]),
      sequence: Number(match[8])
    })
  );

  const byFrame = new Map<EchoFrameObservation["frame"], EchoFrameObservation[]>();
  for (const row of rows) {
    const entries = byFrame.get(row.frame) ?? [];
    entries.push(row);
    byFrame.set(row.frame, entries);
  }

  for (const frame of [3, 4, 5, 6] as const) {
    if ((markerCounts.get(frame) ?? 0) !== 1) {
      failures.push(
        `${relativePath}: нужна ровно одна Echo correlation row echo_frame=${frame}.`
      );
    }
    if ((byFrame.get(frame) ?? []).length !== 1) {
      failures.push(
        `${relativePath}: row echo_frame=${frame} должна содержать parseable eth.src/dst, ip.src/dst, icmp.type, icmp.ident и icmp.seq.`
      );
    }
  }

  if (!workspaceRoot) {
    failures.push(
      `${relativePath}: workspace root нужен для сверки Echo rows с versioned fixture.`
    );
    return;
  }
  const expected = await readExpectedEchoFrames(
    workspaceRoot,
    relativePath,
    failures
  );
  for (const frame of [3, 4, 5, 6] as const) {
    const actual = byFrame.get(frame)?.[0];
    const expectedFrame = expected.get(frame);
    if (!actual || !expectedFrame) continue;
    for (const field of [
      "ethSrc",
      "ethDst",
      "ipSrc",
      "ipDst",
      "type",
      "ident",
      "sequence"
    ] as const) {
      if (actual[field] !== expectedFrame[field]) {
        failures.push(
          `${relativePath}: echo_frame=${frame} ${field} не совпадает с versioned fixture observation.`
        );
      }
    }
  }

  validateEchoPair(
    "3-4",
    byFrame.get(3)?.[0],
    byFrame.get(4)?.[0],
    failures,
    relativePath
  );
  validateEchoPair(
    "5-6",
    byFrame.get(5)?.[0],
    byFrame.get(6)?.[0],
    failures,
    relativePath
  );
  const first = byFrame.get(3)?.[0];
  const second = byFrame.get(5)?.[0];
  if (first && second && first.sequence === second.sequence) {
    failures.push(
      `${relativePath}: Echo exchanges 3-4 и 5-6 должны различаться observed icmp.seq.`
    );
  }
}

async function readExpectedEchoFrames(
  workspaceRoot: string,
  relativePath: string,
  failures: string[]
): Promise<Map<EchoFrameObservation["frame"], EchoFrameObservation>> {
  const fixturePath = path.join(
    workspaceRoot,
    "fixtures/01-06/novel-local-exchange.txt"
  );
  const metadata = await lstat(fixturePath).catch(() => null);
  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    failures.push(
      `${relativePath}: versioned normalized fixture должен быть regular non-symlink file.`
    );
    return new Map();
  }
  const lines = (await readFile(fixturePath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines[0]?.split("\t") ?? [];
  const columns = new Map(header.map((name, index) => [name, index]));
  const required = [
    "frame",
    "eth_src",
    "eth_dst",
    "ip_src",
    "ip_dst",
    "icmp_type",
    "icmp_id",
    "icmp_seq"
  ];
  if (required.some((name) => !columns.has(name))) {
    failures.push(
      `${relativePath}: versioned normalized fixture не содержит обязательные Echo columns.`
    );
    return new Map();
  }
  const value = (cells: string[], name: string): string =>
    cells[columns.get(name) ?? -1] ?? "";
  const result = new Map<EchoFrameObservation["frame"], EchoFrameObservation>();
  const frameCounts = new Map<number, number>();
  for (const line of lines.slice(1)) {
    const cells = line.split("\t");
    const frame = Number(value(cells, "frame"));
    if (![3, 4, 5, 6].includes(frame)) continue;
    frameCounts.set(frame, (frameCounts.get(frame) ?? 0) + 1);
    result.set(frame as EchoFrameObservation["frame"], {
      frame: frame as EchoFrameObservation["frame"],
      ethSrc: value(cells, "eth_src").toLowerCase(),
      ethDst: value(cells, "eth_dst").toLowerCase(),
      ipSrc: value(cells, "ip_src"),
      ipDst: value(cells, "ip_dst"),
      type: Number(value(cells, "icmp_type")),
      ident: Number(value(cells, "icmp_id")),
      sequence: Number(value(cells, "icmp_seq"))
    });
  }
  if (
    result.size !== 4 ||
    [3, 4, 5, 6].some((frame) => frameCounts.get(frame) !== 1)
  ) {
    failures.push(
      `${relativePath}: versioned normalized fixture не содержит frames 3-6 ровно по одному разу.`
    );
  }
  return result;
}

function validateEchoPair(
  pair: "3-4" | "5-6",
  request: EchoFrameObservation | undefined,
  reply: EchoFrameObservation | undefined,
  failures: string[],
  relativePath: string
): void {
  if (!request || !reply) return;
  if (request.type !== 8 || reply.type !== 0) {
    failures.push(
      `${relativePath}: pair=${pair} должна быть Echo Request type 8 и Reply type 0.`
    );
  }
  if (request.ident !== reply.ident) {
    failures.push(
      `${relativePath}: pair=${pair} имеет несовпадающие request/reply icmp.ident.`
    );
  }
  if (request.sequence !== reply.sequence) {
    failures.push(
      `${relativePath}: pair=${pair} имеет несовпадающие request/reply icmp.seq.`
    );
  }
  if (
    request.ethSrc !== reply.ethDst ||
    request.ethDst !== reply.ethSrc ||
    request.ipSrc !== reply.ipDst ||
    request.ipDst !== reply.ipSrc
  ) {
    failures.push(
      `${relativePath}: pair=${pair} не содержит разворот Ethernet/IPv4 addresses.`
    );
  }
}

function normalizeHeading(value: string): string {
  return value
    .replace(/[`*_]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function isSubstantive(body: string): boolean {
  const content = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[`#>*_[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return content.length >= 12 && /[\p{L}\p{N}]/u.test(content);
}
