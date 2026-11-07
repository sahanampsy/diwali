import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Sky } from './components/Sky';
import { DemoBanner, Spinner } from './components/ui';
import { Landing } from './pages/Landing';

const Rsvp = lazy(() => import('./pages/Rsvp'));
const Party = lazy(() => import('./pages/Party'));
const Vote = lazy(() => import('./pages/Vote'));
const Admin = lazy(() => import('./pages/admin/Admin'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <Sky />
      <ScrollTop />
      <DemoBanner />
      <Suspense fallback={<div className="page-center"><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/rsvp" element={<Rsvp />} />
          <Route path="/party" element={<Party />} />
          <Route path="/vote" element={<Vote />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="page-center">
                <h1 className="display-sm">Lost in the fireworks?</h1>
                <Link className="btn btn-primary" to="/">Take me home</Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
