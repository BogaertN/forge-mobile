/* KAudit (4.9.212, Release C1): the turn receipt log and its audit check, moved out of forge.js with the same API
 * (forge.receipts(), forge.verifyAudit(), spine.receipt). Each receipt is content-addressed with forge_spine.stableIdentifier and
 * names the previous receipt; verifyAudit re-derives every id and the chain. No behaviour change. No LLM. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const S = isNode ? require('./forge_spine.js') : root.KSpine;
const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
function ReceiptLog(store) {
    const receipts = () => store.load('receipts');
    function receipt(spine, input, reply, at, turn) { const rs = receipts(); const prev = rs.length ? rs[rs.length - 1].receipt_id : null;
      const body = { at: S.utc(at), echo: spine.msm.validation_links[0].external_validation_disposition, eligibility: spine.gates.eligibility, input_event: spine.input_event.metadata.contract_id, msm_manifest: spine.msm.manifest_id, output_sha256: reply ? sha256(reply) : null, previous_receipt: prev, request_contract: spine.request_contract ? spine.request_contract.metadata.contract_id : null, states: spine.request_states.map(s => s.state), turn };
      const rec = Object.assign({ receipt_id: S.stableIdentifier('aiweb.forge-mobile.receipt', body) }, body); rs.push(rec); store.save('receipts', rs.slice(-500)); return rec; }
    function verifyAudit() { const rs = receipts(); let prev = null, bad = []; rs.forEach((r, i) => { const b = Object.assign({}, r); delete b.receipt_id; if (S.stableIdentifier('aiweb.forge-mobile.receipt', b) !== r.receipt_id) bad.push(i); if (i > 0 && r.previous_receipt !== prev) bad.push(i); prev = r.receipt_id; }); return { ok: !bad.length, count: rs.length, broken_at: bad, head: prev }; }
    return { receipts, receipt, verifyAudit }; }
const api = { ReceiptLog };
if (isNode) module.exports = api; else root.KAudit = api;
})(this);
