/*
 * Firewall: table of all netfilter.ip_filter rules with type icons, protocol badges,
 * per-column filters, a global full-text search (incl. fields not shown as columns) and
 * a per-row detail panel for source/destination address, port and IP version.
 */
(function (root) {
  'use strict';

  const Forge = root.Forge;
  const ui = Forge.ui;
  const h = ui.h;

  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3l7 3.5v5c0 4.6-3 8.6-7 9.5-4-.9-7-4.9-7-9.5v-5z"/><path d="m9 12 2 2 4-4"/></svg>';

  /* ---------- Type icons (input / output / forward) ---------- */

  const DIRECTION_LABEL = { input: 'Input', output: 'Output', forward: 'Forward' };

  const DIRECTION_ICON = {
    input: '<path d="M1 8h8"/><path d="m6 4 4 4-4 4"/><path d="M13 3v10"/>',
    output: '<path d="M3 3v10"/><path d="M3 8h9"/><path d="m8 4 4 4-4 4"/>',
    forward: '<path d="M2 8h12"/><path d="m5 5-3 3 3 3"/><path d="m11 5 3 3-3 3"/>',
  };

  function directionIcon(direction) {
    if (ui.isUnset(direction)) return h('span', { class: 'muted' }, ui.EMPTY);
    const label = DIRECTION_LABEL[direction] || direction;
    const path = DIRECTION_ICON[direction];
    if (!path) return h('span', null, label);
    return h('span', { class: 'type-icon', title: label, 'aria-label': label },
      h('span', {
        'aria-hidden': 'true',
        html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>',
      }));
  }

  /* ---------- Protocol badges ---------- */

  const KNOWN_PROTOCOLS = ['tcp', 'udp', 'icmp', 'icmpv6', 'esp', 'all'];
  const PROTOCOL_LABEL = { icmpv6: 'ICMPv6' };

  function protocolBadge(protocol) {
    if (ui.isUnset(protocol)) return h('span', { class: 'muted' }, ui.EMPTY);
    const known = KNOWN_PROTOCOLS.indexOf(protocol) !== -1;
    const label = PROTOCOL_LABEL[protocol] || protocol.toUpperCase();
    return h('span', { class: 'badge badge-' + (known ? protocol : 'other') }, label);
  }

  /* ---------- From/To interface chips ---------- */

  function ifaceChip(name, netsByName) {
    if (name === 'all') return h('span', { class: 'chip chip-all' }, h('span', { class: 'chip-dot' }), 'All');
    const net = netsByName[name];
    return h('span', { class: 'chip', style: net && net.color ? { '--chip': net.color } : null, title: net ? net.description : null },
      h('span', { class: 'chip-dot' }), name);
  }

  function ifaceChips(value, netsByName) {
    if (ui.isUnset(value)) return h('span', { class: 'muted' }, ui.EMPTY);
    return value.split(',').map(function (n) { return n.trim(); }).filter(Boolean)
      .map(function (n) { return ifaceChip(n, netsByName); });
  }

  /* ---------- Detail panel (fields not shown as a column) ---------- */

  function portRange(start, end) {
    if (ui.isUnset(start)) return ui.isUnset(end) ? undefined : end;
    if (ui.isUnset(end) || end === start) return start;
    return start + '–' + end;
  }

  function detailPanel(rule) {
    const body = ui.kvList([
      ['Source address', ui.formatCidr(rule.rule_saddr, rule.rule_snetmask)],
      ['Source port', portRange(rule.rule_sport, rule.rule_sport_end)],
      ['Destination address', ui.formatCidr(rule.rule_daddr, rule.rule_dnetmask)],
      ['Destination port', portRange(rule.rule_dport, rule.rule_dport_end)],
      ['IP version', rule.rule_ipversion],
      ['Rule name', rule.rule_name],
    ]);
    return body || ui.emptyNote('No further settings for this rule.');
  }

  /* ---------- Filters ---------- */

  function distinctValues(rules, field) {
    const seen = new Set();
    rules.forEach(function (r) { if (!ui.isUnset(r[field])) seen.add(r[field]); });
    return Array.from(seen).sort();
  }

  function filterSelect(label, options, allLabel) {
    return h('select', { class: 'ff-filter', 'aria-label': label },
      h('option', { value: '' }, allLabel),
      options.map(function (o) { return h('option', { value: o.value }, o.label); }));
  }

  /** Lower-cased text of every string field on the rule, including ones not shown as a column. */
  function ruleSearchText(rule) {
    return Object.keys(rule)
      .filter(function (k) { return k !== '_index' && typeof rule[k] === 'string'; })
      .map(function (k) { return rule[k]; })
      .concat(String(rule._index))
      .join(' ')
      .toLowerCase();
  }

  function render(config) {
    const rules = config.list('netfilter.ip_filter.rule');
    if (!rules.length) {
      return h('div', { class: 'firewall' }, ui.card({ title: 'Firewall rules', body: ui.emptyNote('No IP filter rules in this config.') }));
    }

    const netsByName = {};
    config.list('interfaces.ip_nets.net').forEach(function (n) { netsByName[n.name] = n; });

    const search = h('input', { type: 'search', class: 'ff-search', placeholder: 'Search all rule fields…', 'aria-label': 'Search all rule fields' });
    const activeFilter = filterSelect('Filter by active state', [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], 'All');
    const directionFilter = filterSelect('Filter by type', distinctValues(rules, 'rule_direction').map(function (v) { return { value: v, label: DIRECTION_LABEL[v] || v }; }), 'All');
    const protocolFilter = filterSelect('Filter by protocol', distinctValues(rules, 'rule_protocol').map(function (v) { return { value: v, label: PROTOCOL_LABEL[v] || v.toUpperCase() }; }), 'All');
    const fromFilter = h('input', { type: 'text', class: 'ff-filter', placeholder: '…', 'aria-label': 'Filter by "from" interface' });
    const toFilter = h('input', { type: 'text', class: 'ff-filter', placeholder: '…', 'aria-label': 'Filter by "to" interface' });
    const descFilter = h('input', { type: 'text', class: 'ff-filter', placeholder: '…', 'aria-label': 'Filter by description' });

    const resultCount = h('span', { class: 'ff-count' }, rules.length + ' rules');

    const entries = rules.map(function (rule) {
      const detail = h('tr', { class: 'rule-detail', hidden: true }, h('td', { colspan: '7' }, detailPanel(rule)));
      const tr = h('tr', {
        class: 'rule-row',
        tabindex: '0',
        role: 'button',
        'aria-expanded': 'false',
      },
        h('td', { class: 'muted' }, String(rule._index)),
        h('td', null, rule.rule_active === undefined ? h('span', { class: 'muted' }, ui.EMPTY) : ui.statusPill(rule.rule_active)),
        h('td', null, directionIcon(rule.rule_direction)),
        h('td', null, protocolBadge(rule.rule_protocol)),
        h('td', null, ifaceChips(rule.rule_input_if, netsByName)),
        h('td', null, ifaceChips(rule.rule_output_if, netsByName)),
        h('td', null, ui.isUnset(rule.rule_description) ? h('span', { class: 'muted' }, ui.EMPTY) : rule.rule_description));

      function toggle() {
        const willOpen = detail.hidden;
        detail.hidden = !willOpen;
        tr.classList.toggle('open', willOpen);
        tr.setAttribute('aria-expanded', String(willOpen));
      }
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggle();
      });

      return { rule: rule, searchText: ruleSearchText(rule), tr: tr, detail: detail };
    });

    function applyFilters() {
      const q = search.value.trim().toLowerCase();
      const direction = directionFilter.value;
      const protocol = protocolFilter.value;
      const active = activeFilter.value;
      const from = fromFilter.value.trim().toLowerCase();
      const to = toFilter.value.trim().toLowerCase();
      const desc = descFilter.value.trim().toLowerCase();

      let visible = 0;
      entries.forEach(function (entry) {
        const r = entry.rule;
        const matches = (!q || entry.searchText.indexOf(q) !== -1) &&
          (!direction || r.rule_direction === direction) &&
          (!protocol || r.rule_protocol === protocol) &&
          (!active || ui.isOn(r.rule_active) === (active === '1')) &&
          (!from || (r.rule_input_if || '').toLowerCase().indexOf(from) !== -1) &&
          (!to || (r.rule_output_if || '').toLowerCase().indexOf(to) !== -1) &&
          (!desc || (r.rule_description || '').toLowerCase().indexOf(desc) !== -1);
        entry.tr.hidden = !matches;
        if (!matches) {
          entry.detail.hidden = true;
          entry.tr.classList.remove('open');
          entry.tr.setAttribute('aria-expanded', 'false');
        } else {
          visible++;
        }
      });
      resultCount.textContent = visible === entries.length ? entries.length + ' rules' : visible + ' / ' + entries.length + ' rules';
    }

    [search, activeFilter, directionFilter, protocolFilter, fromFilter, toFilter, descFilter].forEach(function (el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    });

    const tbody = h('tbody', null, entries.map(function (entry) { return [entry.tr, entry.detail]; }));

    const table = h('table', { class: 'table table-firewall' },
      h('thead', null,
        h('tr', null,
          h('th', null, 'Nr.'), h('th', null, 'Active'), h('th', null, 'Type'), h('th', null, 'Protocol'),
          h('th', null, 'From'), h('th', null, 'To'), h('th', null, 'Description')),
        h('tr', { class: 'ff-filter-row' },
          h('th', null), h('th', null, activeFilter), h('th', null, directionFilter), h('th', null, protocolFilter),
          h('th', null, fromFilter), h('th', null, toFilter), h('th', null, descFilter))),
      tbody);

    return h('div', { class: 'firewall' },
      ui.card({
        title: 'Firewall rules',
        className: 'card-firewall',
        body: [
          h('div', { class: 'firewall-toolbar' }, search, resultCount),
          h('div', { class: 'table-wrap' }, table),
        ],
      }));
  }

  Forge.views.register({ id: 'firewall', label: 'Firewall', icon: ICON, render: render });
})(window);
