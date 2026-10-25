import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function HomePage() {
  const { user } = useAuth();
  return <main className="home-page"><section className="hero paper-panel">
    <p className="eyebrow">Creaseline / catalogue 01</p>
    <h1>Find the line<br /><em>that moves you.</em></h1>
    <p className="hero-copy">A tactile, honest view of the vehicles actually available in your local inventory.</p>
    <Link className="button primary" to={user ? '/vehicles' : '/sign-in'}>{user ? 'Browse vehicles' : 'Sign in to browse'}</Link>
  </section></main>;
}
