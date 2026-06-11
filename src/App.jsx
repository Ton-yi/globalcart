import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LocaleProvider } from '@/lib/LocaleContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PlatformAdminSettings from '@/pages/PlatformAdminSettings';
import AdminFeeRules from '@/pages/AdminFeeRules';
import PreShipmentForm from '@/pages/PreShipmentForm';
import GroupBuy from '@/pages/GroupBuy';
import TransitLocationWork from '@/pages/TransitLocationWork';
import TransitPoolWork from '@/pages/TransitPoolWork';
import AdminTransitWork from '@/pages/AdminTransitWork';
import Notifications from '@/pages/Notifications';
import UserNotificationSettings from '@/pages/UserNotificationSettings';
import AdminNotificationManager from '@/pages/AdminNotificationManager';
import AdminNotificationTemplates from '@/pages/AdminNotificationTemplates';
import AdminNotificationDefaults from '@/pages/AdminNotificationDefaults';
import PlatformNotificationManager from '@/pages/PlatformNotificationManager';
import TestNotificationTemplates from '@/pages/TestNotificationTemplates';
import AdminReports from '@/pages/AdminReports';
import MetricCardSizesDemo from '@/pages/MetricCardSizesDemo';
import TestGmailConnection from '@/pages/TestGmailConnection';
import AdminUserDetail from '@/pages/AdminUserDetail';
import PublicProfile from '@/pages/PublicProfile';
import UserPrivacySettings from '@/pages/UserPrivacySettings';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ja" replace />} />
      
      <Route path="/:locale" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/:locale/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      
      <Route path="/:locale/PlatformAdminSettings" element={
        <LayoutWrapper currentPageName="PlatformAdminSettings">
          <PlatformAdminSettings />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminFeeRules" element={
        <LayoutWrapper currentPageName="AdminFeeRules">
          <AdminFeeRules />
        </LayoutWrapper>
      } />
      <Route path="/:locale/PreShipmentForm" element={
        <LayoutWrapper currentPageName="PreShipmentForm">
          <PreShipmentForm />
        </LayoutWrapper>
      } />
      <Route path="/:locale/GroupBuy" element={
        <LayoutWrapper currentPageName="GroupBuy">
          <GroupBuy />
        </LayoutWrapper>
      } />
      <Route path="/:locale/TransitLocationWork/:transit_location_id" element={
        <LayoutWrapper currentPageName="TransitLocationWork">
          <TransitLocationWork />
        </LayoutWrapper>
      } />
      <Route path="/:locale/Trworkon/:pool_code" element={
        <LayoutWrapper currentPageName="TransitPoolWork">
          <TransitPoolWork />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminTransitWork" element={
        <LayoutWrapper currentPageName="AdminTransitWork">
          <AdminTransitWork />
        </LayoutWrapper>
      } />
      <Route path="/:locale/Notifications" element={
        <LayoutWrapper currentPageName="Notifications">
          <Notifications />
        </LayoutWrapper>
      } />
      <Route path="/:locale/UserNotificationSettings" element={
        <LayoutWrapper currentPageName="UserNotificationSettings">
          <UserNotificationSettings />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminNotificationManager" element={
        <LayoutWrapper currentPageName="AdminNotificationManager">
          <AdminNotificationManager />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminNotificationTemplates" element={
        <LayoutWrapper currentPageName="AdminNotificationTemplates">
          <AdminNotificationTemplates />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminNotificationDefaults" element={
        <LayoutWrapper currentPageName="AdminNotificationDefaults">
          <AdminNotificationDefaults />
        </LayoutWrapper>
      } />
      <Route path="/:locale/PlatformNotificationManager" element={
        <LayoutWrapper currentPageName="PlatformNotificationManager">
          <PlatformNotificationManager />
        </LayoutWrapper>
      } />
      <Route path="/:locale/TestNotificationTemplates" element={
        <LayoutWrapper currentPageName="TestNotificationTemplates">
          <TestNotificationTemplates />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminReports" element={
        <LayoutWrapper currentPageName="AdminReports">
          <AdminReports />
        </LayoutWrapper>
      } />
      <Route path="/:locale/MetricCardSizesDemo" element={
        <LayoutWrapper currentPageName="MetricCardSizesDemo">
          <MetricCardSizesDemo />
        </LayoutWrapper>
      } />
      <Route path="/:locale/TestGmailConnection" element={
        <LayoutWrapper currentPageName="TestGmailConnection">
          <TestGmailConnection />
        </LayoutWrapper>
      } />
      <Route path="/:locale/AdminUserDetail/:userId" element={
        <LayoutWrapper currentPageName="AdminUserDetail">
          <AdminUserDetail />
        </LayoutWrapper>
      } />
      <Route path="/:locale/UserPrivacySettings" element={
        <LayoutWrapper currentPageName="UserPrivacySettings">
          <UserPrivacySettings />
        </LayoutWrapper>
      } />
      <Route path="/:locale/u/:handle" element={
        <LayoutWrapper currentPageName="PublicProfile">
          <PublicProfile />
        </LayoutWrapper>
      } />
      
      <Route path="*" element={<Navigate to="/ja" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <LocaleProvider>
            <AuthenticatedApp />
          </LocaleProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App