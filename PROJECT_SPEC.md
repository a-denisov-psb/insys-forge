# INSYS icom OS Config Renderer

## Zweck

Techniker exportieren bei Wartungsarbeiten die Konfiguration von INSYS-Routern
(icom OS). Diese Exportdatei ist ein flaches `key=value`-Format und für
Menschen schwer lesbar. Dieses Tool rendert die Config visuell so, wie sie in
der icom OS Web-GUI dargestellt würde — als **Dokumentation**, nicht als
Live-Verwaltungstool.

**Wichtige Abgrenzung:** Dies ist NICHT das später geplante Verwaltungsportal
(REST-API, Live-Status, Firmware-Upload, Fernsteuerung). Das ist ein separates
Projekt und hat mit diesem Tool keine gemeinsame Codebasis. Dieses Tool
arbeitet ausschließlich mit einer lokal hochgeladenen Config-Datei, keiner
Netzwerkverbindung zum Router.

## Zielgruppe

Der Entwickler selbst / Kollegen, die beim Kunden Wartung machen und schnell
nachvollziehen wollen, wie ein Router konfiguriert ist, ohne sich am Gerät
selbst durchzuklicken.

## Tech-Stack (bewusst schlank)

- Reines HTML/CSS/JavaScript, kein Framework, kein Build-Step
- Läuft lokal im Browser (Datei öffnen oder einfacher lokaler Server),
  keine Backend-Anbindung
- Parsing der Config passiert clientseitig im Browser
- Kein Upload zu einem Server — Datenschutz: Config enthält Zertifikate,
  private Keys, Klartext-Passwörter

## Datenquelle: Config-Format

Beispiel-Export liegt vor (`example_config.txt`). Format:

```
section.subsection.key=value
section.array[1].key=value
section.array[2].key=value
```

Mehrzeilige Werte (z.B. PEM-Zertifikate) bestehen aus einer `key=` Zeile,
gefolgt von Zeilen ohne `=`, die zum vorherigen Wert gehören.

**Referenz für Feldbedeutung/-struktur:** Die REST-API-Spezifikation
(`icomOS_REST_API_9_5.json`, OpenAPI 9.5) liegt bei. Die Config-Keys
entsprechen weitgehend den Schema-Namen der API (z.B.
`interfaces.ethernet1.*` ↔ Schema `configuration.interfaces.ethernet1`).
Bei Unklarheiten über ein Feld dort nachschlagen.

## Kernprinzip: nur rendern, was aus der Config kommen kann

Die Config enthält **Konfigurationszustand**, keinen **Live-Betriebszustand**.
Felder, die nur zur Laufzeit am Gerät existieren (Seriennummer, Firmware-
Version, Uptime, tatsächlicher Online-Status einer Verbindung, per DHCP
bezogene IP) sind in der Config NICHT enthalten und werden im UI komplett
weggelassen — kein Hartcoding von "n/a"-Platzhaltern für Dinge, die nie
befüllt werden können.

## Scope v1

Zwei Ansichten, erreichbar über eine schmale linke Icon-Navigationsleiste
(visuell angelehnt an icom OS, aber eigenständig, kein 1:1-Klon). Weitere
Menüpunkte kommen später dazu — die Navigation muss dafür erweiterbar sein.

### 1. Dashboard

Angelehnt an die icom OS Übersichtsseite, aber nur mit Config-Daten gefüllt:

- **Geräte-/Port-Übersicht:** Ports und das ihnen zugeordnete Netz
  (aus `interfaces.ethernet1.portX_active`), keine grafische Slot-Simulation
  nötig — eine einfache Liste/Tabelle Port → Netz reicht.
- **System:** Hostname, Standort, Gerätenotiz (aus `administration.*`
  bzw. den entsprechenden System-Keys in der Config)
- **Netzwerk-Konfiguration:** Karten pro LAN/WAN/VPN-Eintrag mit den
  konfigurierten Werten: IP-Adresse, Netzmaske, DHCP-Client/Server aktiv,
  Beschreibung. Das ist der eigentliche Kernzweck des Tools — diese Infos
  sollen prominent und vollständig sein.
- Firewall-Aktiv-Status (IPv4/IPv6/MAC-Filter) als kompakte Anzeige,
  z.B. oben auf der Firewall-Seite (siehe unten) oder als Kachel im
  Dashboard — Entscheidung offen, kein Show-Stopper.

