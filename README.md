# RouterLens

**➡️ [Open the live app](https://a-denisov-psb.github.io/routerlens/)**

Renders the configuration export of an INSYS icom OS router (flat `key=value` file) as a
readable, icom-OS-like web view. It is a **documentation tool** for maintenance work –
not a management portal: there is no connection to the router and no backend.

## Privacy

Config exports contain plaintext passwords, certificates and private keys. RouterLens
parses the file **locally in the browser**; nothing is uploaded. Network requests from
scripts are blocked via Content Security Policy (`connect-src 'none'`).

## Usage

No build step, no dependencies.

1. Open `index.html` in a browser (double-click works), or serve the folder locally:
   ```
   python3 -m http.server 8000
   ```
   and open <http://localhost:8000>.
2. Drop the exported config file onto the page or use **Open file…**.

A sample export is available in `reference/example_config.txt`.

## Scope

| View | Status | Content |
|---|---|---|
| Dashboard | ✅ | System (hostname, domain, location, device note), firewall status, port → network assignment, cards for IP networks (addresses, DHCP client/server, VLAN, MTU, ports), WAN chains and mobile interfaces, VPN tunnels (IPsec, OpenVPN, GRE, DMVPN, PPTP, PPPoE) |
| Firewall | ✅ | IP filter rule table (direction icons, protocol badges, per-row detail panel, per-column filters, full-text search incl. hidden fields), plus Source NAT and Destination NAT rule tables below it with the same interaction |
| Routing | ✅ | Static routes and OpenVPN server routes (local + pushed to clients), each with a per-row detail panel |

Only configuration state is rendered. Runtime data (serial number, firmware, uptime,
online state, DHCP-assigned addresses) is not part of the export and is therefore not shown.
Secrets (passwords, PSKs, keys) are not rendered in the current views.

## Project structure

```
index.html            App shell (icon rail, top bar), script includes
css/app.css           Styles (light + dark via prefers-color-scheme)
js/parser.js          Config parser (browser global + CommonJS for tests)
js/ui.js              DOM helpers (cards, key/value lists, pills, chips)
js/app.js             View registry, navigation, file loading
js/views/*.js         One file per navigation entry
tests/                Parser tests (node:test)
reference/            Example config + icom OS REST API spec (OpenAPI 9.5)
```

### Parser

`RouterLens.parser.parseConfig(text)` returns a `Config` object:

- `get('a.b[1].c')` – value of a flat key (icom text wrappers like
  `-----BEGIN device_note-----…-----END device_note-----` removed, PEM blocks kept)
- `node('interfaces.ip_nets')` – nested subtree
- `list('netfilter.ip_filter.rule')` – array entries, each with its 1-based `_index`
- `directives` – import instructions (`….delete=all`, `….add=N`), kept apart from values
- `warnings` – e.g. unterminated multi-line values, duplicate keys

Multi-line values are read up to their matching `-----END <label>-----` marker, so
continuation lines may contain `=` (base64 padding, bird config).

Field meanings follow the REST API schemas, e.g. `interfaces.ethernet1.*` ↔
`configuration.interfaces.ethernet1` in `reference/icomOS_REST_API_9.5.json`.

### Adding a view

Create `js/views/<name>.js` and include it in `index.html` after `js/app.js`:

```js
RouterLens.views.register({
  id: 'routing',              // URL hash (#routing)
  label: 'Routing',           // tooltip / page title
  icon: '<svg …>…</svg>',     // 24×24 stroke icon
  render: function (config) { return RouterLens.ui.h('div', null, '…'); },
});
```

## Tests

```
npm test
```
