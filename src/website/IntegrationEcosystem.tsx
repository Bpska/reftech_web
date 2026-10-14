import { useState, type CSSProperties } from 'react';
import { Building2, Database, Factory, Link2, MapPin, RadioTower, Truck, Warehouse } from 'lucide-react';
import { Reveal } from '@/website/Reveal';

const connections = [
  { title: 'GPS tracking', detail: 'Vehicle positions and route milestones', icon: MapPin },
  { title: 'Warehouses', detail: 'Inventory, docks, chambers, and sensors', icon: Warehouse },
  { title: 'ERP systems', detail: 'SAP, Oracle, Tally, and custom APIs', icon: Database },
  { title: 'Carriers', detail: 'Fleet owners and transport partners', icon: Truck },
  { title: 'Telematics', detail: 'Reefer, fuel, lock, and device events', icon: RadioTower },
  { title: 'Plants', detail: 'Production dispatch and gate operations', icon: Factory },
  { title: 'Government', detail: 'FASTag, e-way bill, GST, and compliance', icon: Building2 },
  { title: 'Webhooks', detail: 'Secure event delivery to your applications', icon: Link2 },
];

export function IntegrationEcosystem() {
  const [active, setActive] = useState(0);
  const selected = connections[active];

  return (
    <section className="ecosystem" aria-labelledby="ecosystem-title">
      <div className="ecosystem__shell">
        <Reveal className="ecosystem__intro">
          <p>Connected logistics ecosystem</p>
          <h2 id="ecosystem-title">One control layer.<br /><span>Every system connected.</span></h2>
          <p className="ecosystem__lede">Select any connection to see how RefTech brings operational data into one dependable logistics view.</p>
          <div className="ecosystem__selected" aria-live="polite">
            <selected.icon aria-hidden="true" />
            <div><span>Selected connection</span><strong>{selected.title}</strong><small>{selected.detail}</small></div>
          </div>
        </Reveal>

        <Reveal className="ecosystem__orbit" delay={100}>
          <div className="ecosystem__radar" aria-hidden="true"><i /><i /><i /></div>
          <div className="ecosystem__core">
            <span>R</span>
            <strong>RefTech</strong>
            <small>API · Intelligence</small>
          </div>
          <div className="ecosystem__nodes" role="list" aria-label="RefTech platform connections">
            {connections.map((item, index) => {
              const angle = (index * 360) / connections.length - 90;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="listitem"
                  className={active === index ? 'is-active' : ''}
                  style={{ '--node-angle': `${angle}deg` } as CSSProperties}
                  onClick={() => setActive(index)}
                  aria-pressed={active === index}
                  aria-label={`Show ${item.title}: ${item.detail}`}
                >
                  <span><item.icon aria-hidden="true" /></span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
