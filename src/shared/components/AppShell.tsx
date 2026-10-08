/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Boxes, ChevronDown, ChevronRight, LayoutDashboard, LogOut, Menu, PackagePlus, ReceiptText, Route, ShieldCheck, Thermometer, Users, KeyRound, Warehouse, Handshake, FileCheck2, Landmark, Radar, LockKeyhole, UserRound, Settings, BarChart3, Building2 } from 'lucide-react'; // REQ-CNF-001..007 Building2
import { api, currentUser } from '@/shared/services/api';
import { can, useMe } from '@/modules/hr/hr';
// REQ-PLT-002 branding, REQ-PLT-016 support view, REQ-PLT-015 language and accessibility, REQ-PLT-003 notification bell
import { useBranding } from '@/modules/platform/branding';
import { SupportBanner } from '@/modules/platform/support';
import { usePlatform } from '@/modules/platform/platform';
import { usePrefs } from '@/shared/i18n/PrefsProvider';
import { SkipLink } from '@/shared/a11y/SkipLink';
import { NotificationBell } from '@/modules/platform/NotificationBell';

export function AppShell() {
  const { t } = usePrefs();
  const brand = useBranding();
  const platform = usePlatform();
  const user = currentUser();
  const role = String(user.role || user.roleCode || 'EMPLOYEE').replace('ROLE_', '').toUpperCase();
  // REQ-HR-001: a role made in Access Control (HR, BILLING, WAREHOUSE_MANAGER ...) works at the level of its base role
  // (EMPLOYEE, MANAGER or ADMIN); the menu follows the base role and hides what the role has no permission for.
  const base = String(user.baseRole || role).replace('ROLE_', '').toUpperCase();
  const admin = base === 'ADMIN', manager = base === 'MANAGER', employee = base === 'EMPLOYEE';
  const me = useMe();
  // Until /api/access/me answers (or before database_v2/56 is run) every section shows as before.
  const may = (...perms: string[]) => admin || !me || !me.ready || can(me, ...perms);
  const hrAny = admin || (!!me && can(me, 'HR_EMPLOYEES', 'HR_ATTENDANCE', 'HR_LEAVE_APPROVE', 'HR_PAYROLL', 'HR_PAYROLL_APPROVE', 'HR_LETTERS', 'HR_DOCUMENTS', 'HR_WORK_EMAIL', 'DRIVER_SAFETY_VIEW', 'HR_RECRUITMENT'));
  const staff = (admin || manager || employee) && !(String(user.loginType || user.userType || '').toUpperCase() === 'PARTNER' || role === 'PARTNER');
  // REQ-CC-003-FIX1: a Partner login (a customer of RefTech) gets its own short menu for load requests.
  const partnerLogin = String(user.loginType || user.userType || '').toUpperCase() === 'PARTNER' || role === 'PARTNER';
  // REQ-TRP-006: a driver login has its own page; the office menu and its pages answer 403 for it.
  const driverLogin = role === 'DRIVER';
  const [profile, setProfile] = useState<any>({});
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('reftech_sidebar_collapsed') === '1');
  const setCollapsed = (v:boolean) => { setSidebarCollapsed(v); localStorage.setItem('reftech_sidebar_collapsed', v ? '1' : '0'); };
  const toggle = (k: string) => setOpen(x => ({ ...x, [k]: !x[k] }));
  const location = useLocation();

  useEffect(() => {
    if (driverLogin) { window.location.replace('/driver'); return; }
    if (role === 'TRANSPORTER') { window.location.replace('/transporter'); return; } // REQ-TAL-009: the transporter portal is outside the office menu
    api('/api/operations/profile').then((p: any) => {
      setProfile(p || {});
      if (p?.firstName || p?.lastName) {
        const merged = { ...user, ...p };
        localStorage.setItem('reftech_user', JSON.stringify(merged));
      }
    }).catch(() => {});
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let lastActivity=Date.now(); const mark=()=>{lastActivity=Date.now()}; const events=['mousemove','mousedown','keydown','touchstart','scroll']; events.forEach(e=>window.addEventListener(e,mark,{passive:true}));
    const idle=setInterval(()=>{if(Date.now()-lastActivity>=10*60*1000){api('/api/auth/logout',{method:'POST'}).catch(()=>{}).finally(()=>{localStorage.clear();window.location.href='/login?reason=inactive'});}},15000);
    return ()=>{clearInterval(idle);events.forEach(e=>window.removeEventListener(e,mark));};
  }, []);

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  if (driverLogin) return null;

  const firstName = String(profile.firstName ?? user.firstName ?? user.fname ?? user.first_name ?? '').trim();
  const lastName = String(profile.lastName ?? user.lastName ?? user.lname ?? user.last_name ?? '').trim();
  const fullName = String(profile.fullName ?? user.fullName ?? user.employeeName ?? user.name ?? '').trim();
  const username = String(user.username ?? '').trim();
  const employeeName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const displayName = employeeName || fullName || username || t('User');

  const nav = `flex w-full items-center ${sidebarCollapsed?'justify-center':'gap-3'} rounded-xl px-3 py-2.5 text-left text-[15px] font-bold text-slate-100 transition hover:bg-white/10 hover:text-white`;
  const label = (text:string) => sidebarCollapsed ? null : <span className="flex-1">{text}</span>;
  const sub = 'block rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white';
  const section = (key: string, label: string, Icon: any, children: any) => (
    <>
      <button title={label} onClick={() => sidebarCollapsed ? setCollapsed(false) : toggle(key)} className={nav}>
        <Icon className="h-5 w-5 shrink-0" />{!sidebarCollapsed&&<span className="flex-1">{label}</span>}
        {!sidebarCollapsed&&(open[key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
      </button>
      {!sidebarCollapsed && open[key] && <div className="ml-6 space-y-1 border-l border-white/20 pl-2">{children}</div>}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:h-screen lg:flex-col">
      <SkipLink />
      <SupportBanner />
      {/* The logo cell and the sidebar below it share the same fixed width (lg:w-96) so their right
          edges are structurally the same line, instead of two independently-sized elements that only
          happen to look aligned. The logo image fills that cell with zero padding on every side (no
          gap between the image's own edge and the cell/sidebar edge below it), at every breakpoint. */}
      {/* REQ-PLT-002: the company's second colour as a thin line under the header (none without one) */}
      <div className="flex w-full flex-shrink-0 items-stretch bg-frost-950 text-white shadow-lg" style={{ boxShadow: 'inset 0 -3px 0 var(--brand-accent-line, transparent), 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}>
        <div className={`block w-full leading-[0] lg:flex-none ${sidebarCollapsed?'lg:w-20':'lg:w-96'}`}>
          <img
            src="/media/reftech_logo_new.png"
            alt="RefTech - Temperature Controlled, Powered By Technology"
            className="block h-auto w-full"
          />
        </div>
        <div className="flex flex-1 items-center justify-end gap-4 px-6 py-4 text-right">
          {!driverLogin && <NotificationBell tone="dark" />}{/* REQ-PLT-003 */}
          <div>
            {/* REQ-PLT-002: the company's own name and logo when it is not the company that runs RefTech */}
            {brand && (brand.logo || (brand.name && brand.name !== 'RefTech')) && <div className="mb-1 flex items-center justify-end gap-2 text-sm font-bold text-sky-100">
              {brand.logo && <img src={brand.logo} alt="" className="h-7 w-auto max-w-[7rem] rounded bg-white object-contain p-0.5" />}{brand.name}</div>}
            <div className="font-bold text-white">{displayName}</div>
            <div className="text-xs font-bold text-sky-300">{me?.role || role}</div>{/* REQ-HR-001: the real role (HR, BILLING ...), not the base level */}
            <div className="mt-1 text-xs text-slate-200">{now.toLocaleDateString()} · <b>{now.toLocaleTimeString()}</b></div>
          </div>
        </div>
      </div>
      <div className="lg:flex lg:min-h-0 lg:flex-1">
        <aside className={`bg-frost-950 text-white transition-[width] duration-200 lg:flex lg:flex-shrink-0 lg:flex-col lg:overflow-hidden ${sidebarCollapsed?'lg:w-20':'lg:w-96'}`}>
          <div className={`hidden border-b border-white/10 px-3 py-3 lg:flex ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}>
            <button
              type="button"
              onClick={() => setCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? t('Expand menu') : t('Collapse menu')}
              aria-label={sidebarCollapsed ? t('Expand left menu') : t('Collapse left menu')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <nav className="space-y-1 p-3 lg:flex-1 lg:overflow-y-auto">
            <Link title={t('Dashboard')} to="/dashboard" className={`${nav} ${location.pathname === '/dashboard' ? 'bg-sky-700' : ''}`}><LayoutDashboard className="h-5 w-5 shrink-0" />{label(t('Dashboard'))}</Link>
            {/* REQ-CC-001: temperature excursion alerts -- internal users only, a Partner login does not see it. */}
            {(admin || manager || employee) && <Link title={t('Temperature Alerts')} to="/excursions" className={`${nav} ${location.pathname === '/excursions' ? 'bg-sky-700' : ''}`}><Thermometer className="h-5 w-5 shrink-0" />{label(t('Temperature Alerts'))}</Link>}
            {/* REQ-HR-001 .. 009: the HR menu for an Admin and for any role with an HR or driver safety permission; each link needs its permission. */}
            {hrAny && section('hr', t('HR'), Users, <>
              {may('HR_EMPLOYEES') && <Link className={sub} to="/admin/hr#add-employee">{t('Add Employee / Driver')}</Link>}
              {may('HR_EMPLOYEES') && <Link className={sub} to="/admin/hr#employees">{t('Update Employee')}</Link>}
              {may('HR_ATTENDANCE') && <Link className={sub} to="/hr/attendance">{t('Attendance')}</Link>}
              {may('HR_ATTENDANCE', 'HR_LEAVE_APPROVE') && <Link className={sub} to="/hr/leave">{t('Leave')}</Link>}
              {may('HR_PAYROLL', 'HR_PAYROLL_APPROVE') && <Link className={sub} to="/hr/payroll">{t('Payroll & Payslips')}</Link>}
              {may('HR_LETTERS') && <Link className={sub} to="/hr/letters">{t('HR Letters')}</Link>}
              {may('HR_DOCUMENTS') && <Link className={sub} to="/hr/documents">{t('HR Documents')}</Link>}
              {may('HR_WORK_EMAIL') && <Link className={sub} to="/hr/work-email">{t('Work Email')}</Link>}
              {may('HR_EMPLOYEES') && <Link className={sub} to="/hr/profile-changes">{t('Detail Changes')}</Link>}
              {may('DRIVER_SAFETY_VIEW') && <Link className={sub} to="/hr/driver-safety">{t('Driver Safety')}</Link>}
              {/* REQ-HR-010: job openings on the Careers page and the applicants */}
              {may('HR_RECRUITMENT') && <Link className={sub} to="/hr/recruitment">{t('Recruitment')}</Link>}
              {admin && <Link className={sub} to="/admin/hr#salary-report">{t('Salary Report')}</Link>}
            </>)}
            {/* REQ-HR-001, 002: roles, permissions, logins, password policy */}
            {(admin || (!!me && can(me, 'ACCESS_ADMIN'))) && <Link title={t('Access Control')} to="/admin/access" className={`${nav} ${location.pathname === '/admin/access' ? 'bg-sky-700' : ''}`}><LockKeyhole className="h-5 w-5 shrink-0" />{label(t('Access Control'))}</Link>}
            {(admin || manager) && may('MASTERS_EDIT') && section('inventory', t('Inventory'), Boxes, <>
              <Link className={sub} to="/admin/partners">{t('Manage Partners')}</Link>
              {/* REQ-PRT-001 */}
              <Link className={sub} to="/platform/partner-users">{t('Partner Users')}</Link>
              <Link className={sub} to="/admin/warehouses">{t('Manage Warehouses')}</Link>
              <Link className={sub} to="/admin/vehicles">{t('Manage Vehicles')}</Link>
              {/* REQ-CC-003: master list of temperature profiles, partner-agreed ranges, truck and chamber check */}
              <Link className={sub} to="/temperature-profiles">{t('Temperature Profiles')}</Link>
              {/* REQ-CC-006: dated documents of trucks, warehouses, company and drivers, with reminders */}
              <Link className={sub} to="/compliance">{t('Compliance Register')}</Link>
            </>)}
            {/* REQ-WMS-006 .. 011: the warehouse floor. Staff see all of it; a Partner login sees only its own stock. */}
            {staff && may('WAREHOUSE_VIEW') && section('warehouse', t('Warehouse'), Warehouse, <>
              {/* REQ-WMS-008, REQ-WMS-001: deliveries announced, dock slots, gate, receipt notes */}
              <Link className={sub} to="/warehouse/inbound">{t('Inbound & Dock')}</Link>
              <Link className={sub} to="/warehouse/putaway">{t('Receiving & Putaway')}</Link>
              <Link className={sub} to="/warehouse/outbound">{t('Outbound Orders')}</Link>
              <Link className={sub} to="/warehouse/stock">{t('Stock Ledger')}</Link>
              {/* REQ-WMS-002, REQ-WMS-015: chamber board, sensors and alerts */}
              <Link className={sub} to="/warehouse/chambers">{t('Chambers & Sensors')}</Link>
              {/* REQ-WMS-012 */}
              <Link className={sub} to="/warehouse/transfers">{t('Transfers')}</Link>
              {/* REQ-WMS-005: stock count, batch hold and recall, traceability */}
              <Link className={sub} to="/warehouse/stock-control">{t('Count, Hold & Trace')}</Link>
              {/* REQ-WMS-013 */}
              <Link className={sub} to="/warehouse/returns">{t('Returns & Disposal')}</Link>
              {/* REQ-WMS-014 */}
              <Link className={sub} to="/warehouse/services">{t('Freezing & Services')}</Link>
              {/* REQ-WMS-018, REQ-WMS-019, REQ-WMS-021: reserved space, kitting and grading, e-commerce fulfilment */}
              <Link className={sub} to="/warehouse/capacity">{t('Reserved Space')}</Link>
              <Link className={sub} to="/warehouse/kitting">{t('Kitting & Grading')}</Link>
              <Link className={sub} to="/warehouse/ecommerce">{t('E-commerce Fulfilment')}</Link>
              {/* REQ-WMS-004 */}
              <Link className={sub} to="/warehouse/billing">{t('Storage Billing')}</Link>
              {/* REQ-WMS-016 */}
              <Link className={sub} to="/warehouse/reports">{t('Warehouse Reports')}</Link>
              <Link className={sub} to="/warehouse/products">{t('Product Master')}</Link>
              <Link className={sub} to="/warehouse/layout">{t('Warehouse Layout')}</Link>
              {/* REQ-WMS-020, REQ-WMS-022, REQ-WMS-023, REQ-TRK-010: bonded warehouse, plant & equipment, reefer plug points, electronic locks */}
              <Link className={sub} to="/warehouse/bonded">{t('Bonded Warehouse')}</Link>
              <Link className={sub} to="/warehouse/plant">{t('Plant & Equipment')}</Link>
              <Link className={sub} to="/warehouse/plug-points">{t('Reefer Plug Points')}</Link>
              {may('TRACKING_VIEW') && <Link className={sub} to="/tracking/elocks">{t('Electronic Locks')}</Link>}
            </>)}
            {/* REQ-CNF-001..007: C&F agency for principals (staff) */}
            {staff && may('WAREHOUSE_VIEW') && section('cnf', t('C&F Agency'), Building2, <>
              <Link className={sub} to="/cnf?tab=contracts">{t('Contracts & Distributors')}</Link>
              <Link className={sub} to="/cnf?tab=orders">{t('C&F Orders')}</Link>
              <Link className={sub} to="/cnf?tab=stock">{t('Stock Statement')}</Link>
              <Link className={sub} to="/cnf?tab=returns">{t('C&F Returns & Claims')}</Link>
              <Link className={sub} to="/cnf?tab=documents">{t('Invoices & Challans')}</Link>
              <Link className={sub} to="/cnf?tab=settlement">{t('C&F Settlement')}</Link>
            </>)}
            {partnerLogin && <Link title={t('My Stock')} to="/warehouse/stock" className={`${nav} ${location.pathname === '/warehouse/stock' ? 'bg-sky-700' : ''}`}><Warehouse className="h-5 w-5 shrink-0" />{label(t('My Stock'))}</Link>}
            {/* REQ-WMS-008, 013, 014, 004, 016: a Partner login announces its deliveries and sees its returns, services, storage bills and reports. */}
            {partnerLogin && section('mywarehouse', t('My Warehouse'), Warehouse, <>
              <Link className={sub} to="/warehouse/inbound">{t('My Deliveries')}</Link>
              <Link className={sub} to="/warehouse/returns">{t('My Returns')}</Link>
              <Link className={sub} to="/warehouse/services">{t('My Freezing & Services')}</Link>
              <Link className={sub} to="/warehouse/billing">{t('My Storage Bills')}</Link>
              <Link className={sub} to="/warehouse/reports">{t('My Warehouse Reports')}</Link>
              <Link className={sub} to="/warehouse/stock-control">{t('Trace a Batch')}</Link>
            </>)}
            {/* REQ-CNF-001..007: a principal's login sees its C&F agent (tabs follow its contract) */}
            {partnerLogin && <Link title={t('My C&F Agent')} to="/cnf" className={`${nav} ${location.pathname === '/cnf' ? 'bg-sky-700' : ''}`}><Building2 className="h-5 w-5 shrink-0" />{label(t('My C&F Agent'))}</Link>}
            {/* REQ-TAL-001, REQ-TAL-002: transport companies, their trucks (own / attached / market) and what RefTech pays them. Staff only. */}
            {staff && may('TRANSPORTERS_VIEW') && section('transporters', t('Transporters'), Handshake, <>
              <Link className={sub} to="/transporters">{t('Transporters')}</Link>
              <Link className={sub} to="/transporters/contracts">{t('Rate Contracts')}</Link>
              {/* REQ-TAL-011: the transporter's freight bill, checks, approval, payment and settlement */}
              <Link className={sub} to="/transporters/freight">{t('Freight Bills')}</Link>
              <Link className={sub} to="/transporters?tab=fleet">{t('Fleet Ownership')}</Link>
              {/* REQ-TAL-004/005/006: loads sent to transporters, quotes, reverse auctions and contract share rules */}
              <Link className={sub} to="/tenders">{t('Tenders & Auctions')}</Link>
              <Link className={sub} to="/tenders/share-rules">{t('Share Rules')}</Link>
              {/* REQ-TAL-008, 009: VAHAN / Sarathi checks of hired trucks and drivers, portal logins and uploaded documents */}
              <Link className={sub} to="/transporters/verification">{t('Verification & Portal')}</Link>
              {/* REQ-TAL-012 */}
              <Link className={sub} to="/transporters/scorecard">{t('Scorecard')}</Link>
              {/* REQ-TAL-010 */}
              <Link className={sub} to="/transshipments">{t('Truck Changes')}</Link>
              {/* REQ-TAL-013, REQ-TAL-014, REQ-TAL-015: annual lane tender, free trucks / return loads, invoice intake (OCR, tolerance, debit notes) */}
              <Link className={sub} to="/transporters/lane-tenders">{t('Lane Tenders')}</Link>
              <Link className={sub} to="/transporters/free-trucks">{t('Free Trucks')}</Link>
              <Link className={sub} to="/transporters/invoices">{t('Transporter Invoices')}</Link>
            </>)}
            {/* REQ-CC-003-FIX1: the Trip menu is about trips only. "Create Full Load" and "Create Part Load" opened the same
                page (which also carried the Create Load Request form); they are now one "Create Trip" link, staff only,
                because Full or Part load is a field on the form. */}
            {(partnerLogin || may('TRIPS_VIEW')) && section('trip', role === 'EMPLOYEE' ? t('My Trips') : t('Trip'), Route, <>
              {(admin || manager) && <Link className={sub} to="/operations#create-trip">{t('Create Trip')}</Link>}
              {/* REQ-DSP-001/002: plan loads on trucks by day and week, approve planned trips. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch">{t('Planning Board')}</Link>}
              {/* REQ-DSP-006/008/009/004: dock slots, the gate, dispatch reports and documents, truck and product setup. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch/docks">{t('Dock Slots')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch/gate">{t('Gate')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch/documents">{t('Dispatch Documents')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch/reports">{t('Dispatch Reports')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/dispatch/setup">{t('Dispatch Setup')}</Link>}
              <Link className={sub} to="/operations#trip-tracking">{t('Trip Tracking')}</Link>
              {/* REQ-TAL-003, REQ-TAL-007: which truck and driver can take a load, and the calendar that stops double booking. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/vehicle-requests">{t('Vehicle Requests')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/fleet-calendar">{t('Fleet Calendar')}</Link>}
              {/* REQ-TRK-005: one queue for every alert of the running trips, with escalation. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/control-tower">{t('Control Tower')}</Link>}
              {/* REQ-TRP-002: the running trucks on a map, coloured by temperature state. A Partner login sees its own trips. */}
              <Link className={sub} to="/tracking">{t('Live Tracking')}</Link>
              {/* REQ-TRP-004: put open load requests on a part-load trip. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/part-load">{t('Part-Load Planner')}</Link>}
              {/* REQ-TRP-005: trips whose truck will arrive after the promised time. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/delays">{t('Delayed Trips')}</Link>}
              {/* REQ-CC-002: temperature graph and PDF certificate per trip. A Partner login sees its own trips only. */}
              <Link className={sub} to="/cold-chain">{t('Cold-Chain Proof')}</Link>
              {/* REQ-CC-005: door alerts of all trips and the latest device events. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/device-events">{t('Door & Reefer Events')}</Link>}
              {/* REQ-CC-009: goods held after a temperature excursion, released or rejected by a Manager. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/quality-holds">{t('Quality Holds')}</Link>}
              {/* REQ-CC-008, 010, 011, 012, 013, 014: cold chain records. Chain of Custody and Compartment Temperatures are open to a Partner login (its own batches and trips); the rest is staff only. */}
              <Link className={sub} to="/cold-chain/custody">{t('Chain of Custody')}</Link>
              <Link className={sub} to="/cold-chain/compartments">{t('Compartment Temperatures')}</Link>
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/cold-chain/sensors">{t('Sensors & Calibration')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/cold-chain/emergencies">{t('Cold Chain Emergencies')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/cold-chain/packaging">{t('Packaging & Time Out')}</Link>}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/cold-chain/hygiene">{t('Hygiene & Audit')}</Link>}
              {/* REQ-DSP-012, REQ-DSP-013, REQ-CC-015, REQ-CC-016: scheduled routes, home delivery, food safety (view: TRACKING_VIEW, edit: FOOD_SAFETY), eutectic plates. Staff only. */}
              {staff && may('TRIPS_VIEW') && <Link className={sub} to="/dispatch/scheduled-routes">{t('Scheduled Routes')}</Link>}
              {staff && may('TRIPS_VIEW') && <Link className={sub} to="/dispatch/home-delivery">{t('Home Delivery')}</Link>}
              {staff && may('FOOD_SAFETY', 'TRACKING_VIEW') && <Link className={sub} to="/cold-chain/food-safety">{t('Food Safety')}</Link>}
              {staff && may('TRACKING_VIEW') && <Link className={sub} to="/cold-chain/eutectic">{t('Eutectic Plates')}</Link>}
              {/* REQ-TRK-001: GPS providers, device keys and device health. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && <Link className={sub} to="/gps">{t('GPS Connections')}</Link>}
              {/* REQ-CC-006: an Employee has no Inventory menu, so the register (read-only for an Employee) is linked here. */}
              {employee && !partnerLogin && <Link className={sub} to="/compliance">{t('Compliance Register')}</Link>}
              {/* REQ-TRP-007: service plans, breakdown log, fuel. Staff only. */}
              {(admin || manager || employee) && !partnerLogin && may('FLEET_VIEW') && <Link className={sub} to="/maintenance">{t('Maintenance & Fuel')}</Link>}
            </>)}
            {/* REQ-CC-007, REQ-TRK-002..004, 007..009: tracking and telematics. Route Playback is open to a Partner login (its own trips); the rest is staff only. */}
            {(partnerLogin || may('TRACKING_VIEW')) && section('tracking', t('Tracking'), Radar, <>
              <Link className={sub} to="/tracking/playback">{t('Route Playback')}</Link>
              {(admin || manager || employee) && !partnerLogin && <>
                <Link className={sub} to="/tracking/quality">{t('Telemetry Quality')}</Link>
                <Link className={sub} to="/tracking/geofences">{t('Places & Waiting')}</Link>
                <Link className={sub} to="/tracking/hired">{t('Hired Trucks')}</Link>
                <Link className={sub} to="/tracking/reefers">{t('Reefer Units')}</Link>
                <Link className={sub} to="/tracking/eway-watch">{t('E-way Bill Watch')}</Link>
                <Link className={sub} to="/tracking/analytics">{t('Fleet Analytics')}</Link>
              </>}
            </>)}
            {/* REQ-CC-003-FIX1: Create Load Request is its own menu and its own page (/loads), for staff and for a Partner login.
                A Partner asks for a load for its own company; staff accept or decline it and can also enter one themselves. */}
            {section('loads', t('Load Requests'), PackagePlus, partnerLogin ? <>
              <Link className={sub} to="/loads#create-load">{t('Create Load Request')}</Link>
              <Link className={sub} to="/loads#loads">{t('My Load Requests')}</Link>
            </> : <>
              <Link className={sub} to="/loads#create-load">{t('Create Load Request')}</Link>
              <Link className={sub} to="/loads#waiting">{t('Partner Requests to Accept')}</Link>
              <Link className={sub} to="/loads#loads">{t('All Loads')}</Link>
            </>)}
            {/* REQ-POD-003, REQ-POD-006: returns of refused goods and the proof-to-bill check. Staff only. */}
            {staff && may('TRIPS_VIEW') && section('pod', t('Proof of Delivery'), FileCheck2, <>
              <Link className={sub} to="/pod/check">{t('Proof-to-Bill Check')}</Link>
              <Link className={sub} to="/pod/check?tab=returns">{t('Returns')}</Link>
              <Link className={sub} to="/pod/review">{t('Proof Review')}</Link>{/* REQ-POD-002, 004, 005, 007, REQ-TRP-011 */}
            </>)}
            {/* REQ-GOV-001 .. 016: government data and alerts. Staff only; Connections is set up by an Admin. */}
            {staff && may('GOVERNMENT_VIEW') && section('gov', t('Government'), Landmark, <>
              <Link className={sub} to="/gov/alerts?board=RTO">{t('RTO and Challan Alerts')}</Link>
              <Link className={sub} to="/gov/alerts?board=TOLL">{t('Toll Alerts')}</Link>
              <Link className={sub} to="/gov/tolls">{t('Tolls and FASTag')}</Link>
              <Link className={sub} to="/gov/vehicles">{t('Truck Records')}</Link>
              <Link className={sub} to="/gov/challans">{t('Challans')}</Link>
              <Link className={sub} to="/gov/licences">{t('Driving Licences')}</Link>
              <Link className={sub} to="/gov/gst">{t('GST Checks')}</Link>
              <Link className={sub} to="/gov/fssai">{t('FSSAI Licences')}</Link>
              <Link className={sub} to="/gov/calendar">{t('Compliance Calendar')}</Link>
              <Link className={sub} to="/gov/road">{t('Road Safety')}</Link>
              <Link className={sub} to="/gov/connections">{t('Connections')}</Link>
            </>)}
            {(admin || manager || employee) && may('BILLING_VIEW') && section('billing', t('Billing'), ReceiptText, <>
              <Link className={sub} to="/billing#create-billing">{t('Create Billing')}</Link>
              {/* REQ-BIL-008: freight per ton, full and part loads */}
              <Link className={sub} to="/billing/per-ton">{t('Per-ton Bill')}</Link>
              {(admin || manager) && <Link className={sub} to="/billing#vehicle-billing-contracts">{t('Vehicle Rate Contracts')}</Link>}
              {/* REQ-BIL-001..007: finance and billing */}
              {(admin || manager) && <>
                <Link className={sub} to="/billing/rate-contracts">{t('Partner Rate Contracts')}</Link>
                <Link className={sub} to="/billing/payments">{t('Payments & Ageing')}</Link>
                <Link className={sub} to="/billing/gst">{t('GST Documents')}</Link>
                <Link className={sub} to="/billing/profitability">{t('Profitability')}</Link>
                <Link className={sub} to="/billing/payables">{t('Supplier Payables')}</Link>
                <Link className={sub} to="/billing/tally">{t('Tally Export')}</Link>
              </>}
              {/* REQ-BIL-009, 010, 011, 012: fuel clauses and surcharges, collections, the agreement vault, dedicated vehicle contracts */}
              {(admin || manager) && <Link className={sub} to="/billing/fuel-clauses">{t('Fuel & Surcharges')}</Link>}
              {(admin || manager || (!!me && can(me, 'BILLING_COLLECTIONS'))) && <Link className={sub} to="/billing/collections">{t('Collections')}</Link>}
              {(admin || manager || (!!me && can(me, 'BILLING_AGREEMENTS'))) && <Link className={sub} to="/billing/agreements">{t('Agreement Vault')}</Link>}
              {(admin || manager) && <Link className={sub} to="/billing/dedicated">{t('Dedicated Vehicles')}</Link>}
              {employee && !admin && !manager && <Link className={sub} to="/billing/gst?tab=eway">{t('E-way Bills')}</Link>}
              {admin && <Link className={sub} to="/billing#company-gst-profile">{t('Company GST Profile')}</Link>}
              <Link className={sub} to="/expenses">{t('Expenses')}</Link>
              {admin && <><Link className={sub} to="/admin/finance">{t('Finance Report & Balance Sheet')}</Link></>}
            </>)}
            {/* REQ-CNF-008, REQ-CNF-009, REQ-PRT-004, REQ-PLT-017, REQ-PLT-018: replenishment, trading, website requests, Ask, energy and carbon */}
            {((staff && may('WAREHOUSE_VIEW')) || partnerLogin) && <Link title={t('Replenishment')} to="/cnf/replenishment" className={`${nav} ${location.pathname === '/cnf/replenishment' ? 'bg-sky-700' : ''}`}><PackagePlus className="h-5 w-5 shrink-0" />{label(t('Replenishment'))}</Link>}
            {staff && may('TRADING_VIEW') && section('trading', t('Trading & Distribution'), Boxes, <>
              <Link className={sub} to="/trading?tab=masters">{t('Vendors & Customers')}</Link>
              <Link className={sub} to="/trading?tab=buy">{t('Purchase Orders')}</Link>
              <Link className={sub} to="/trading?tab=stock">{t('Trading Stock')}</Link>
              <Link className={sub} to="/trading?tab=sell">{t('Sales & Invoices')}</Link>
              <Link className={sub} to="/trading?tab=collect">{t('Collections')}</Link>
              <Link className={sub} to="/trading?tab=margin">{t('Margins')}</Link>
            </>)}
            {staff && may('WEB_REQUESTS') && <Link title={t('Website Requests')} to="/web-requests" className={`${nav} ${location.pathname === '/web-requests' ? 'bg-sky-700' : ''}`}><Landmark className="h-5 w-5 shrink-0" />{label(t('Website Requests'))}</Link>}
            {((staff && may('ASK_QUESTIONS')) || partnerLogin) && <Link title={t('Ask')} to="/ask" className={`${nav} ${location.pathname === '/ask' ? 'bg-sky-700' : ''}`}><Radar className="h-5 w-5 shrink-0" />{label(t('Ask'))}</Link>}
            {((staff && may('ENERGY_VIEW')) || partnerLogin) && <Link title={partnerLogin ? t('My Carbon Report') : t('Energy & Carbon')} to="/energy" className={`${nav} ${location.pathname === '/energy' ? 'bg-sky-700' : ''}`}><BarChart3 className="h-5 w-5 shrink-0" />{label(partnerLogin ? t('My Carbon Report') : t('Energy & Carbon'))}</Link>}
            {/* REQ-HR-007: the login's own attendance, leave, payslips, letters and documents */}
            {staff && <Link title={t('My HR')} to="/me" className={`${nav} ${location.pathname === '/me' ? 'bg-sky-700' : ''}`}><UserRound className="h-5 w-5 shrink-0" />{label(t('My HR'))}</Link>}
            {/* REQ-HR-002: every login can change its own password (was Admin only) */}
            <Link title={t('Change Password')} to="/admin/account" className={nav}><KeyRound className="h-5 w-5 shrink-0" />{label(t('Change Password'))}</Link>
            {/* REQ-PLT-006, 008: management figures and predictions for staff; a Partner login gets its own service report. */}
            {staff && (admin || manager || (!!me && can(me, 'ANALYTICS_VIEW', 'TRIPS_VIEW'))) && section('analytics', t('Analytics'), BarChart3, <>
              {(admin || manager || (!!me && can(me, 'ANALYTICS_VIEW'))) && <Link className={sub} to="/platform/analytics">{t('Management Analytics')}</Link>}
              {may('TRIPS_VIEW') && <Link className={sub} to="/platform/predictions">{t('Predictions')}</Link>}
              <Link className={sub} to="/platform/lists">{t('Lists & Export')}</Link>
            </>)}
            {partnerLogin && section('partneraccount', t('My Account'), BarChart3, <>
              <Link className={sub} to="/platform/my-report">{t('My Service Report')}</Link>
              <Link className={sub} to="/platform/lists">{t('Lists & Export')}</Link>
              {/* REQ-PRT-001: a partner's own admin manages the logins of its company */}
              {String(user.partnerRole || '').toUpperCase() === 'PARTNER_ADMIN' && <Link className={sub} to="/partner/users">{t('My Company Users')}</Link>}
              <Link className={sub} to="/platform/notifications">{t('Notifications')}</Link>
              <Link className={sub} to="/platform/preferences">{t('Language & Units')}</Link>
            </>)}
            {/* REQ-PRT-001, REQ-PLT-001 .. 016: running the company on the platform. Most links are for the company Admin;
                Companies, Plans and Backups only for the Admin of the company that runs RefTech (platform owner). */}
            {staff && section('platform', t('Platform'), Settings, <>
              <Link className={sub} to="/platform/notifications">{t('Notifications')}</Link>
              <Link className={sub} to="/platform/preferences">{t('Language & Units')}</Link>
              {(admin || manager || (!!me && can(me, 'HR_EMPLOYEES', 'WAREHOUSE_EDIT'))) && <Link className={sub} to="/platform/import">{t('Bulk Import & Export')}</Link>}
              {(admin || (!!me && can(me, 'AUDIT_VIEW'))) && <Link className={sub} to="/platform/audit">{t('Audit Trail')}</Link>}
              {admin && <>
                <Link className={sub} to="/platform/setup">{t('Company Setup')}</Link>
                <Link className={sub} to="/platform/company">{t('Company Profile & Branding')}</Link>
                <Link className={sub} to="/platform/subscription">{t('My Subscription')}</Link>
                <Link className={sub} to="/platform/support-access">{t('Support Access')}</Link>
                <Link className={sub} to="/platform/retention">{t('Retention')}</Link>
                <Link className={sub} to="/platform/privacy">{t('Privacy')}</Link>
                <Link className={sub} to="/platform/jobs">{t('Background Jobs')}</Link>
                <Link className={sub} to="/platform/integrations">{t('Integrations')}</Link>
                <Link className={sub} to="/platform/api">{t('API Keys & Webhooks')}</Link>
                <Link className={sub} to="/platform/files">{t('File Store')}</Link>
                <Link className={sub} to="/platform/health">{t('System Health')}</Link>
              </>}
              {platform?.owner && <>
                <Link className={sub} to="/platform/companies">{t('Companies')}</Link>
                <Link className={sub} to="/platform/plans">{t('Plans & Subscriptions')}</Link>
                <Link className={sub} to="/platform/backups">{t('Backups & Recovery')}</Link>
              </>}
            </>)}
            {(admin || manager) && section('reports', t('Reports'), ShieldCheck, <>
              <Link className={sub} to="/billing#reports">{t('Billing Reports')}</Link>
              <Link className={sub} to="/operations#trip-tracking">{t('Trip Reports')}</Link>
            </>)}
          </nav>
          <div className="flex-shrink-0 border-t border-white/10 p-4">
            <button title={t('Sign Out')} onClick={() => { api('/api/auth/logout',{method:'POST'}).catch(()=>{}).finally(()=>{ localStorage.clear(); window.location.href = '/login'; }); }} className={`${nav} text-red-100`}><LogOut className="h-5 w-5 shrink-0" />{label(t('Sign Out'))}</button>
          </div>
        </aside>
        <div className="lg:flex-1 lg:overflow-y-auto">
          {/* REQ-CC-001-FIX1: pages use the full width of the monitor (was capped at 1500px, which left white space on both sides). */}
          <main id="main" tabIndex={-1} className="w-full p-5 lg:p-7 focus:outline-none">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
