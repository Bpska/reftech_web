import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { About } from '@/components/About';
import { VisionMission } from '@/components/VisionMission';
import { Services } from '@/components/Services';
import { Industries } from '@/components/Industries';
import { Technology } from '@/components/Technology';
import { Stats } from '@/components/Stats';
import { Testimonials } from '@/components/Testimonials';
import { Contact } from '@/components/Contact';
import { Footer } from '@/components/Footer';
import { ScrollProgress } from '@/components/ScrollProgress';
import { BackToTop } from '@/components/BackToTop';
import { ErpAccess } from '@/components/ErpAccess';
import { LoginPage } from '@/components/LoginPage';
import { DashboardPage } from '@/components/DashboardPage';

function App() {
  if (window.location.pathname === '/login') return <LoginPage />;
  if (window.location.pathname === '/dashboard') return <DashboardPage />;
  return (
    <div className="min-h-screen bg-white">
      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <About />
        <VisionMission />
        <Services />
        <Industries />
        <Technology />
        <ErpAccess />
        <Stats />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}

export default App;
