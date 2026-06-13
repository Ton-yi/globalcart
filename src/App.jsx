import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LocaleProvider, isValidLocale, getPreferredLocale } from '@/lib/LocaleContext';
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
import AdminNavbarSettings from '@/pages/AdminNavbarSettings';
import MemberTiers from '@/pages/MemberTiers';
import HelpCenter from '@/pages/HelpCenter';
import HelpCenterFaq from '@/pages/HelpCenterFaq';
import AdminFaq from '@/pages/AdminFaq';
import UserTodo from '@/pages/UserTodo';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// /{locale}/mypage/me → 个人中心（AdminUserDetail/me 的别名路由）
const MypageRedirect = () => {
  const { locale } = useParams();
  return <Navigate to={`/${locale}/AdminUserDetail/me`} replace />;
};

// /{locale}/faq → alias for /:locale/helpcenter/faq
const FaqAliasRedirect = () => {
  const { locale } = useParams();
  const location = useLocation();
  return <Navigate to={`/${locale}/helpcenter/faq${location.search}`} replace />;
};

// /{locale}/HelpCenter (old) → /:locale/helpcenter
const HelpCenterOldRedirect = () => {
  const { locale } = useParams();
  return <Navigate to={`/${locale}/helpcenter`} replace />;
};

// /{locale}/HelpCenterFaq (old) → /:locale/helpcenter/faq
const HelpCenterFaqOldRedirect = () => {
  const { locale } = useParams();
  const location = useLocation();
  return <Navigate to={`/${locale}/helpcenter/faq${location.search}`} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // 旧链接兼容：首段不是合法语言代码时，自动加上用户偏好语言前缀
  // 例如 /Notifications → /ja/Notifications，/u/handle → /ja/u/handle
  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  if (firstSegment && !isValidLocale(firstSegment)) {
    return <Navigate to={`/${getPreferredLocale()}${location.pathname}${location.search}${location.hash}`} replace />;
  }

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
      <Route path="/" element={<Navigate to={`/${getPreferredLocale()}`} replace />} />
      
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
      <Route path="/:locale/AdminNavbarSettings" element={
        <LayoutWrapper currentPageName="AdminNavbarSettings">
          <AdminNavbarSettings />
        </LayoutWrapper>
      } />
      <Route path="/:locale/MemberTiers" element={
        <LayoutWrapper currentPageName="MemberTiers">
          <MemberTiers />
        </LayoutWrapper>
      } />
      {/* Help Center routes */}
      <Route path="/:locale/helpcenter" element={
        <LayoutWrapper currentPageName="HelpCenter">
          <HelpCenter />
        </LayoutWrapper>
      } />
      <Route path="/:locale/helpcenter/faq" element={
        <LayoutWrapper currentPageName="HelpCenterFaq">
          <HelpCenterFaq />
        </LayoutWrapper>
      } />
      {/* /faq alias → /helpcenter/faq */}
      <Route path="/:locale/faq" element={<FaqAliasRedirect />} />
      {/* Backward-compat redirects for old PascalCase URLs */}
      <Route path="/:locale/HelpCenter" element={<HelpCenterOldRedirect />} />
      <Route path="/:locale/HelpCenterFaq" element={<HelpCenterFaqOldRedirect />} />
      <Route path="/:locale/AdminFaq" element={
        <LayoutWrapper currentPageName="AdminFaq">
          <AdminFaq />
        </LayoutWrapper>
      } />
      <Route path="/:locale/UserTodo" element={
        <LayoutWrapper currentPageName="UserTodo">
          <UserTodo />
        </LayoutWrapper>
      } />
      <Route path="/:locale/UserPrivacySettings" element={
        <LayoutWrapper currentPageName="UserPrivacySettings">
          <UserPrivacySettings />
        </LayoutWrapper>
      } />
      <Route path="/:locale/mypage/me" element={<MypageRedirect />} />
      <Route path="/:locale/u/:handle" element={
        <LayoutWrapper currentPageName="PublicProfile">
          <PublicProfile />
        </LayoutWrapper>
      } />
      
      <Route path="*" element={<Navigate to={`/${getPreferredLocale()}`} replace />} />
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