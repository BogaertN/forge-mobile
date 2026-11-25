/* 4.9.241 speech-act lexicon, the phone's copy (Nic: natural conversation; plan 229 step 10). No model, no phrase book.
 * DATA is engine/rmc_engine_v1/speech_acts.json (suite-checked equal): each act is a meaning (its forms, the act that
 * answers it, its kāraka frame), never a reply line. classify() is the mirror of speech_acts.classify; realize() builds the
 * surface of a response act from that act's own forms (a reciprocal act in the asker's form); compile() is the outward
 * compile of a speech-act atom: realize, re-read with classify, and require the same single act (the round trip). */
(function (root) {
  const DATA = {
 "schema": "forge.speech_acts/v1",
 "about": "General English conversational acts (adjacency pairs). Each entry is a meaning: the act, the surface forms that perform it, the act that answers it, and its kāraka frame (speaker and listener are the participants). No reply line is stored: a reply is the expected response act, realized from that act's own forms. Mirrored in src/speech_acts.js (suite-checked).",
 "participants": {
  "speaker": "the one who performs the act",
  "listener": "the one it is addressed to"
 },
 "acts": {
  "greet": {
   "gloss": "open contact with the listener",
   "forms": [
    {
     "form": "hello"
    },
    {
     "form": "hi"
    },
    {
     "form": "hey"
    },
    {
     "form": "greetings"
    },
    {
     "form": "good morning"
    },
    {
     "form": "good afternoon"
    },
    {
     "form": "good evening"
    }
   ],
   "response": "greet",
   "answered_by": "act",
   "frame": {
    "kriya": "greet",
    "kartr": "speaker",
    "karma": "listener"
   }
  },
  "farewell": {
   "gloss": "close contact with the listener",
   "forms": [
    {
     "form": "bye"
    },
    {
     "form": "goodbye"
    },
    {
     "form": "good bye"
    },
    {
     "form": "bye bye"
    },
    {
     "form": "farewell"
    },
    {
     "form": "see you"
    },
    {
     "form": "see you later"
    },
    {
     "form": "good night"
    }
   ],
   "response": "farewell",
   "answered_by": "act",
   "frame": {
    "kriya": "part",
    "kartr": "speaker",
    "apadana": "listener"
   }
  },
  "thank": {
   "gloss": "credit the listener for a prior act",
   "forms": [
    {
     "form": "thanks"
    },
    {
     "form": "thank you"
    },
    {
     "form": "thanks a lot"
    },
    {
     "form": "thank you very much"
    },
    {
     "form": "many thanks"
    }
   ],
   "response": "acknowledge",
   "answered_by": "act",
   "frame": {
    "kriya": "thank",
    "kartr": "speaker",
    "karma": "listener",
    "hetu": "prior act of the listener"
   }
  },
  "apologize": {
   "gloss": "take responsibility to the listener for a prior act",
   "forms": [
    {
     "form": "sorry"
    },
    {
     "form": "i'm sorry"
    },
    {
     "form": "i am sorry"
    },
    {
     "form": "i apologize"
    },
    {
     "form": "my apologies"
    }
   ],
   "response": "acknowledge",
   "answered_by": "act",
   "frame": {
    "kriya": "apologize",
    "kartr": "speaker",
    "sampradana": "listener",
    "hetu": "prior act of the speaker"
   }
  },
  "ask_wellbeing": {
   "gloss": "ask the state of the listener",
   "forms": [
    {
     "form": "how are you"
    },
    {
     "form": "how are you doing"
    },
    {
     "form": "how is it going"
    },
    {
     "form": "how's it going"
    }
   ],
   "response": "report_state",
   "answered_by": "frame",
   "frame": {
    "kriya": "be",
    "kartr": "listener",
    "prakara": "gap",
    "wh": "how"
   }
  },
  "ask_help": {
   "gloss": "ask what the listener can do for the speaker",
   "forms": [
    {
     "form": "help"
    },
    {
     "form": "help me"
    },
    {
     "form": "i need help"
    },
    {
     "form": "can you help me"
    },
    {
     "form": "can you help"
    }
   ],
   "response": "report_capability",
   "answered_by": "frame",
   "frame": {
    "kriya": "do",
    "kartr": "listener",
    "karma": "gap",
    "modality": "able",
    "wh": "what"
   }
  },
  "acknowledge": {
   "gloss": "accept the listener's prior act; ends the pair",
   "forms": [
    {
     "form": "you're welcome",
     "of": "thank"
    },
    {
     "form": "you are welcome",
     "of": "thank"
    },
    {
     "form": "that's all right",
     "of": "apologize"
    },
    {
     "form": "that is all right",
     "of": "apologize"
    },
    {
     "form": "no problem"
    },
    {
     "form": "okay"
    },
    {
     "form": "ok"
    },
    {
     "form": "all right"
    },
    {
     "form": "got it"
    }
   ],
   "response": null,
   "answered_by": "none",
   "frame": {
    "kriya": "acknowledge",
    "kartr": "speaker",
    "karma": "prior act of the listener"
   }
  }
 }
};
  const BOUNDARY = new Set([',', '.', '!', '?', ';', ':']);
  const norm = t => String(t == null ? '' : t).replace(/[\u2018\u2019]/g, "'").toLowerCase();
  function tokens(text) { const out = [], re = /[a-z0-9']+|[,.!?;:]/g, s = norm(text); let m; while ((m = re.exec(s))) out.push([m[0], m.index, m.index + m[0].length]); return out; }
  let FORMS = null;
  function forms() {
    if (FORMS) return FORMS; const out = [];
    for (const [act, e] of Object.entries(DATA.acts)) for (const f of e.forms || []) out.push([String(f.form).split(' '), act, f]);
    /* longest form first; a stable sort keeps the lexicon order among forms of one length (the same as Python's sort) */
    FORMS = out.map((x, i) => [x, i]).sort((a, b) => (b[0][0].length - a[0][0].length) || (a[1] - b[1])).map(x => x[0]); return FORMS;
  }
  function classify(text) {
    const toks = tokens(text), words = toks.filter(t => !BOUNDARY.has(t[0]));
    const acts = []; let i = 0, endChar = 0;
    while (i < toks.length) {
      while (i < toks.length && BOUNDARY.has(toks[i][0])) i++;
      if (i >= toks.length) break;
      let hit = null;
      for (const [form, act, rec] of forms()) { const n = form.length; const seg = toks.slice(i, i + n).map(t => t[0]);
        if (seg.length === n && seg.every((w, k) => w === form[k]) && (i + n === toks.length || BOUNDARY.has(toks[i + n][0]))) { hit = [form, act, rec, n]; break; } }
      if (!hit) break;
      const [form, act, rec, n] = hit;
      acts.push({ act, form: form.join(' '), of: rec.of || null, start: toks[i][1], end: toks[i + n - 1][2] });
      endChar = toks[i + n - 1][2]; i += n;
    }
    const rest = acts.length ? String(text || '').slice(endChar).replace(/^[\s,.!?;:]+/, '') : String(text || '').trim();
    const covered = acts.reduce((s, a) => s + a.form.split(' ').length, 0);
    return { schema: DATA.schema, acts, rest, pure: acts.length > 0 && !rest.trim(), words: words.length, covered, match: words.length ? Math.round(covered / words.length * 1e6) / 1e6 : 0, calls_llm: false };
  }
  const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : '';
  /* the surface of a response act: a reciprocal act in the asker's own form; another act in its form that names the act
   * it answers, or its first general form */
  function realize(responseAct, ofAct, askerForm) {
    const e = DATA.acts[responseAct]; if (!e) return null;
    if (responseAct === ofAct) { const ok = (e.forms || []).some(f => f.form === askerForm); return ok ? cap(askerForm) : null; }
    const named = (e.forms || []).filter(f => f.of === ofAct), general = (e.forms || []).filter(f => !f.of);
    const pick = (named.length ? named : general)[0]; return pick ? cap(pick.form) : null;
  }
  function respond(a) {
    const e = DATA.acts[a.act] || {}; if (e.answered_by !== 'act' || !e.response) return null;
    const text = realize(e.response, a.act, a.form); return text ? { act: a.act, response_act: e.response, text } : null;
  }
  /* outward compile of speech_act(response act, act answered): realized here, re-read, and the re-read must be exactly
   * that one act (nothing else) and, for a reciprocal act, the asker's form */
  function compile(text, atom) {
    const rec = { schema: 'forge.outward/v1', text: String(text || ''), ok: false, step: null, R_t: null, calls_llm: false, compiler: 'src/speech_acts.js' };
    if (!atom || atom.predicate !== 'speech_act' || !Array.isArray(atom.args) || atom.args.length !== 2) return Object.assign(rec, { step: 'atom' });
    const R_t = realize(atom.args[0], atom.args[1], atom.form);
    if (!R_t) return Object.assign(rec, { step: 'realize' });
    const c = classify(R_t);
    if (!(c.pure && c.acts.length === 1 && c.acts[0].act === atom.args[0] && c.match === 1 && (!c.acts[0].of || c.acts[0].of === atom.args[1]))) return Object.assign(rec, { step: 'roundtrip', realized: R_t });
    return Object.assign(rec, { ok: true, step: 'compiled', R_t, roundtrip: true, act: atom.args[0], of: atom.args[1] });
  }
  const api = { DATA, classify, realize, respond, compile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KSpeechActs = api;
})(typeof self !== 'undefined' ? self : this);