Referenz-Screenshot vom Original-Dashboard liegt im Gesprächsverlauf vor
(icom OS 9.5 Web-GUI) — bei Bedarf nachfragen, Details wurden im Chat
besprochen.

### 2. Firewall

Tabelle aller IP-Filter-Regeln aus `netfilter.ip_filter.rule[n].*`.

Sichtbare Spalten (angelehnt an Original-GUI):

| Spalte | Config-Feld |
|---|---|
| Nr. | Array-Index |
| Aktiv | `rule_active` |
| Typ | `rule_direction` (input/output/forward) |
| Protokoll | `rule_protocol` |
| Von | `rule_input_if` |
| Nach | `rule_output_if` |
| Beschreibung | `rule_description` |

Nicht in der Tabelle sichtbare, aber in der Config vorhandene Felder
(Quell-/Ziel-IP+Maske, Quell-/Zielport(-bereich), IP-Version, interner
Regelname) werden in einem **Detailbereich** angezeigt, der sich beim Klick
auf eine Zeile öffnet.

**Design-Vorgaben:**

- Typ-Spalte (INPUT/OUTPUT/FORWARD) als **Icons** statt Text darstellen
  (z.B. Pfeil rein / Pfeil raus / zwei durchlaufende Pfeile) — besser
  scanbar als Text.
- Protokoll (TCP/UDP/ICMP/...) als farblich unterschiedene Badges statt
  reiner Text.
- Von/Nach bei mehreren Netzen (`net1,net2,openvpn...`) als kleine
  Chips/Tags statt Komma-getrennter Text, damit nichts abgeschnitten wird.
- Aktiv-Spalte: grüner Haken / grauer Kreis (wie Original).

**Filter/Suche:**

- Ein globales Suchfeld über der Tabelle UND pro Spalte ein eigenes
  Filterfeld/Dropdown — beides gleichzeitig nutzbar.
- Das globale Suchfeld durchsucht **alle** Felder aus der Config zu jeder
  Regel, auch die nicht sichtbaren, nur im Detailbereich gezeigten
  Eigenschaften (z.B. Port, IP-Adresse, IP-Version). Eine Suche nach `80`
  muss also auch Regeln mit `rule_dport=80` finden, obwohl Port nicht als
  Spalte sichtbar ist.

## Sicherheit / Sensible Daten

Die Config enthält Klartext-Passwörter, Zertifikate und private Keys.

- Es findet **kein Netzwerk-Upload** statt, alles bleibt im Browser
  (clientseitiges Parsing).
- Wie sensible Felder in der UI dargestellt werden (maskiert/einblendbar)
  ist für Dashboard/Firewall in v1 noch nicht final entschieden — betrifft
  primär spätere Sektionen (z.B. Zertifikate, VPN-Zugangsdaten). Für v1
  (Dashboard + Firewall) nicht kritisch, da hier keine Klartext-Secrets
  in den gerenderten Feldern vorkommen — bei Erweiterung um weitere
  Sektionen erneut prüfen.

## Projekt-Setup-Erwartung

- Git-Repository mit sinnvoller Struktur (kein Monolith-HTML zwingend,
  aber auch kein Overengineering — siehe Tech-Stack)
- README.md, die das Produkt beschreibt (Zweck, Scope, wie man es lokal
  öffnet/nutzt)
- Struktur so anlegen, dass spätere Menüpunkte/Sektionen (weitere
  Config-Bereiche wie Routing, Services, Administration) ohne größeren
  Umbau ergänzt werden können

## Beiliegende Referenzdateien

- `example_config.txt` — reale Beispiel-Config zum Testen des Parsers
  (enthält auch Edge Cases: Arrays, mehrzeilige PEM-Werte, leere Felder)
- `icomOS_REST_API_9_5.json` — OpenAPI-Spezifikation als Nachschlagewerk
  für Feldbedeutungen und Struktur

## Offene Punkte (bewusst noch nicht entschieden)

- Reihenfolge/Priorisierung weiterer Sektionen nach Dashboard + Firewall
- PDF-Export (später: Browser-Druckdialog vs. JS-Bibliothek)
- Darstellung sensibler Daten in weiteren Sektionen (Zertifikate, VPN-Keys)
- Genaue Platzierung des Firewall-Aktiv-Status (Dashboard-Kachel vs.
  Firewall-Seitenkopf)
