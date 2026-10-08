import { createBrowserRouter, Navigate } from 'react-router-dom'
import { homeFor } from '@/auth/home'
import { RequireApplicant, RequireGroup, RedirectIfSignedIn } from '@/auth/RouteGuards'
import { useAuth } from '@/auth/AuthProvider'
import { LandingPage } from '@/features/marketing/LandingPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SignInPage } from '@/features/auth/SignInPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { ConfirmSignUpPage } from '@/features/auth/ConfirmSignUpPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { BrowsePostingsPage } from '@/features/postings/BrowsePostingsPage'
import { PostingDetailPage } from '@/features/postings/PostingDetailPage'
import { ApplyPage } from '@/features/apply/ApplyPage'
import { MyApplicationsPage } from '@/features/applications/MyApplicationsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { CvLibraryPage } from '@/features/profile/CvLibraryPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { CompanyOverviewPage } from '@/features/company/CompanyOverviewPage'
import { CompanyPostingsPage } from '@/features/company/CompanyPostingsPage'
import { PostingEditorPage } from '@/features/company/PostingEditorPage'
import { PipelinePage } from '@/features/company/PipelinePage'
import { ApplicationReviewPage } from '@/features/company/ApplicationReviewPage'
import { CompanyApplicantsPage } from '@/features/company/CompanyApplicantsPage'
import { CompanyInterviewsPage } from '@/features/company/CompanyInterviewsPage'
import { CompanyAnalyticsPage } from '@/features/company/CompanyAnalyticsPage'
import { CompanyProfilePage } from '@/features/company/CompanyProfilePage'
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage'
import { AdminCompaniesPage } from '@/features/admin/AdminCompaniesPage'
import { AdminPostingsPage } from '@/features/admin/AdminPostingsPage'
import { AppShell } from './AppShell'
import { FocusLayout } from './FocusLayout'
import { CompanyShell } from './CompanyShell'
import { AdminShell } from './AdminShell'
import { AuthLayout } from './AuthLayout'
import { NotFoundPage } from './NotFoundPage'
import { RouteErrorPage } from './CrashScreen'

/**
 * "/" serves two people. A visitor is being sold the product and gets the hero;
 * somebody already signed in has bought it, and their home is the dashboard, so
 * showing them the sales page inside the app's own chrome would be wrong.
 */
function Home() {
  const { status, identity } = useAuth()
  if (status === 'signedIn') return <Navigate to={homeFor(identity)} replace />
  return <LandingPage />
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/dashboard',
        element: (
          <RequireApplicant>
            <DashboardPage />
          </RequireApplicant>
        ),
      },
      { path: '/postings', element: <BrowsePostingsPage /> },
      { path: '/postings/:jobId', element: <PostingDetailPage /> },
      {
        path: '/applications',
        element: (
          <RequireApplicant>
            <MyApplicationsPage />
          </RequireApplicant>
        ),
      },
      {
        path: '/applications/:applicationId',
        element: (
          <RequireApplicant>
            <MyApplicationsPage />
          </RequireApplicant>
        ),
      },
      {
        path: '/profile',
        element: (
          <RequireApplicant>
            <ProfilePage />
          </RequireApplicant>
        ),
      },
      {
        path: '/profile/cvs',
        element: (
          <RequireApplicant>
            <CvLibraryPage />
          </RequireApplicant>
        ),
      },
      {
        path: '/notifications',
        element: (
          <RequireApplicant>
            <NotificationsPage />
          </RequireApplicant>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Sending an application is one sitting's work, so it leaves the rail and
    // the search bar behind and keeps only a way back.
    element: <FocusLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/postings/:jobId/apply',
        element: (
          <RequireApplicant>
            <ApplyPage />
          </RequireApplicant>
        ),
      },
    ],
  },
  {
    // The company app. One guard on the shell rather than one per route: every
    // destination under /company is for recruiters and admins, so the check
    // belongs where the branch starts.
    element: (
      <RequireGroup group="Recruiters">
        <CompanyShell />
      </RequireGroup>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/company', element: <CompanyOverviewPage /> },
      { path: '/company/postings', element: <CompanyPostingsPage /> },
      { path: '/company/postings/:jobId/pipeline', element: <PipelinePage /> },
      { path: '/company/postings/:jobId/applications/:applicationId', element: <ApplicationReviewPage /> },
      { path: '/company/applicants', element: <CompanyApplicantsPage /> },
      // The selected person sits in the path rather than a query string, so a
      // candidate is a link somebody can send.
      { path: '/company/applicants/:applicantId', element: <CompanyApplicantsPage /> },
      { path: '/company/interviews', element: <CompanyInterviewsPage /> },
      { path: '/company/analytics', element: <CompanyAnalyticsPage /> },
      { path: '/company/notifications', element: <NotificationsPage /> },
      { path: '/company/profile', element: <CompanyProfilePage /> },
    ],
  },
  {
    // The admin app, behind one guard on the shell like the company app. The
    // Admins group is written by hand in the Cognito console and by nothing in
    // the code (FR-9.9), so this branch only ever opens for those accounts.
    element: (
      <RequireGroup group="Admins">
        <AdminShell />
      </RequireGroup>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/admin', element: <AdminOverviewPage /> },
      { path: '/admin/companies', element: <AdminCompaniesPage /> },
      { path: '/admin/postings', element: <AdminPostingsPage /> },
    ],
  },
  {
    // The posting editor is one sitting's work as well, so it leaves the rail
    // and the search bar behind and brings its own header and steps.
    element: (
      <RequireGroup group="Recruiters">
        <FocusLayout />
      </RequireGroup>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/company/postings/new', element: <PostingEditorPage /> },
      { path: '/company/postings/:jobId/edit', element: <PostingEditorPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/sign-in',
        element: (
          <RedirectIfSignedIn>
            <SignInPage />
          </RedirectIfSignedIn>
        ),
      },
      {
        path: '/sign-up',
        element: (
          <RedirectIfSignedIn>
            <SignUpPage />
          </RedirectIfSignedIn>
        ),
      },
      {
        // Not behind RedirectIfSignedIn: confirming signs the person in, and the
        // page has to stay to say what comes next. It redirects by itself.
        path: '/sign-up/confirm',
        element: <ConfirmSignUpPage />,
      },
      {
        path: '/sign-in/reset',
        element: (
          <RedirectIfSignedIn>
            <ResetPasswordPage />
          </RedirectIfSignedIn>
        ),
      },
    ],
  },
])
