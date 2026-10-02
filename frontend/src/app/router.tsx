import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireApplicant, RequireGroup, RedirectIfSignedIn } from '@/auth/RouteGuards'
import { useAuth } from '@/auth/AuthProvider'
import { LandingPage } from '@/features/marketing/LandingPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SignInPage } from '@/features/auth/SignInPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { ConfirmSignUpPage } from '@/features/auth/ConfirmSignUpPage'
import { BrowsePostingsPage } from '@/features/postings/BrowsePostingsPage'
import { PostingDetailPage } from '@/features/postings/PostingDetailPage'
import { ApplyPage } from '@/features/apply/ApplyPage'
import { MyApplicationsPage } from '@/features/applications/MyApplicationsPage'
import { ApplicationDetailPage } from '@/features/applications/ApplicationDetailPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { CvLibraryPage } from '@/features/profile/CvLibraryPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { CompanyOverviewPage } from '@/features/company/CompanyOverviewPage'
import { CompanyPostingsPage } from '@/features/company/CompanyPostingsPage'
import { PostingEditorPage } from '@/features/company/PostingEditorPage'
import { PipelinePage } from '@/features/company/PipelinePage'
import { CompanyInterviewsPage } from '@/features/company/CompanyInterviewsPage'
import { CompanyAnalyticsPage } from '@/features/company/CompanyAnalyticsPage'
import { CompanyProfilePage } from '@/features/company/CompanyProfilePage'
import { AppShell } from './AppShell'
import { CompanyShell } from './CompanyShell'
import { AuthLayout } from './AuthLayout'
import { NotFoundPage } from './NotFoundPage'

/**
 * "/" serves two people. A visitor is being sold the product and gets the hero;
 * somebody already signed in has bought it, and their home is the dashboard, so
 * showing them the sales page inside the app's own chrome would be wrong.
 */
function Home() {
  const { status } = useAuth()
  if (status === 'signedIn') return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
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
        path: '/postings/:jobId/apply',
        element: (
          <RequireApplicant>
            <ApplyPage />
          </RequireApplicant>
        ),
      },
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
            <ApplicationDetailPage />
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
    // The company app. One guard on the shell rather than one per route: every
    // destination under /company is for recruiters and admins, so the check
    // belongs where the branch starts.
    element: (
      <RequireGroup group="Recruiters">
        <CompanyShell />
      </RequireGroup>
    ),
    children: [
      { path: '/company', element: <CompanyOverviewPage /> },
      { path: '/company/postings', element: <CompanyPostingsPage /> },
      { path: '/company/postings/new', element: <PostingEditorPage /> },
      { path: '/company/postings/:jobId/edit', element: <PostingEditorPage /> },
      { path: '/company/postings/:jobId/pipeline', element: <PipelinePage /> },
      { path: '/company/interviews', element: <CompanyInterviewsPage /> },
      { path: '/company/analytics', element: <CompanyAnalyticsPage /> },
      { path: '/company/notifications', element: <NotificationsPage /> },
      { path: '/company/profile', element: <CompanyProfilePage /> },
    ],
  },
  {
    element: <AuthLayout />,
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
        path: '/sign-up/confirm',
        element: (
          <RedirectIfSignedIn>
            <ConfirmSignUpPage />
          </RedirectIfSignedIn>
        ),
      },
    ],
  },
])
