/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/website/Navbar';
import { Hero } from '@/website/Hero';
import { About } from '@/website/About';
import { VisionMission } from '@/website/VisionMission';
import { Services } from '@/website/Services';
import { Industries } from '@/website/Industries';
import { Technology } from '@/website/Technology';
import { Stats } from '@/website/Stats';
import { Testimonials } from '@/website/Testimonials';
import { Contact } from '@/website/Contact';
import { Footer } from '@/website/Footer';
import { ScrollProgress } from '@/website/ScrollProgress';
import { BackToTop } from '@/website/BackToTop';
import { ErpAccess } from '@/website/ErpAccess';
import { AppShell } from '@/shared/components/AppShell';
import { LoginPage } from '@/modules/auth/LoginPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { CnfPage } from '@/modules/cnf/CnfPage'; // REQ-CNF-001..007 C&F agency
import { AdminHrPage } from '@/modules/admin/AdminHrPage';
import { AdminBillingPage } from '@/modules/billing/AdminBillingPage';
import { AdminPartnersPage } from '@/modules/admin/AdminPartnersPage';
import { AdminWarehousesPage } from '@/modules/admin/AdminWarehousesPage';
import { AdminVehiclesPage } from '@/modules/fleet/AdminVehiclesPage';
import { OperationsPage } from '@/modules/trip/OperationsPage';
import { VehicleExpensePage } from '@/modules/fleet/VehicleExpensePage';
import { FinanceReportPage } from '@/modules/billing/FinanceReportPage';
import { ExcursionsPage } from '@/modules/coldchain/ExcursionsPage'; // REQ-CC-001
import { TripDetailPage } from '@/modules/trip/TripDetailPage'; // REQ-CC-001-FIX1
import { ColdChainProofPage } from '@/modules/coldchain/ColdChainProofPage'; // REQ-CC-002
import { TemperatureProfilesPage } from '@/modules/coldchain/TemperatureProfilesPage'; // REQ-CC-003
import { LoadRequestsPage } from '@/modules/partload/LoadRequestsPage'; // REQ-CC-003 page split
import { DeviceEventsPage } from '@/modules/tracking/DeviceEventsPage'; // REQ-CC-005
import { ComplianceRegisterPage } from '@/modules/compliance/ComplianceRegisterPage'; // REQ-CC-006
import { LiveTrackingPage } from '@/modules/tracking/LiveTrackingPage'; // REQ-TRP-002
import { PartLoadPlannerPage } from '@/modules/partload/PartLoadPlannerPage'; // REQ-TRP-004
import { DelaysPage } from '@/modules/tracking/DelaysPage'; // REQ-TRP-005
import { DriverHomePage } from '@/modules/driver/DriverHomePage'; // REQ-TRP-006
import { MaintenancePage } from '@/modules/maintenance/MaintenancePage'; // REQ-TRP-007
import { WarehouseLayoutPage } from '@/modules/warehouse/WarehouseLayoutPage'; // REQ-WMS-006
import { ProductMasterPage } from '@/modules/warehouse/ProductMasterPage'; // REQ-WMS-007
import { PutawayPage } from '@/modules/warehouse/PutawayPage'; // REQ-WMS-009
import { StockLedgerPage } from '@/modules/warehouse/StockLedgerPage'; // REQ-WMS-010
import { OutboundOrdersPage } from '@/modules/warehouse/OutboundOrdersPage'; // REQ-WMS-011
import { InboundPage } from '@/modules/warehouse/InboundPage'; // REQ-WMS-008, REQ-WMS-001
import { ChambersPage } from '@/modules/warehouse/ChambersPage'; // REQ-WMS-002, REQ-WMS-015
import { TransfersPage } from '@/modules/warehouse/TransfersPage'; // REQ-WMS-012
import { StockControlPage } from '@/modules/warehouse/StockControlPage'; // REQ-WMS-005
import { ReturnsPage } from '@/modules/warehouse/ReturnsPage'; // REQ-WMS-013
import { ServicesPage } from '@/modules/warehouse/ServicesPage'; // REQ-WMS-014
import { StorageBillingPage } from '@/modules/warehouse/StorageBillingPage'; // REQ-WMS-004
import { WarehouseReportsPage } from '@/modules/warehouse/WarehouseReportsPage'; // REQ-WMS-016
import { TransportersPage } from '@/modules/transporter/TransportersPage'; // REQ-TAL-001
import { RateContractsPage } from '@/modules/transporter/RateContractsPage'; // REQ-TAL-002
import { VehicleRequestsPage } from '@/modules/allocation/VehicleRequestsPage'; // REQ-TAL-003
import { FleetCalendarPage } from '@/modules/allocation/FleetCalendarPage'; // REQ-TAL-007
import { FreightBillsPage } from '@/modules/transporter/FreightBillsPage'; // REQ-TAL-011
import { DispatchBoardPage } from '@/modules/dispatch/DispatchBoardPage'; // REQ-DSP-001, 002, 010, 011
import { DispatchPlanPage } from '@/modules/dispatch/plan/DispatchPlanPage'; // REQ-DSP-003 to 009 (one trip)
import { DockSchedulePage } from '@/modules/dispatch/desk/DockSchedulePage'; // REQ-DSP-006
import { GateDeskPage } from '@/modules/dispatch/desk/GateDeskPage'; // REQ-DSP-006
import { DispatchReportsPage } from '@/modules/dispatch/desk/DispatchReportsPage'; // REQ-DSP-008
import { DispatchSetupPage } from '@/modules/dispatch/desk/DispatchSetupPage'; // REQ-DSP-004
import { DocumentRegisterPage } from '@/modules/dispatch/desk/DocumentRegisterPage'; // REQ-DSP-009
import { LoadDispatchPage } from '@/modules/dispatch/desk/LoadDispatchPage'; // REQ-DSP-004, 005, 007, 009
import { QualityHoldsPage } from '@/modules/coldchain/QualityHoldsPage'; // REQ-CC-009
// REQ-CC-008, 010, 011, 012, 013, 014: cold chain records (custody, sensors, emergencies, compartments, packaging, hygiene and audit)
import { CustodyPage } from '@/modules/coldchain/records/CustodyPage';
import { SensorsPage } from '@/modules/coldchain/records/SensorsPage';
import { EmergencyPage } from '@/modules/coldchain/records/EmergencyPage';
import { CompartmentsPage } from '@/modules/coldchain/records/CompartmentsPage';
import { PackagingPage } from '@/modules/coldchain/records/PackagingPage';
import { HygienePage } from '@/modules/coldchain/records/HygienePage';
import { GovAlertsPage } from '@/modules/gov/GovAlertsPage'; // REQ-GOV-008
import { TollsPage } from '@/modules/gov/TollsPage'; // REQ-GOV-002..004
import { VehicleRecordsPage } from '@/modules/gov/VehicleRecordsPage'; // REQ-GOV-005
import { ChallansPage } from '@/modules/gov/ChallansPage'; // REQ-GOV-006
import { DriverLicencesPage } from '@/modules/gov/DriverLicencesPage'; // REQ-GOV-007, 012
import { GstChecksPage } from '@/modules/gov/GstChecksPage'; // REQ-GOV-010
import { FssaiPage } from '@/modules/gov/FssaiPage'; // REQ-GOV-011
import { ComplianceCalendarPage } from '@/modules/gov/ComplianceCalendarPage'; // REQ-GOV-013
import { RoadSafetyPage } from '@/modules/gov/RoadSafetyPage'; // REQ-GOV-015
import { GovConnectionsPage } from '@/modules/gov/GovConnectionsPage'; // REQ-GOV-014
import { PerTonBillingPage } from '@/modules/billing/PerTonBillingPage'; // REQ-BIL-008
import BillingRateContractsPage from '@/modules/billing/RateContractsPage'; // REQ-BIL-001 (renamed: the transporter page above has the same name)
import PaymentsPage from '@/modules/billing/PaymentsPage'; // REQ-BIL-002
import GstPage from '@/modules/billing/GstPage'; // REQ-BIL-003
import ProfitabilityPage from '@/modules/billing/ProfitabilityPage'; // REQ-BIL-004
import TallyExportPage from '@/modules/billing/TallyExportPage'; // REQ-BIL-006
import SupplierPayablesPage from '@/modules/billing/SupplierPayablesPage'; // REQ-BIL-007
import { ProofBillCheckPage } from '@/modules/pod/ProofBillCheckPage'; // REQ-POD-003, REQ-POD-006
import { PodReviewPage } from '@/modules/pod/PodReviewPage'; // REQ-POD-002, 004, 005, 007, REQ-TRP-011
import { GpsConnectionsPage } from '@/modules/tracking/GpsConnectionsPage'; // REQ-TRK-001
import { ControlTowerPage } from '@/modules/tracking/ControlTowerPage'; // REQ-TRK-005
import { TendersPage } from '@/modules/tender/TendersPage'; // REQ-TAL-004, 005
import { ShareRulesPage } from '@/modules/tender/ShareRulesPage'; // REQ-TAL-006
import { VerificationPage } from '@/modules/transporter/VerificationPage'; // REQ-TAL-008, 009
import { ScorecardPage } from '@/modules/transporter/ScorecardPage'; // REQ-TAL-012
import { TransshipmentsPage } from '@/modules/trip/TransshipmentsPage'; // REQ-TAL-010
import { TransporterPortalPage } from '@/modules/transporterportal/TransporterPortalPage'; // REQ-TAL-009
import { TelemetryQualityPage } from '@/modules/tracking/TelemetryQualityPage'; // REQ-CC-007
import { HiredTrackingPage } from '@/modules/tracking/HiredTrackingPage'; // REQ-TRK-002
import { GeofencesPage } from '@/modules/tracking/GeofencesPage'; // REQ-TRK-003
import { RoutePlaybackPage } from '@/modules/tracking/RoutePlaybackPage'; // REQ-TRK-004
import { PublicTrackingPage } from '@/modules/tracking/PublicTrackingPage'; // REQ-TRK-006
import { DriverSharePage } from '@/modules/tracking/DriverSharePage'; // REQ-TRK-002, MOB-204
import { FleetAnalyticsPage } from '@/modules/tracking/FleetAnalyticsPage'; // REQ-TRK-007
import { ReeferUnitsPage } from '@/modules/tracking/ReeferUnitsPage'; // REQ-TRK-008
import { EwayWatchPage } from '@/modules/tracking/EwayWatchPage'; // REQ-TRK-009
// REQ-WMS-020, REQ-WMS-022, REQ-WMS-023, REQ-TRK-010: bonded warehouse, plant & equipment, reefer plug points, electronic locks
import { BondedWarehousePage } from '@/modules/warehouse/BondedWarehousePage';
import { PlantPage } from '@/modules/warehouse/PlantPage';
import { PlugPointsPage } from '@/modules/warehouse/PlugPointsPage';
import { ElocksPage } from '@/modules/tracking/ElocksPage';
import { ChangePasswordPage } from '@/modules/auth/ChangePasswordPage'; // REQ-HR-002
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage'; // REQ-HR-002
import { AccessControlPage } from '@/modules/hr/AccessControlPage'; // REQ-HR-001, 002
import { AttendancePage } from '@/modules/hr/AttendancePage'; // REQ-HR-003
import { PayrollPage } from '@/modules/hr/PayrollPage'; // REQ-HR-004
import { LettersPage } from '@/modules/hr/LettersPage'; // REQ-HR-005
import { WorkEmailPage } from '@/modules/hr/WorkEmailPage'; // REQ-HR-006
import { EssPage } from '@/modules/hr/EssPage'; // REQ-HR-007
import { ProfileChangesPage } from '@/modules/hr/ProfileChangesPage'; // REQ-HR-007
import { HrDocumentsPage } from '@/modules/hr/HrDocumentsPage'; // REQ-HR-008
import { DriverSafetyPage } from '@/modules/hr/DriverSafetyPage'; // REQ-HR-009
import { RecruitmentPage } from '@/modules/hr/RecruitmentPage'; // REQ-HR-010
import { CareersListPage, CareerJobPage, CareersTeaser } from '@/website/careers/CareersPage'; // REQ-HR-010 Careers page of the website
// REQ-PRT-001, REQ-PLT-001 .. 016: platform screens (database_v2/60 on reftech_hr, 61 on reftech_ai)
import { PrefsProvider } from '@/shared/i18n/PrefsProvider'; // REQ-PLT-015 language, units, accessibility
import { PartnerUsersPage } from '@/modules/platform/PartnerUsersPage'; // REQ-PRT-001
import { MyCompanyUsersPage } from '@/modules/platform/MyCompanyUsersPage'; // REQ-PRT-001
import { CompaniesPage } from '@/modules/platform/CompaniesPage'; // REQ-PLT-002
import { CompanySetupPage, CompanyProfilePage } from '@/modules/platform/CompanySetupPage'; // REQ-PLT-002
import { PlansPage } from '@/modules/platform/PlansPage'; // REQ-PLT-011
import { MySubscriptionPage } from '@/modules/platform/MySubscriptionPage'; // REQ-PLT-011
import { SupportAccessPage } from '@/modules/platform/SupportAccessPage'; // REQ-PLT-016
import { AuditTrailPage } from '@/modules/platform/AuditTrailPage'; // REQ-PLT-001
import { RetentionPage } from '@/modules/platform/RetentionPage'; // REQ-PLT-001
import { PrivacyPage } from '@/modules/platform/PrivacyPage'; // REQ-PLT-001
import { BackupsPage } from '@/modules/platform/BackupsPage'; // REQ-PLT-009
import { SystemHealthPage } from '@/modules/platform/SystemHealthPage'; // REQ-PLT-016
import { PreferencesPage } from '@/modules/platform/PreferencesPage'; // REQ-PLT-015
import { ManagementAnalyticsPage, MyServiceReportPage } from '@/modules/platform/AnalyticsPage'; // REQ-PLT-006
import { PredictionsPage } from '@/modules/platform/PredictionsPage'; // REQ-PLT-008
import { ListsExportPage } from '@/modules/platform/ListsExportPage'; // REQ-PLT-004
import { BulkImportPage } from '@/modules/platform/BulkImportPage'; // REQ-PLT-014
import { FileStorePage } from '@/modules/platform/FileStorePage'; // REQ-PLT-005
import { NotificationsPage } from '@/modules/platform/NotificationsPage'; // REQ-PLT-003
import { JobsPage } from '@/modules/platform/JobsPage'; // REQ-PLT-010
import { IntegrationsPage } from '@/modules/platform/IntegrationsPage'; // REQ-PLT-012
import { ApiAccessPage } from '@/modules/platform/ApiAccessPage'; // REQ-PLT-013

