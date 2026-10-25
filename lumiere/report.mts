/**
 * Bistrot Lumière's year, as the dashboard's Finances page works it out (packages/shared/src/finance.ts), from the
 * seeded test database — with the checks that the books hold together. Writes report.md next to this file.
 *
 *   npx tsx supabase/seed/lumiere/report.mts      (after ./db.sh start, python3 generate.py out and ./load.sh)
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../..')
const S = await import(join(REPO, 'packages/shared/src/index.ts'))
const RID = 'bistrot-lumiere'

function sql<T>(text: string): T {
  const out = execFileSync(join(HERE, 'psql.sh'), ['-At', '-c', text], { maxBuffer: 1 << 30 }).toString().trim()
  return JSON.parse(out || 'null') as T
}
const rows = <T>(table: string, extra = '') => sql<T[]>(`select coalesce(json_agg(t), '[]') from public."${table}" t where t."restaurantId" = '${RID}' ${extra}`)

// ── What the database holds ──────────────────────────────────────────
const manager = sql<string>(`select to_json(p.id) from public.profiles p where p.email = 'lea.fontaine@example.com'`)
const FROM = '2024-11'
const TO = '2025-12'
const report = S.normalizeFinanceReport(sql(`select public.fin_months('${RID}', '${FROM}', '${TO}') from (select set_config('request.jwt.claim.sub', '${manager}', false)) x`))
const entries = rows<object>('financeEntries').map((e: any) => S.normalizeFinanceEntry(e))
const models = rows<object>('assetModels').map((m: any) => S.normalizeAssetModel(m))
const lots = rows<object>('assetLots').map((l: any) => S.normalizeAssetLot(l))
const items = rows<object>('stockItems').map((i: any) => S.normalizeStockItem(i))
const index = S.indexItems(items)
const stockNow = Math.round(items.reduce((s: number, i: any) => s + S.stockValueCents(i, index), 0))
const settings = S.normalizeFinanceSettings(rows<any>('financeSettings')[0])
const payouts = rows<any>('staffPayouts')
const payroll: Record<string, { grossCents: number; overtimeCents: number; source: 'payouts' }> = {}
for (const p of payouts) {
  const m = p.toDate.slice(0, 7)
  payroll[m] = { grossCents: (payroll[m]?.grossCents ?? 0) + p.grossCents, overtimeCents: 0, source: 'payouts' }
}
const months = S.financeMonths({ months: S.monthsBetween(FROM, TO), report, entries, models, lots, payroll, settings, stockNowCents: stockNow, today: '2025-12-31' })
const period = months.filter((m: any) => m.month >= '2024-12')
const year = period.filter((m: any) => m.month >= '2025-01')
const total = S.combineFigures(period.map((m: any) => m.figures))
const total25 = S.combineFigures(year.map((m: any) => m.figures))
const tax = settings.taxPercent

// ── Formatting ───────────────────────────────────────────────────────
const eur = (c: number) => `${Math.round(c / 100).toLocaleString('fr-FR').replace(/ /g, ' ')} €`
const eur2 = (c: number) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ')} €`
const pct = (r: number | null) => (r === null ? '—' : `${(r * 100).toFixed(1)} %`)
const label = (m: string) => `${['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`
const table = (head: string[], body: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n')

const out: string[] = []
out.push('# Bistrot Lumière — the seeded year (1 Dec 2024 → 31 Dec 2025)')
out.push('')
out.push('Fictional data, loaded into a **test** database through the app’s own functions, then worked out exactly as the dashboard’s *Restaurant → Finances* does (`financeMonths` in `packages/shared/src/finance.ts`). Amounts are euros before VAT unless the line says cash; ≈ marks the settings-based estimates (card fees 0.9 %, VAT on purchases 5.5 % kitchen / 20 % bar, corporate tax 25 %).')
out.push('')

// ── Activity ─────────────────────────────────────────────────────────
const activity = sql<any>(`select json_build_object(
  'tickets', (select count(*) from "posOrders" where "restaurantId" = '${RID}' and status = 'paid'),
  'cancelled', (select count(*) from "posOrders" where "restaurantId" = '${RID}' and status = 'cancelled'),
  'covers', (select sum(covers) from "posOrders" where "restaurantId" = '${RID}' and status = 'paid'),
  'lines', (select count(*) from "posOrderLines" where "restaurantId" = '${RID}' and status <> 'void'),
  'voids', (select count(*) from "posOrderLines" where "restaurantId" = '${RID}' and status = 'void'),
  'comps', (select count(*) from "posOrderLines" where "restaurantId" = '${RID}' and status <> 'void' and "unitCents" = 0),
  'guests', (select count(*) from guests where "restaurantId" = '${RID}'),
  'regulars', (select count(*) from guests g where "restaurantId" = '${RID}' and (select count(*) from "posOrders" o where o."guestId" = g.id and o.status = 'paid') >= 3),
  'bookings', (select count(*) from reservations where "restaurantId" = '${RID}' and source <> 'walk_in'),
  'walkins', (select count(*) from reservations where "restaurantId" = '${RID}' and source = 'walk_in'),
  'noshows', (select count(*) from reservations where "restaurantId" = '${RID}' and status = 'no_show'),
  'bookcancel', (select count(*) from reservations where "restaurantId" = '${RID}' and status = 'cancelled' and source <> 'walk_in'),
  'days', (select count(distinct to_char(to_timestamp("closedAt" / 1000.0) at time zone 'Europe/Paris', 'YYYY-MM-DD')) from "posOrders" where "restaurantId" = '${RID}' and status = 'paid'),
  'purchases', (select count(*) from "purchaseOrders" where "restaurantId" = '${RID}'),
  'batches', (select count(*) from "stockMovements" where "restaurantId" = '${RID}' and kind = 'produce'),
  'wastes', (select count(*) from "stockMovements" where "restaurantId" = '${RID}' and kind = 'waste'),
  'counts', (select count(*) from "stockMovements" where "restaurantId" = '${RID}' and kind = 'count'),
  'shifts', (select count(*) from "staffShifts" where "restaurantId" = '${RID}'),
  'punches', (select count(*) from "timeEntries" where "restaurantId" = '${RID}'),
  'staff', (select count(*) from "staffMembers" where "restaurantId" = '${RID}'),
  'entries', (select count(*) from "financeEntries" where "restaurantId" = '${RID}')
)`)
out.push('## What happened')
out.push('')
out.push(table(['', ''], [
  ['Trading days', activity.days],
  ['Tickets paid / cancelled', `${activity.tickets} / ${activity.cancelled}`],
  ['Covers', activity.covers],
  ['Lines sold / voided / offered', `${activity.lines} / ${activity.voids} / ${activity.comps}`],
  ['Guests on file / came 3 times or more', `${activity.guests} / ${activity.regulars}`],
  ['Bookings / walk-ins / no-shows / cancelled bookings', `${activity.bookings} / ${activity.walkins} / ${activity.noshows} / ${activity.bookcancel}`],
  ['Supplier deliveries recorded', activity.purchases],
  ['House batches made / waste events / count lines', `${activity.batches} / ${activity.wastes} / ${activity.counts}`],
  ['People on the team / shifts planned / punches', `${activity.staff} / ${activity.shifts} / ${activity.punches}`],
  ['Finance entries typed in', activity.entries],
]))
out.push('')

// ── Income statement ─────────────────────────────────────────────────
const isRows: [string, (f: any) => number, boolean?][] = [
  ['Food', (f) => f.food],
  ['Drinks', (f) => f.drinks],
  ['Other income', (f) => f.otherIncome],
  ['**Revenue**', S.revenue, true],
  ['Food cost', (f) => -f.foodCost],
  ['Drinks cost', (f) => -f.drinksCost],
  ['Waste', (f) => -f.waste],
  ['Stock count differences', (f) => -f.shrinkage],
  ['**Gross profit**', S.grossProfit, true],
  ['Wages', (f) => -f.wages],
  ['Employer charges', (f) => -f.charges],
  ['Other staff costs', (f) => -f.otherStaff],
  ['Overheads', (f) => -(S.overheadsTotal(f) - f.cardFees)],
  ['≈ Card fees', (f) => -f.cardFees],
  ['**EBITDA**', S.ebitda, true],
  ['Depreciation', (f) => -f.depreciation],
  ['Gains/losses on equipment', (f) => f.disposals],
  ['**Result before tax**', S.preTaxResult, true],
]
out.push('## Income statement, month by month')
out.push('')
out.push(table(['', ...period.map((m: any) => label(m.month)), 'Total'], isRows.map(([name, fn, bold]) => [name, ...period.map((m: any) => (bold ? `**${eur(fn(m.figures))}**` : eur(fn(m.figures)))), `**${eur(fn(total))}**`])))
out.push('')
out.push(`≈ Corporate tax at ${tax} % on the period’s profit: ${eur(S.taxEstimate(total, tax))} — **net result ${eur(S.netResult(total, tax))}**.`)
out.push('')

// ── KPIs ─────────────────────────────────────────────────────────────
const rev = S.revenue(total25)
out.push('## 2025 at a glance')
out.push('')
out.push(table(['', '2025'], [
  ['Revenue (before VAT)', eur(rev)],
  ['Food cost / food sales', pct(S.ratio(total25.foodCost, total25.food))],
  ['Drinks cost / drinks sales', pct(S.ratio(total25.drinksCost, total25.drinks))],
  ['Gross margin', pct(S.ratio(S.grossProfit(total25), rev))],
  ['Staff costs / revenue', pct(S.ratio(S.staffCosts(total25), rev))],
  ['Prime cost (food, drinks, staff)', pct(S.ratio(S.costOfSales(total25) + S.staffCosts(total25), rev))],
  ['Rent / revenue', pct(S.ratio(total25['overhead.rent'], rev))],
  ['EBITDA margin', pct(S.ratio(S.ebitda(total25), rev))],
  ['Waste / revenue', pct(S.ratio(total25.waste, rev))],
  ['Average ticket (VAT in)', eur2(total25.grossSales / total25.orders)],
  ['Spend per cover (VAT in)', eur2(total25.grossSales / total25.covers)],
]))
out.push('')

// ── Cash flow ────────────────────────────────────────────────────────
const cfRows: [string, (f: any) => number, boolean?][] = [
  ['Cash at the start', (f) => f.cashStart, true],
  ['Takings (card, cash, vouchers)', (f) => f.inCard + f.inCash + f.inOther],
  ['Tips received', (f) => f.inTips],
  ['Other income', (f) => f.inIncome],
  ['Suppliers (stock, VAT in)', (f) => -f.outSuppliers],
  ['Wages & charges', (f) => -f.outWages],
  ['Tips handed out', (f) => -f.outTips],
  ['Overheads & other staff costs', (f) => -(f.outOverheads + f.outStaff)],
  ['≈ Card fees', (f) => -f.outCardFees],
  ['≈ VAT paid', (f) => -f.outVat],
  ['**Cash from operations**', S.operatingCash, true],
  ['Furniture & equipment', S.investingCash],
  ['Owner’s contribution', (f) => f.inCapital],
  ['Deposit (bail) ¹', (f) => -f.outDrawings],
  ['**Net cash flow**', S.netCash, true],
  ['**Cash at the end**', (f) => f.cashEnd, true],
]
out.push('## Cash flow, month by month (VAT in, on the day money moved)')
out.push('')
out.push(table(['', ...period.map((m: any) => label(m.month)), 'Period'], cfRows.map(([name, fn, bold]) => [name, ...period.map((m: any) => (bold ? `**${eur(fn(m.figures))}**` : eur(fn(m.figures)))), `**${eur(fn(total))}**`])))
out.push('')
out.push('¹ Within today’s data model the rent deposit is recorded as money out to the owners’ side (cash only, never the income statement); it is not yet an asset on the balance sheet.')
out.push('')
const lowest = period.reduce((a: any, m: any) => (m.figures.cashEnd < a.figures.cashEnd ? m : a))

// ── Balance sheet ────────────────────────────────────────────────────
const zones = S.assetsByZone(models, lots, '2026-01-01')
const equipment = zones.reduce((s: number, z: any) => s + z.bookCents, 0)
const owns = equipment + total.stockEnd + total.cashEnd
const owes = total.vatOwedEnd + total.unpaidEnd + Math.max(0, total.loansEnd)
out.push('## Balance sheet at 31 December 2025')
out.push('')
out.push(table(['What it owns', ''], [
  ...zones.map((z: any) => [`Equipment — ${z.zone} (cost ${eur(z.costCents)}, depreciated ${eur(z.costCents - z.bookCents)})`, eur(z.bookCents)]),
  ['Stock (kitchen and bar, at average cost)', eur(total.stockEnd)],
  ['Cash and bank', eur(total.cashEnd)],
  ['**Total**', `**${eur(owns)}**`],
]))
out.push('')
out.push(table(['What it owes', ''], [
  ['≈ VAT due for December (paid in January)', eur(total.vatOwedEnd)],
  ['Bills not paid yet (December social charges, energy, water, linen, platform…)', eur(total.unpaidEnd)],
  ['Supplier balances (paid on delivery in today’s model)', eur(0)],
  ['Loans', eur(Math.max(0, total.loansEnd))],
  ['**Total**', `**${eur(owes)}**`],
]))
out.push('')
out.push(`**What the restaurant is worth: ${eur(owns - owes)}** (owner’s capital ${eur(5_000_000)}).`)
out.push('')

// ── Reconciliations ──────────────────────────────────────────────────
const checks: [string, boolean, string][] = []
const db = sql<any>(`select json_build_object(
  'net', (select sum("netCents") from "posOrderLines" l join "posOrders" o on o.id = l."orderId" where o."restaurantId" = '${RID}' and o.status = 'paid' and l.status <> 'void'),
  'cost', (select sum("costCents") from "posOrderLines" l join "posOrders" o on o.id = l."orderId" where o."restaurantId" = '${RID}' and o.status = 'paid' and l.status <> 'void'),
  'saleMoves', (select -sum(case when qty < 0 then -"costCents" else "costCents" end) from "stockMovements" where "restaurantId" = '${RID}' and kind = 'sale'),
  'due', (select sum("dueCents") from "posOrders" where "restaurantId" = '${RID}' and status = 'paid'),
  'paid', (select sum((p->>'amountCents')::bigint) from "posOrders" o, jsonb_array_elements(o.payments) p where o."restaurantId" = '${RID}' and o.status = 'paid'),
  'purchases', (select sum("totalCents") from "purchaseOrders" where "restaurantId" = '${RID}'),
  'receipts', (select sum("costCents") from "stockMovements" where "restaurantId" = '${RID}' and kind = 'receive'),
  'used', (select sum("costCents") from "stockMovements" where "restaurantId" = '${RID}' and kind = 'use'),
  'produced', (select sum("costCents") from "stockMovements" where "restaurantId" = '${RID}' and kind = 'produce'),
  'gross', (select sum("grossCents") from "staffPayouts" where "restaurantId" = '${RID}'),
  'lots', (select sum(qty * "unitCostCents") from "assetLots" where "restaurantId" = '${RID}'),
  'capital', (select sum("amountCents") from "financeEntries" where "restaurantId" = '${RID}' and category = 'capital'),
  'open', (select count(*) from "posOrders" where "restaurantId" = '${RID}' and status = 'open'),
  'seatedLeft', (select count(*) from reservations where "restaurantId" = '${RID}' and status in ('seated', 'confirmed') and date < '2026-01-01')
)`)
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol
checks.push(['Owner’s contribution of €50,000 is the first money in', db.capital === 5_000_000 && period[0].figures.inCapital === 5_000_000, eur(db.capital)])
checks.push(['Sales: the statement’s food + drinks = every paid line’s takings before VAT', near(S.sales(total), db.net, 2), `${eur2(S.sales(total))} vs ${eur2(db.net)}`])
checks.push(['Cost of sales: the statement = the recipes’ cost kept on each line', near(total.foodCost + total.drinksCost, Number(db.cost), 2), `${eur2(total.foodCost + total.drinksCost)} vs ${eur2(Number(db.cost))}`])
checks.push(['Stock out through sales = the lines’ cost', near(Number(db.saleMoves), Number(db.cost), 2), `${eur2(Number(db.saleMoves))} vs ${eur2(Number(db.cost))}`])
checks.push(['Payments taken = amounts due (tips apart)', Number(db.paid) === Number(db.due), `${eur2(Number(db.paid))} vs ${eur2(Number(db.due))}`])
checks.push(['Purchases = what came onto the shelves', near(Number(db.purchases), Number(db.receipts), 2), `${eur2(Number(db.purchases))} vs ${eur2(Number(db.receipts))}`])
checks.push(['House batches: what they took = what they are worth (no value made or lost)', near(Number(db.used), Number(db.produced), 2), `${eur2(Number(db.used))} vs ${eur2(Number(db.produced))}`])
checks.push(['Payroll: wages on the statement = gross pay recorded', near(total.wages, Number(db.gross)), `${eur2(total.wages)} vs ${eur2(Number(db.gross))}`])
checks.push(['Equipment bought = the inventory’s lots', near(total.assetsBought, Number(db.lots)), `${eur2(total.assetsBought)} vs ${eur2(Number(db.lots))}`])
checks.push(['Cash never below zero at a month’s end', lowest.figures.cashEnd >= 0, `lowest ${eur(lowest.figures.cashEnd)} (${label(lowest.month)})`])
checks.push(['No ticket left open, no booking left seated or pending', Number(db.open) === 0 && Number(db.seatedLeft) === 0, `${db.open} open, ${db.seatedLeft} pending`])

// equity: what it is worth = what the owner put in + what it earned − the deposit, give or take what the model leaves out
const vatCredits = months.filter((m: any) => m.month >= '2024-12').reduce((s: number, m: any) => s + Math.max(0, m.figures.vatDeductible - m.figures.vatCollected), 0)
const revaluation = total.stockStart
const expected = 5_000_000 + S.preTaxResult(total) - total.outDrawings - vatCredits + revaluation
checks.push(['Equity: worth = capital + result − deposit − VAT credits not reclaimed + stock revaluation', near(owns - owes, expected, 100), `${eur2(owns - owes)} vs ${eur2(expected)}`])

out.push('## Reconciliations')
out.push('')
out.push(table(['Check', 'Holds', 'Figures'], checks.map(([name, ok, fig]) => [name, ok ? '✅' : '❌', fig])))
out.push('')
out.push(`The equity check spells out what the month-by-month model leaves aside: VAT credits are never reclaimed (${eur(vatCredits)}, mostly December 2024’s equipment), and the stock is valued at today’s average cost, ${eur(revaluation)} away from the sum of its movements.`)
out.push('')

// ── Breakdowns ───────────────────────────────────────────────────────
const dishes = sql<any[]>(`select json_agg(x order by x.net desc) from (select l.name, sum(l.qty) qty, sum(l."netCents") net, sum(l."costCents") cost from "posOrderLines" l join "posOrders" o on o.id = l."orderId"
  where o."restaurantId" = '${RID}' and o.status = 'paid' and l.status <> 'void' and l."unitCents" > 0 group by l.name order by net desc limit 15) x`)
out.push('## Best sellers (before VAT)')
out.push('')
out.push(table(['Dish or drink', 'Sold', 'Takings', 'Cost', 'Margin'], dishes.map((d) => [d.name, d.qty, eur(d.net), eur(Number(d.cost)), pct(1 - Number(d.cost) / d.net)])))
out.push('')
const methods = sql<any[]>(`select json_agg(x) from (select p->>'method' method, count(*) n, sum((p->>'amountCents')::bigint) amount from "posOrders" o, jsonb_array_elements(o.payments) p where o."restaurantId" = '${RID}' and o.status = 'paid' group by 1 order by 3 desc) x`)
const methodName: Record<string, string> = { card: 'Card', cash: 'Cash', other: 'Meal vouchers' }
out.push('## Takings by payment method (VAT in)')
out.push('')
out.push(table(['Method', 'Payments', 'Amount'], methods.map((m) => [methodName[m.method] ?? m.method, m.n, eur(m.amount)])))
out.push('')
const dow = sql<any[]>(`select json_agg(x order by x.d) from (select extract(isodow from to_timestamp("closedAt" / 1000.0) at time zone 'Europe/Paris') d, count(distinct to_char(to_timestamp("closedAt" / 1000.0) at time zone 'Europe/Paris', 'YYYY-MM-DD')) days, sum("dueCents") due, sum(covers) covers
  from "posOrders" where "restaurantId" = '${RID}' and status = 'paid' group by 1) x`)
const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
out.push('## By day of the week (VAT in)')
out.push('')
out.push(table(['Day', 'Days open', 'Takings a day', 'Covers a day'], dow.map((x) => [dayName[x.d], x.days, eur(x.due / x.days), Math.round(x.covers / x.days)])))
out.push('')
const wastes = sql<any[]>(`select json_agg(x order by x.value desc) from (select note reason, count(*) n, round(sum("costCents")) value from "stockMovements" where "restaurantId" = '${RID}' and kind = 'waste' group by note) x`)
out.push('## Waste by reason')
out.push('')
out.push(table(['Reason', 'Events', 'Value'], wastes.map((w) => [w.reason, w.n, eur(Number(w.value))])))
out.push('')
const suppliers = sql<any[]>(`select json_agg(x order by x.total desc) from (select s.name, count(*) n, sum(p."totalCents") total from "purchaseOrders" p join suppliers s on s.id = p."supplierId" where p."restaurantId" = '${RID}' group by s.name) x`)
out.push('## Suppliers (before VAT, all paid on delivery)')
out.push('')
out.push(table(['Supplier', 'Deliveries', 'Bought'], suppliers.map((s) => [s.name, s.n, eur(s.total)])))
out.push('')
const people = sql<any[]>(`select json_agg(x order by x.gross desc) from (select m.name, m."jobTitle" job, m.contract, sum(p."grossCents") gross, sum(p."tipsCents") tips, round(sum(p."workedMinutes") / 60.0) hours, round(sum(p."overtimeMinutes") / 60.0) overtime
  from "staffPayouts" p join "staffMembers" m on m.id = p."staffId" where p."restaurantId" = '${RID}' group by 1, 2, 3) x`)
out.push('## Payroll by person (gross, Dec 2024 → Dec 2025)')
out.push('')
out.push(table(['Person', 'Job', 'Contract', 'Hours worked', 'Of which overtime', 'Gross pay', 'Tips shared'], people.map((p) => [p.name, p.job, p.contract, p.hours, p.overtime, eur(p.gross), eur(p.tips)])))
out.push('')
out.push(`Employer charges were typed in each month (27 % of gross for permanent and fixed-term contracts, 30 % for seasonal and extra) and paid on the 15th of the next month, so December 2025’s are owed at year end. Holiday accrual is outside today’s model.`)
out.push('')

writeFileSync(join(HERE, 'report.md'), out.join('\n') + '\n')
const failed = checks.filter((c) => !c[1])
console.log(`report.md written — ${checks.length - failed.length}/${checks.length} checks hold`)
for (const [name, , fig] of failed) console.log('FAILED', name, fig)
console.log('revenue 2025', eur(rev), '· EBITDA', eur(S.ebitda(total25)), '· pre-tax', eur(S.preTaxResult(total)), '· cash end', eur(total.cashEnd), '· lowest', eur(lowest.figures.cashEnd), label(lowest.month))
