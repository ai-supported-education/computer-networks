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
        /expected before action/i,
        /action start/i,
        /raw evidence reference/i,
        /observed alpha/i,
        /observed beta/i,
        /inference and unknowns/i
      ],
      references: [".training/evidence/01-02/"]
    },
    {
      relativePath: "evidence/post-check.md",
      headings: [/cleanup action/i, /observed status/i, /final state/i],
      patterns: [
        {
          description: "фактический clean resource count",
          pattern: /(?:containers?|контейнер\w*)\s*[:=]\s*0[\s\S]{0,100}(?:networks?|сет\w*)\s*[:=]\s*0/i
        }
      ]
    }
  ],
  "01-03": [
    {
      relativePath: "frame-map.md",
      headings: [
        /fixture identity/i,
        /frame 1 observations/i,
        /frame 1 boundary arithmetic/i,
        /frame 2 observations/i,
        /frame 2 boundary arithmetic/i,
        /^inference$/i,
        /unknowns and applicability limits/i
      ],
      references: [
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
        }
      ]
    }
  ],
  "01-04": [
    {
      relativePath: "evidence/comparison.md",
      headings: [
        /expected before action/i,
        /cold prediction/i,
        /warm prediction/i,
        /action start and raw evidence/i,
        /cold observations/i,
        /warm observations/i,
        /comparison and inference/i,
        /alternative explanations and variable fields/i,
        /cleanup and post-check/i
      ],
      references: [".training/evidence/01-04/"],
      patterns: [
        {
          description: "ссылки на raw pcap",
          pattern: /(?:cold|warm)[^\n]*\.pcap|\.pcap[^\n]*(?:cold|warm)/i
        },
        {
          description: "neighbor evidence",
          pattern: /neighbou?r|сосед/i
        }
      ]
    }
  ],
  "01-05": [
    {
      relativePath: "diagnosis.md",
      headings: [
        /case a.+interface-not-ready/i,
        /case b.+arp-no-reply/i,
        /case c.+icmp-no-reply/i,
        /cross-case comparison/i
      ],
      references: [
        "fixtures/01-05/interface-not-ready/",
        "fixtures/01-05/arp-no-reply/",
        "fixtures/01-05/icmp-no-reply/"
      ]
    }
  ],
  "01-06": [
    {
      relativePath: "packet-path.md",
      headings: [
        /fixture identity and provenance/i,
        /^source facts$/i,
        /^assumptions$/i,
        /frame inventory/i,
        /causal stages/i,
        /^observations$/i,
        /^inferences$/i,
        /^unknowns$/i,
        /^counterfactual$/i,
        /final bounded conclusion/i,
        /cleanup status/i
      ],
      references: ["fixtures/01-06/novel-local-exchange.pcap"],
      patterns: [
        { description: "frame 1 citation", pattern: /\bframe\s*(?:number\s*)?#?1\b/i },
        { description: "frame 2 citation", pattern: /\bframe\s*(?:number\s*)?#?2\b/i },
        { description: "frame 3 citation", pattern: /\bframe\s*(?:number\s*)?#?3\b/i },
        { description: "frame 4 citation", pattern: /\bframe\s*(?:number\s*)?#?4\b/i },
        { description: "frame 5 citation", pattern: /\bframe\s*(?:number\s*)?#?5\b/i },
        { description: "frame 6 citation", pattern: /\bframe\s*(?:number\s*)?#?6\b/i }
      ]
    }
  ]
};

const PLACEHOLDER =
  /\b(?:TODO|TBD|FIXME)\b|\{\{[^}]*\}\}|<\s*(?:fill|replace|answer)[^>]*>/i;

export async function validateNetworkEvidence(
  sessionDirectory: string,
  sessionId: string
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
    }
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
