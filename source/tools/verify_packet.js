#!/usr/bin/env node
/* Offline check of one exported FORGE-TURN-PACKET/v1 or its failure receipt. Does not read the turn store. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const file = process.argv[2];
const fail = detail => { process.stdout.write(JSON.stringify({ schema: 'FORGE-PACKET-VERIFY/v1', ok: false, trusted_ui: false, checks: [], detail: detail }) + '\n'); process.exit(1); };
if (!file) fail('usage: node tools/verify_packet.js <packet.json>');
let packet; try { packet = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail('not JSON'); }
const TP = require(ROOT + '/src/turn_packet.js');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const st = {};
const k = FK.ForgeKernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-27T00:15:00Z', store: K.MemoryStore({ get: x => st[x], set: (a, v) => { st[a] = v; } }) });
const v = TP.verify(packet, { echo: (t, m, vk) => k.kernel.echo(t, m, vk) });
process.stdout.write(JSON.stringify(v) + '\n');
process.exit(v.ok ? 0 : 1);
