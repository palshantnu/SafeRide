import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import SitePage from "../site/SitePage";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import Dashboard from "../pages/Dashboard";
import UserForm from "../pages/users/UserForm";
import UserList from "../pages/users/UserList";
import DriverForm from "../pages/driver/driverform";
import DriverList from "../pages/driver/driverlist";
import Businessassociateform from "../pages/businessassociate/businessassociateform";
import Businessassociatelist from "../pages/businessassociate/businessassociatelist";
import ServiceForm from "../pages/service/ServiceForm";
import ServiceList from "../pages/service/ServiceList";
import SubserviceList from "../pages/Subservice/subservicelist";
import PlanList from "../pages/plan/planlist";
import BookingHistory from "../pages/booking/bookinghistory";
import StaffList from "../pages/staff/StaffList";
import RolePermissions from "../pages/roles/RolePermissions";
import PageList from "../pages/PageList";
import LandingContentAdmin from "../pages/landing/LandingContent";
import WebsiteBuilder from "../pages/website/WebsiteBuilder";
import PopupMessages from "../pages/popup/PopupMessages";
import NotificationMessages from "../pages/notification/NotificationMessages";
import AppSettings from "../pages/settings/AppSettings";
import WithdrawalRequests  from "../pages/withdrawal/WithdrawalRequests";
import AccountList        from "../pages/account/AccountList";
import RatingsReviews     from "../pages/ratings/RatingsReviews";
import SelfSharingHistory     from "../pages/history/SelfSharingHistory";
import StateCityManagement   from "../pages/location/StateCityManagement";
import InterCityHistory    from "../pages/history/InterCityHistory";
import ParcelHistory       from "../pages/history/ParcelHistory";
import OnSpotHistory       from "../pages/history/OnSpotHistory";
import ChatSystem          from "../pages/chat/ChatSystem";
import NotFound from "../pages/NotFound";
import AdminLayout from "../layouts/AdminLayout";
import RequirePermission from "../components/RequirePermission";
import { getToken } from "../utils/auth";
import type { ReactNode } from "react";

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  return getToken() ? children : <Navigate to="/login" />;
};

export default function AppRoutes() {
  const [searchQuery, setSearchQuery] = useState("");

  // Auth + layout + "view" permission gate for a module.
  const admin = (module: string, el: ReactNode) => (
    <PrivateRoute>
      <AdminLayout searchQuery={searchQuery} setSearchQuery={setSearchQuery}>
        <RequirePermission module={module} action="view">{el}</RequirePermission>
      </AdminLayout>
    </PrivateRoute>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Public website */}
        <Route path="/" element={<SitePage page="home" />} />
        <Route path="/about" element={<SitePage page="about" />} />
        <Route path="/services" element={<SitePage page="services" />} />
        <Route path="/contact" element={<SitePage page="contact" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
         {}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        
        {}
        <Route path="/sub-services"              element={admin("sub_services",        <SubserviceList />)} />
        <Route path="/userform"                  element={admin("users",               <UserForm />)} />
        <Route path="/UserList"                  element={admin("users",               <UserList />)} />
        <Route path="/Driverform"                element={admin("drivers",             <DriverForm />)} />
        <Route path="/Driverlist"                element={admin("drivers",             <DriverList />)} />
        <Route path="/Bussinessassociateform"    element={admin("business_associates", <Businessassociateform />)} />
        <Route path="/Bussinessassociatelist"    element={admin("business_associates", <Businessassociatelist />)} />
        <Route path="/ServiceForm"               element={admin("services",            <ServiceForm />)} />
        <Route path="/Servicelist"               element={admin("services",            <ServiceList />)} />
        <Route path="/Planlist"                  element={admin("plans",               <PlanList />)} />
        <Route path="/bookinghistory"            element={admin("bookings",            <BookingHistory />)} />
        <Route path="/pages"                     element={admin("pages",               <PageList />)} />
        <Route path="/website"                   element={admin("landing",             <WebsiteBuilder />)} />
        <Route path="/landing-content"           element={admin("landing",             <LandingContentAdmin />)} />
        <Route path="/popup-messages"            element={admin("popups",              <PopupMessages />)} />
        <Route path="/notifications"             element={admin("notifications",       <NotificationMessages />)} />
        <Route path="/dashboard/settings"        element={<PrivateRoute><AdminLayout searchQuery={searchQuery} setSearchQuery={setSearchQuery}><AppSettings /></AdminLayout></PrivateRoute>} />
        <Route path="/dashboard/staff"           element={admin("staff",               <StaffList />)} />
        <Route path="/dashboard/roles"           element={admin("roles",               <RolePermissions />)} />
        <Route path="/withdrawal-requests"       element={admin("withdrawals",         <WithdrawalRequests />)} />
        <Route path="/accounts"                  element={admin("accounts",            <AccountList />)} />
        <Route path="/ratings-reviews"           element={admin("ratings",             <RatingsReviews />)} />
        <Route path="/self-sharing-history"      element={admin("self_sharing",        <SelfSharingHistory />)} />
        <Route path="/intercity-history"         element={admin("bookings",            <InterCityHistory />)} />
        <Route path="/parcel-history"            element={admin("parcel",              <ParcelHistory />)} />
        <Route path="/onspot-history"            element={admin("onspot",              <OnSpotHistory />)} />
        <Route path="/state-city"                element={admin("locations",           <StateCityManagement />)} />
        <Route path="/dashboard/chat"            element={<PrivateRoute><AdminLayout searchQuery={searchQuery} setSearchQuery={setSearchQuery}><ChatSystem /></AdminLayout></PrivateRoute>} />

        {/* 404 — any unknown route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