function PublicWebsite() {
  return <div className="min-h-screen bg-white"><ScrollProgress/><Navbar/><main><Hero/><About/><VisionMission/><Services/><Industries/><Technology/><ErpAccess/><Stats/><Testimonials/><CareersTeaser/><Contact/></main><Footer/><BackToTop/></div>;
}

export default function App() {
  return (
    <PrefsProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage/>} />
        {/* REQ-TRP-006: what a driver login sees. Outside the office menu: it uses the driver API only. */}
        {/* REQ-HR-002: forgot password (no login) and the forced password change after HR set or reset it, for every kind of login. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage/>} />
        <Route path="/account/password" element={<main className="min-h-screen bg-slate-50 p-5 lg:p-7"><a href="/login" className="text-sm font-bold text-sky-700 underline">Back</a><div className="mt-3"><ChangePasswordPage/></div></main>} />
        {/* REQ-HR-007, 009: a driver's own leave, payslips, documents and safety score */}
        <Route path="/driver/me" element={<EssPage driver/>} />
        <Route path="/driver" element={<DriverHomePage/>} />
        <Route path="/driver/:tripId" element={<DriverHomePage/>} />
        {/* REQ-TAL-009: what a transporter login sees. Outside the office menu: it uses the transporter portal API only. */}
        <Route path="/transporter" element={<TransporterPortalPage/>} />
        {/* REQ-TRK-006: the customer's tracking link and REQ-TRK-002 / MOB-204: the hired driver's sharing link. No login, outside the office menu. */}
        <Route path="/track/:token" element={<PublicTrackingPage/>} />
        <Route path="/share-location/:token" element={<DriverSharePage/>} />
        {/* REQ-HR-010: the Careers page of the website: open positions and the Apply form with resume upload. No login. */}
        <Route path="/careers" element={<CareersListPage/>} />
        <Route path="/careers/:id" element={<CareerJobPage/>} />
        <Route element={<AppShell/>}>
          <Route path="/dashboard" element={<DashboardPage/>} />
          <Route path="/admin/hr" element={<AdminHrPage/>} />
          <Route path="/admin/partners" element={<AdminPartnersPage/>} />
          <Route path="/admin/warehouses" element={<AdminWarehousesPage/>} />
          <Route path="/admin/vehicles" element={<AdminVehiclesPage/>} />
          <Route path="/admin/billing" element={<AdminBillingPage/>} />
          <Route path="/billing" element={<AdminBillingPage/>} />
          <Route path="/operations" element={<OperationsPage/>} />
          <Route path="/trips/:id" element={<TripDetailPage/>} />{/* REQ-CC-001-FIX1 Trip details with map, opened by "View" */}
          <Route path="/excursions" element={<ExcursionsPage/>} />{/* REQ-CC-001 Temperature Alerts */}
          <Route path="/cold-chain" element={<ColdChainProofPage/>} />{/* REQ-CC-002 Cold-Chain Proof */}
          <Route path="/temperature-profiles" element={<TemperatureProfilesPage/>} />{/* REQ-CC-003 Temperature Profiles */}
          <Route path="/loads" element={<LoadRequestsPage/>} />{/* REQ-CC-003 Load Requests, split from /operations */}
          <Route path="/device-events" element={<DeviceEventsPage/>} />{/* REQ-CC-005 Door and Reefer Events */}
          <Route path="/compliance" element={<ComplianceRegisterPage/>} />{/* REQ-CC-006 Compliance Register */}
          <Route path="/tracking" element={<LiveTrackingPage/>} />{/* REQ-TRP-002 Live Tracking map */}
          <Route path="/part-load" element={<PartLoadPlannerPage/>} />{/* REQ-TRP-004 Part-Load Planner: the part-load trips */}
          <Route path="/part-load/:tripId" element={<PartLoadPlannerPage/>} />{/* REQ-TRP-004 the planner of one trip */}
          <Route path="/delays" element={<DelaysPage/>} />{/* REQ-TRP-005 Delayed Trips */}
          <Route path="/maintenance" element={<MaintenancePage/>} />{/* REQ-TRP-007 Maintenance & Fuel */}
          <Route path="/cnf" element={<CnfPage/>} />{/* REQ-CNF-001..007 C&F agency (staff and principal logins) */}
          <Route path="/warehouse/layout" element={<WarehouseLayoutPage/>} />{/* REQ-WMS-006 Warehouse Layout */}
          <Route path="/warehouse/products" element={<ProductMasterPage/>} />{/* REQ-WMS-007 Product Master */}
          <Route path="/warehouse/putaway" element={<PutawayPage/>} />{/* REQ-WMS-009 Receiving & Putaway */}
          <Route path="/warehouse/stock" element={<StockLedgerPage/>} />{/* REQ-WMS-010 Stock Ledger (a Partner login: My Stock) */}
          <Route path="/warehouse/outbound" element={<OutboundOrdersPage/>} />{/* REQ-WMS-011 Outbound Orders */}
          <Route path="/warehouse/inbound" element={<InboundPage/>} />{/* REQ-WMS-008, 001 Inbound & Dock (a Partner login: My Deliveries) */}
          <Route path="/warehouse/chambers" element={<ChambersPage/>} />{/* REQ-WMS-002, 015 Chambers & Sensors */}
          <Route path="/warehouse/transfers" element={<TransfersPage/>} />{/* REQ-WMS-012 Transfers */}
          <Route path="/warehouse/stock-control" element={<StockControlPage/>} />{/* REQ-WMS-005 Count, Hold & Trace */}
          <Route path="/warehouse/returns" element={<ReturnsPage/>} />{/* REQ-WMS-013 Returns & Disposal */}
          <Route path="/warehouse/services" element={<ServicesPage/>} />{/* REQ-WMS-014 Freezing & Services */}
          <Route path="/warehouse/billing" element={<StorageBillingPage/>} />{/* REQ-WMS-004 Storage Billing */}
          <Route path="/warehouse/reports" element={<WarehouseReportsPage/>} />{/* REQ-WMS-016 Warehouse Reports */}
          <Route path="/transporters" element={<TransportersPage/>} />{/* REQ-TAL-001 Transporters and fleet ownership */}
          <Route path="/transporters/contracts" element={<RateContractsPage/>} />{/* REQ-TAL-002 Rate Contracts */}
          <Route path="/transporters/freight" element={<FreightBillsPage/>} />{/* REQ-TAL-011 Freight Bills and settlement */}
          <Route path="/vehicle-requests" element={<VehicleRequestsPage/>} />{/* REQ-TAL-003 Vehicle Requests and eligibility list */}
          <Route path="/fleet-calendar" element={<FleetCalendarPage/>} />{/* REQ-TAL-007 Truck and driver calendar */}
          <Route path="/tenders" element={<TendersPage/>} />{/* REQ-TAL-004, 005 Tenders, spot quotes and reverse auctions */}
          <Route path="/tenders/share-rules" element={<ShareRulesPage/>} />{/* REQ-TAL-006 Contract share rules */}
          <Route path="/transporters/verification" element={<VerificationPage/>} />{/* REQ-TAL-008, 009 VAHAN / Sarathi checks, portal logins, uploaded documents */}
          <Route path="/transporters/scorecard" element={<ScorecardPage/>} />{/* REQ-TAL-012 Transporter scorecard */}
          <Route path="/transshipments" element={<TransshipmentsPage/>} />{/* REQ-TAL-010 Truck changes on the road */}
          <Route path="/pod/check" element={<ProofBillCheckPage/>} />{/* REQ-POD-006 Proof-to-Bill Check; ?tab=returns REQ-POD-003 Returns */}
          <Route path="/pod/review" element={<PodReviewPage/>} />{/* REQ-POD-002, 004, 005, 007, REQ-TRP-011 Proof Review */}
          <Route path="/gps" element={<GpsConnectionsPage/>} />{/* REQ-TRK-001 GPS Connections */}
          <Route path="/control-tower" element={<ControlTowerPage/>} />{/* REQ-TRK-005 Control Tower */}
          <Route path="/tracking/quality" element={<TelemetryQualityPage/>} />{/* REQ-CC-007 Telemetry Quality */}
          <Route path="/tracking/hired" element={<HiredTrackingPage/>} />{/* REQ-TRK-002 Hired Trucks */}
          <Route path="/tracking/geofences" element={<GeofencesPage/>} />{/* REQ-TRK-003 Places and Waiting */}
          <Route path="/tracking/playback" element={<RoutePlaybackPage/>} />{/* REQ-TRK-004 Route Playback */}
          <Route path="/tracking/analytics" element={<FleetAnalyticsPage/>} />{/* REQ-TRK-007 Fleet Analytics */}
          <Route path="/tracking/reefers" element={<ReeferUnitsPage/>} />{/* REQ-TRK-008 Reefer Units */}
          <Route path="/tracking/eway-watch" element={<EwayWatchPage/>} />{/* REQ-TRK-009 E-way Bill Watch */}
          {/* REQ-WMS-020, REQ-WMS-022, REQ-WMS-023, REQ-TRK-010 */}
          <Route path="/warehouse/bonded" element={<BondedWarehousePage/>} />
          <Route path="/warehouse/plant" element={<PlantPage/>} />
          <Route path="/warehouse/plug-points" element={<PlugPointsPage/>} />
          <Route path="/tracking/elocks" element={<ElocksPage/>} />
          <Route path="/dispatch" element={<DispatchBoardPage/>} />{/* REQ-DSP-001 Planning Board (?load=<id> plans that load) */}
          <Route path="/dispatch/trips/:id" element={<DispatchPlanPage/>} />{/* REQ-DSP-003..009 Dispatch plan of one trip: route, load plan, stock, dock & gate, documents, suggestions */}
          <Route path="/dispatch/loads/:id" element={<LoadDispatchPage/>} />{/* REQ-DSP-004/007/009 goods and consignee of a load, trucks for it */}
          <Route path="/dispatch/docks" element={<DockSchedulePage/>} />{/* REQ-DSP-006 dock slots */}
          <Route path="/dispatch/gate" element={<GateDeskPage/>} />{/* REQ-DSP-006 gate in, gate pass scan, gate out */}
          <Route path="/dispatch/reports" element={<DispatchReportsPage/>} />{/* REQ-DSP-008 OTIF, fill rate, plan against actual */}
          <Route path="/dispatch/documents" element={<DocumentRegisterPage/>} />{/* REQ-DSP-009 consignment notes and e-way bills */}
          <Route path="/dispatch/setup" element={<DispatchSetupPage/>} />{/* REQ-DSP-004 trucks, compartments, product rules, settings */}
          <Route path="/quality-holds" element={<QualityHoldsPage/>} />{/* REQ-CC-009 Quality Holds */}
          {/* REQ-CC-008, 010, 011, 012, 013, 014: cold chain records */}
          <Route path="/cold-chain/custody" element={<CustodyPage/>} />{/* REQ-CC-008 Chain of Custody (staff and partner) */}
          <Route path="/cold-chain/sensors" element={<SensorsPage/>} />{/* REQ-CC-010 Sensors & Calibration */}
          <Route path="/cold-chain/emergencies" element={<EmergencyPage/>} />{/* REQ-CC-011 Cold Chain Emergencies */}
          <Route path="/cold-chain/compartments" element={<CompartmentsPage/>} />{/* REQ-CC-012 Compartment Temperatures */}
          <Route path="/cold-chain/packaging" element={<PackagingPage/>} />{/* REQ-CC-013 Packaging & Time Out */}
          <Route path="/cold-chain/hygiene" element={<HygienePage/>} />{/* REQ-CC-014 Hygiene & Audit */}
          <Route path="/gov/alerts" element={<GovAlertsPage/>} />{/* REQ-GOV-008 RTO and toll alerts */}
          <Route path="/gov/tolls" element={<TollsPage/>} />{/* REQ-GOV-002..004 Tolls and FASTag */}
          <Route path="/gov/vehicles" element={<VehicleRecordsPage/>} />{/* REQ-GOV-005 Truck records */}
          <Route path="/gov/challans" element={<ChallansPage/>} />{/* REQ-GOV-006 Challans */}
          <Route path="/gov/licences" element={<DriverLicencesPage/>} />{/* REQ-GOV-007, 012 Driving licences */}
          <Route path="/gov/gst" element={<GstChecksPage/>} />{/* REQ-GOV-010 GST checks */}
          <Route path="/gov/fssai" element={<FssaiPage/>} />{/* REQ-GOV-011 FSSAI licences */}
          <Route path="/gov/calendar" element={<ComplianceCalendarPage/>} />{/* REQ-GOV-013 Compliance calendar */}
          <Route path="/gov/road" element={<RoadSafetyPage/>} />{/* REQ-GOV-015 Road safety */}
          <Route path="/gov/connections" element={<GovConnectionsPage/>} />{/* REQ-GOV-014 Connections */}
          <Route path="/billing/per-ton" element={<PerTonBillingPage/>} />{/* REQ-BIL-008 Per-ton Bill */}
          <Route path="/billing/rate-contracts" element={<BillingRateContractsPage/>} />{/* REQ-BIL-001 */}
          <Route path="/billing/payments" element={<PaymentsPage/>} />{/* REQ-BIL-002 */}
          <Route path="/billing/gst" element={<GstPage/>} />{/* REQ-BIL-003 */}
          <Route path="/billing/profitability" element={<ProfitabilityPage/>} />{/* REQ-BIL-004 */}
          <Route path="/billing/tally" element={<TallyExportPage/>} />{/* REQ-BIL-006 */}
          <Route path="/billing/payables" element={<SupplierPayablesPage/>} />{/* REQ-BIL-007 */}
          <Route path="/expenses" element={<VehicleExpensePage/>} />
          <Route path="/admin/account" element={<ChangePasswordPage/>} />{/* REQ-HR-002: every login, with the password policy */}
          <Route path="/admin/access" element={<AccessControlPage/>} />{/* REQ-HR-001, 002 Access Control */}
          <Route path="/hr/attendance" element={<AttendancePage/>} />{/* REQ-HR-003 */}
          <Route path="/hr/leave" element={<AttendancePage start="leave"/>} />{/* REQ-HR-003 */}
          <Route path="/hr/payroll" element={<PayrollPage/>} />{/* REQ-HR-004 */}
          <Route path="/hr/letters" element={<LettersPage/>} />{/* REQ-HR-005 */}
          <Route path="/hr/work-email" element={<WorkEmailPage/>} />{/* REQ-HR-006 */}
          <Route path="/hr/profile-changes" element={<ProfileChangesPage/>} />{/* REQ-HR-007 */}
          <Route path="/hr/documents" element={<HrDocumentsPage/>} />{/* REQ-HR-008 */}
          <Route path="/hr/driver-safety" element={<DriverSafetyPage/>} />{/* REQ-HR-009 */}
          <Route path="/hr/recruitment" element={<RecruitmentPage/>} />{/* REQ-HR-010 job openings and applicants */}
          <Route path="/me" element={<EssPage/>} />{/* REQ-HR-007 My HR */}
          <Route path="/admin/finance" element={<FinanceReportPage/>} />
          {/* REQ-PRT-001, REQ-PLT-001 .. 016 platform */}
          <Route path="/platform/partner-users" element={<PartnerUsersPage/>} />
          <Route path="/partner/users" element={<MyCompanyUsersPage/>} />
          <Route path="/platform/companies" element={<CompaniesPage/>} />
          <Route path="/platform/setup" element={<CompanySetupPage/>} />
          <Route path="/platform/company" element={<CompanyProfilePage/>} />
          <Route path="/platform/plans" element={<PlansPage/>} />
          <Route path="/platform/subscription" element={<MySubscriptionPage/>} />
          <Route path="/platform/support-access" element={<SupportAccessPage/>} />
          <Route path="/platform/audit" element={<AuditTrailPage/>} />
          <Route path="/platform/retention" element={<RetentionPage/>} />
          <Route path="/platform/privacy" element={<PrivacyPage/>} />
          <Route path="/platform/backups" element={<BackupsPage/>} />
          <Route path="/platform/health" element={<SystemHealthPage/>} />
          <Route path="/platform/preferences" element={<PreferencesPage/>} />
          <Route path="/platform/analytics" element={<ManagementAnalyticsPage/>} />
          <Route path="/platform/my-report" element={<MyServiceReportPage/>} />
          <Route path="/platform/predictions" element={<PredictionsPage/>} />
          <Route path="/platform/lists" element={<ListsExportPage/>} />
          <Route path="/platform/import" element={<BulkImportPage/>} />
          <Route path="/platform/files" element={<FileStorePage/>} />
          <Route path="/platform/notifications" element={<NotificationsPage/>} />
          <Route path="/platform/notifications/settings" element={<NotificationsPage/>} />
          <Route path="/platform/notifications/outbox" element={<NotificationsPage/>} />
          <Route path="/platform/jobs" element={<JobsPage/>} />
          <Route path="/platform/integrations" element={<IntegrationsPage/>} />
          <Route path="/platform/api" element={<ApiAccessPage/>} />
        </Route>
        <Route path="/" element={<PublicWebsite/>} />
        <Route path="*" element={<PublicWebsite/>} />
      </Routes>
    </BrowserRouter>
    </PrefsProvider>
  );
}
