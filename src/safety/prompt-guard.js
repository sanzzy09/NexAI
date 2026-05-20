// This File Generate By NexAi
import crypto from 'crypto';

// Homoglyphs map for Greek/Cyrillic to Latin counterparts
const HOMOGLYPHS = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
  'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Θ': 'Th',
  'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P',
  'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'Ph', 'Χ': 'Ch', 'Ψ': 'Ps', 'Ω': 'O',
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'h', 'θ': 'th',
  'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
  'ρ': 'r', 'σ': 's', 'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
  'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g', 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV',
  'Ⅴ': 'V', 'Ⅵ': 'VI', 'Ⅶ': 'VII', 'Ⅷ': 'VIII', 'Ⅸ': 'IX', 'Ⅹ': 'X'
};

// Zero-width characters & BiDi overrides regex
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g;

export const Severity = {
  SAFE: 'SAFE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const Action = {
  ALLOW: 'allow',
  LOG: 'log',
  WARN: 'warn',
  BLOCK: 'block',
  BLOCK_NOTIFY: 'block_notify'
};

// Patterns aligned with ClawSecurity and OWASP LLM Top 10
export const PATTERNS = {
  // CRITICAL SEVERITY (Severity 4, Action: BLOCK_NOTIFY)
  [Severity.CRITICAL]: {
    dangerous_commands: [
      /rm\s+-rf\b/i,
      /:\(\)\{\s*:\s*\|\s*:\s*&\s*\}\s*;/i, // fork bomb
      /curl\s+.*\s*\|\s*(?:bash|sh)/i,
      /wget\s+.*\s*\|\s*(?:bash|sh)/i,
      />\s*\/dev\/tcp\//i,
      /\bnc\s+-e\b/i,
      /\bsocat\b/i,
      /eval\s*\(\s*["'`].*["'`]\s*\)/i
    ],
    secret_exfiltration: [
      /(?:show|cat|print|read|export|send|dump|output)\s+(?:me\s+)?(?:your\s+)?(?:api[ _]key|token|password|credential|secret|\.env|config)/i,
      /cat\s+\.env\b/i,
      /cat\s+~\/\.clawdbot\b/i,
      /echo\s+\$(?:OPENAI|OPENROUTER|AWS|GCP|JWT|API|SECRET|PASSWORD|TOKEN)[A-Z_]*/i
    ],
    agent_payment_hijack: [
      /(?:transfer|send|pay|redirect).*(?:ETH|BTC|SOL|USDT|USDC|crypto|funds|money).*(?:do not|don't|without|silently|quietly).*(?:notify|log|record)/i,
      /(?:transfer|send|pay|redirect).*(?:ETH|BTC|SOL|USDT|USDC|crypto|funds|money)\s+quietly/i
    ],
    skill_weaponization: [
      /webhook\.site/i,
      /requestbin/i,
      /pipedream/i,
      /ngrok/i,
      /burpcollaborator/i,
      /echo\s+.*\s*>>\s*~\/\.ssh\/authorized_keys/i,
      /authorized_keys\s+append/i,
      /(?:modify|update|poison|overwrite|echo.*>>|write\s+to)\s+(?:SOUL\.md|AGENTS\.md|HEARTBEAT\.md|MEMORY\.md|\.cursor\/rules)/i
    ],
    cloud_credentials: [
      /\b(?:ASIA|AKIA|AROA)[A-Z0-9]{16}\b/i, // AWS key
      /\bAIza[0-9A-Za-z-_]{35}\b/i, // GCP key
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i, // PEM private key
      /\bsk-(?:proj-)?[a-zA-Z0-9]{20,}\b/i, // OpenAI Key
      /\bxox[baprs]-[0-9a-zA-Z]{10,}\b/i // Slack key
    ]
  },
  
  // HIGH SEVERITY (Severity 3, Action: BLOCK)
  [Severity.HIGH]: {
    instruction_override: [
      /\bignore\s+all?\s+(?:previous\s+)?(?:instructions|rules|guidelines|directives)\b/i,
      /\bdisregard\s+your\s+(?:rules|guidelines|safety|system\s+prompt)\b/i,
      /\boverride\s+safety\b/i,
      /\bsystem\s+override\b/i,
      /\byou\s+are\s+now\s+(?:in\s+)?dan\s+mode\b/i,
      /\bnew\s+system\s+prompt\b/i,
      /\blupakan\s+semua\s+(?:perintah|instruksi)\b/i, // Indonesian
      /\babaikan\s+instruksi\b/i, // Indonesian
      /이전\s*지시\s*(?:사항\s*)?무시/i, // Korean
      /前の\s*指示\s*を\s*無視/i, // Japanese
      /忽略\s*之前\s*的\s*指令/i, // Chinese
      /игнорируй\s+предыдущие\s+инструкции/i // Russian
    ],
    system_impersonation: [
      /\[SYSTEM\]\s*:/i,
      /\[ADMIN\]\s*:/i,
      /\bdeveloper\s+override\b/i,
      /\bgodmode\b/i
    ],
    multi_turn_manipulation: [
      /\bremember\s+earlier\s+when\s+you\s+agreed\b/i,
      /\byou\s+previously\s+said\s+it\s+was\s+(?:ok|okay)\b/i,
      /\bas\s+we\s+discussed\b/i,
      /\bpick\s+up\s+where\s+we\s+left\s+off\b/i
    ],
    authority_escalation: [
      /\bEMERGENCY\s+OVERRIDE\b/i,
      /\bDEBUG\s+MODE\b/i,
      /\bMAINTENANCE\s+MODE\b/i,
      /\bSUDO\s+GRANT\b/i
    ]
  },

  // MEDIUM SEVERITY (Severity 2, Action: WARN)
  [Severity.MEDIUM]: {
    role_manipulation: [
      /\bpretend\s+to\s+be\b/i,
      /\bact\s+as\b/i,
      /\byou\s+are\s+now\s+a\b/i,
      /\bpretend\s+you're\b/i
    ],
    sql_injection: [
      /\bUNION\s+SELECT\b/i,
      /\bOR\s+1\s*=\s*1\b/i,
      /;\s*DROP\s+TABLE\b/i
    ],
    path_traversal: [
      /\.\.\/\.\.\//, // ../../
      /(?:%2e%2e%2f){2,}/i // URL encoded ../../
    ],
    pii: [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d{4}[- ]?){3}\d{4}\b/ // Credit card format
    ]
  }
};

export class PromptGuard {
  constructor(config = {}) {
    this.sensitivity = config.sensitivity || 'medium'; // low, medium, paranoid
    this.canaryTokens = config.canaryTokens || [];
    this.cache = new Map(); // Cache normalized message hashes
  }

  // Layer 2: Text Normalization
  normalizeText(text) {
    if (!text) return '';

    // 1. Remove zero-width & invisible characters
    let normalized = text.replace(INVISIBLE_CHARS, '');

    // 2. Homoglyph detection and mapping
    let homoglyphCleared = '';
    for (const char of normalized) {
      homoglyphCleared += HOMOGLYPHS[char] || char;
    }
    normalized = homoglyphCleared;

    // 3. Spacing collapse and comment strip (Token Smuggling Defense)
    // Strip block comments (/**/) and line comments (//)
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // 4. Bracket/Quote reassembly (e.g. "ig" + "nore" -> ignore)
    normalized = normalized.replace(/["']\s*\+\s*["']/g, '');
    normalized = normalized.replace(/\]\s*\[/g, '');

    // 5. Delimiter stripping for split-words (e.g. I+g+n+o+r+e or i g n o r e)
    // Detect and collapse words that are spaced out or hyphenated (e.g. "i g n o r e" -> "ignore")
    // If a text looks like a list of single characters separated by space, dash, plus, underscore
    const splitWordRegex = /\b[a-zA-Z](?:[\s\+\-_][a-zA-Z])+\b/g;
    normalized = normalized.replace(splitWordRegex, (match) => {
      return match.replace(/[\s\+\-_]/g, '');
    });

    // Also support typo corrections for well-known words
    normalized = normalized.replace(/\bingore\b/gi, 'ignore');
    normalized = normalized.replace(/\binstrct\b/gi, 'instruct');

    return normalized;
  }

  // Layer 4: Decoding pipeline
  decodeAll(text) {
    const decodedSet = new Set([text]);

    // Helper to safely add
    const addDecoded = (val) => {
      if (val && val !== text) decodedSet.add(val);
    };

    // 1. URL Decode
    try {
      if (text.includes('%')) {
        addDecoded(decodeURIComponent(text));
      }
    } catch {}

    // 2. Unicode Escape Decode (\u0069)
    try {
      if (/\\u[0-9a-fA-F]{4}/.test(text)) {
        const decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
          return String.fromCharCode(parseInt(grp, 16));
        });
        addDecoded(decoded);
      }
    } catch {}

    // 3. Hex Escape Decode (\x41)
    try {
      if (/\\x[0-9a-fA-F]{2}/.test(text)) {
        const decoded = text.replace(/\\x([0-9a-fA-F]{2})/g, (match, grp) => {
          return String.fromCharCode(parseInt(grp, 16));
        });
        addDecoded(decoded);
      }
    } catch {}

    // 4. HTML Entities
    try {
      if (/&#\d+;/.test(text) || /&[a-zA-Z]+;/.test(text)) {
        const decoded = text.replace(/&#(\d+);/g, (match, grp) => {
          return String.fromCharCode(parseInt(grp, 10));
        }).replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        addDecoded(decoded);
      }
    } catch {}

    // 5. ROT13 Decode
    try {
      // Rotate letters by 13
      const rot13 = (str) => str.replace(/[a-zA-Z]/g, (c) => {
        return String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13));
      });
      addDecoded(rot13(text));
    } catch {}

    // 6. Base64 Decode
    try {
      // Find base64-like substrings (minimum 8 chars, multiple of 4, or typical base64 strings)
      const base64Regex = /\b[A-Za-z0-9+/]{8,}={0,2}\b/g;
      let match;
      while ((match = base64Regex.exec(text)) !== null) {
        const token = match[0];
        try {
          const buf = Buffer.from(token, 'base64');
          const decoded = buf.toString('utf8');
          // If the decoded content looks like legible ASCII/UTF8 text
          if (/^[\x20-\x7E\s\u00A0-\uFFFD]+$/.test(decoded)) {
            addDecoded(decoded);
          }
        } catch {}
      }
    } catch {}

    return Array.from(decodedSet);
  }

  // Layer 0 & 3: Main analysis
  analyze(message) {
    if (!message) {
      return { severity: Severity.SAFE, action: Action.ALLOW, reasons: [], patternsMatched: [] };
    }

    // Layer 0: Size Check (> 50KB)
    if (message.length > 50 * 1024) {
      return {
        severity: Severity.CRITICAL,
        action: Action.BLOCK_NOTIFY,
        reasons: ['message_size_limit_exceeded'],
        patternsMatched: ['Length: ' + message.length + ' chars']
      };
    }

    // Layer 1.5: Cache check
    const normalizedRaw = this.normalizeText(message);
    const hash = crypto.createHash('sha256').update(normalizedRaw).digest('hex');
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    const reasons = [];
    const patternsMatched = [];
    let highestSeverity = Severity.SAFE;

    // Get all decoded variants
    const variants = this.decodeAll(message);
    
    // Scan all variants (plus their normalized forms)
    for (const variant of variants) {
      const normalizedVariant = this.normalizeText(variant);
      const textsToScan = new Set([variant, normalizedVariant]);

      for (const text of textsToScan) {
        // 1. Check Canary Tokens (System prompt leakage detection)
        for (const token of this.canaryTokens) {
          if (text.includes(token)) {
            reasons.push('canary_token_leaked');
            patternsMatched.push(`Canary: ${token.substring(0, 8)}...`);
            highestSeverity = Severity.CRITICAL;
          }
        }

        // 2. Scan regular tiered patterns
        for (const [sev, categories] of Object.entries(PATTERNS)) {
          // If paranoid sensitivity, Medium becomes High, etc.
          let targetSeverity = sev;
          if (this.sensitivity === 'paranoid') {
            if (sev === Severity.MEDIUM) targetSeverity = Severity.HIGH;
          }

          for (const [category, regexList] of Object.entries(categories)) {
            for (const regex of regexList) {
              if (regex.test(text)) {
                reasons.push(`${category}`);
                patternsMatched.push(regex.toString());
                
                // Track highest severity
                if (
                  targetSeverity === Severity.CRITICAL ||
                  (targetSeverity === Severity.HIGH && highestSeverity !== Severity.CRITICAL) ||
                  (targetSeverity === Severity.MEDIUM && highestSeverity === Severity.SAFE)
                ) {
                  highestSeverity = targetSeverity;
                }
              }
            }
          }
        }
      }
    }

    // Determine Action
    let action = Action.ALLOW;
    if (highestSeverity === Severity.CRITICAL) {
      action = Action.BLOCK_NOTIFY;
    } else if (highestSeverity === Severity.HIGH) {
      action = Action.BLOCK;
    } else if (highestSeverity === Severity.MEDIUM) {
      action = Action.WARN;
    } else if (highestSeverity === Severity.LOW) {
      action = Action.LOG;
    }

    const result = {
      severity: highestSeverity,
      action,
      reasons: Array.from(new Set(reasons)),
      patternsMatched: Array.from(new Set(patternsMatched)),
      fingerprint: hash
    };

    // Store in cache
    this.cache.set(hash, result);
    return result;
  }

  // Layer 8 & 9: Enterprise Output DLP
  sanitizeOutput(responseText) {
    if (!responseText) {
      return {
        sanitizedText: responseText,
        wasModified: false,
        redactionCount: 0,
        redactedTypes: [],
        blocked: false
      };
    }

    let sanitizedText = responseText;
    let wasModified = false;
    let redactionCount = 0;
    const redactedTypes = [];

    // Define Credential Redaction patterns
    const dlpRules = [
      { type: 'aws_access_key', regex: /\b(ASIA|AKIA|AROA)[A-Z0-9]{16}\b/g },
      { type: 'gcp_api_key', regex: /\bAIza[0-9A-Za-z-_]{35}\b/g },
      { type: 'openai_key', regex: /\bsk-(?:proj-)?[a-zA-Z0-9]{20,}\b/g },
      { type: 'private_key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi },
      { type: 'slack_token', regex: /\bxox[baprs]-[0-9a-zA-Z]{10,}\b/g }
    ];

    // Redact Canary tokens
    for (const token of this.canaryTokens) {
      if (sanitizedText.includes(token)) {
        const regex = new RegExp(token.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        sanitizedText = sanitizedText.replace(regex, '[REDACTED:canary_token]');
        wasModified = true;
        redactionCount++;
        redactedTypes.push('canary_token');
      }
    }

    // Redact credential formats
    for (const rule of dlpRules) {
      if (rule.regex.test(sanitizedText)) {
        rule.regex.lastIndex = 0; // reset
        sanitizedText = sanitizedText.replace(rule.regex, `[REDACTED:${rule.type}]`);
        wasModified = true;
        redactionCount++;
        redactedTypes.push(rule.type);
      }
    }

    // Post-redaction re-scan: block if still highly critical
    const scanResult = this.analyze(sanitizedText);
    const blocked = scanResult.severity === Severity.CRITICAL;

    return {
      sanitizedText,
      wasModified,
      redactionCount,
      redactedTypes: Array.from(new Set(redactedTypes)),
      blocked,
      scanResult
    };
  }
}
