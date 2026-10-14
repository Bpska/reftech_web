import { useState, type CSSProperties } from 'react';
import { BatteryMedium, CheckCircle2, DoorOpen, MapPin, Radio, Smartphone, Thermometer, Wifi } from 'lucide-react';
import { Reveal } from '@/website/Reveal';

const readings = [
  { key: 'temperature', label: 'Temperature', value: '4.2°C', status: 'Within range', icon: Thermometer, colour: '#2dd4bf' },
  { key: 'door', label: 'Door sensor', value: 'Closed', status: 'Seal protected', icon: DoorOpen, colour: '#60a5fa' },
  { key: 'location', label: 'Live location', value: 'NH-16', status: 'Near Visakhapatnam', icon: MapPin, colour: '#fb923c' },
] as const;

export function IoTProductSimulator() {
  const [active, setActive] = useState(0);
  const [monitoring, setMonitoring] = useState(true);
  const reading = readings[active];

  return (
    <section className="device-demo" aria-labelledby="device-demo-title">
      <div className="device-demo__shell">
        <Reveal className="device-demo__heading">
          <p><Radio aria-hidden="true" /> Product experience</p>
          <h2 id="device-demo-title">One application.<br /><span>One connected IoT device.</span></h2>
          <p className="device-demo__lede">See how drivers and operations teams receive the same shipment information—from the sensor inside the vehicle to the RefTech mobile application.</p>
          <div className="device-demo__tabs" role="tablist" aria-label="Select a sample IoT reading">
            {readings.map((item, index) => (
              <button key={item.key} type="button" role="tab" aria-selected={active === index} className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
                <item.icon aria-hidden="true" />{item.label}
              </button>
            ))}
          </div>
          <p className="device-demo__notice">Interactive product simulation—not live vehicle or customer data.</p>
        </Reveal>

        <div className="device-demo__stage">
          <Reveal className="device-demo__phone" delay={80}>
            <div className="device-demo__phone-top"><span /><strong>RefTech Driver</strong><small>9:41</small></div>
            <div className="device-demo__app">
              <header><div><span>Active shipment</span><strong>WB 23 RF 2042</strong></div><i className={monitoring ? 'is-online' : ''}>{monitoring ? 'MONITORING' : 'PAUSED'}</i></header>
              <div className="device-demo__route">
                <span><i />Kolkata</span><b />
                <span><i />Chennai</span>
              </div>
              <div className="device-demo__reading" style={{ '--reading-colour': reading.colour } as CSSProperties}>
                <reading.icon aria-hidden="true" />
                <span>{reading.label}</span>
                <strong>{reading.value}</strong>
                <small><CheckCircle2 aria-hidden="true" />{reading.status}</small>
              </div>
              <div className="device-demo__app-grid">
                <div><span>Last update</span><strong>12 sec ago</strong></div>
                <div><span>Signal</span><strong>Strong</strong></div>
              </div>
              <button type="button" onClick={() => setMonitoring((value) => !value)}>{monitoring ? 'Pause demo monitoring' : 'Resume demo monitoring'}</button>
            </div>
            <div className="device-demo__phone-home" />
          </Reveal>

          <div className="device-demo__connection" aria-hidden="true"><i /><i /><i /><span>Encrypted telemetry</span></div>

          <Reveal className="device-demo__sensor-wrap" delay={150}>
            <div className="device-demo__sensor">
              <div className="device-demo__sensor-head"><span>REFTECH</span><i className={monitoring ? 'is-live' : ''} /></div>
              <div className="device-demo__sensor-screen">
                <reading.icon aria-hidden="true" />
                <span>{reading.label}</span>
                <strong>{reading.value}</strong>
                <small>{monitoring ? 'TRANSMITTING' : 'STANDBY'}</small>
              </div>
              <div className="device-demo__sensor-status">
                <span><Wifi aria-hidden="true" />4G LTE</span>
                <span><BatteryMedium aria-hidden="true" />86%</span>
              </div>
              <div className="device-demo__sensor-code">RT-IOT 04 · IP67</div>
            </div>
            <div className="device-demo__sensor-shadow" />
            <div className="device-demo__device-label">
              <Radio aria-hidden="true" />
              <div><span>IoT device</span><strong>Cold-chain tracker</strong><small>Temperature · door · GPS</small></div>
            </div>
          </Reveal>
        </div>

        <div className="device-demo__mobile-note">
          <Smartphone aria-hidden="true" />
          <span>Designed for drivers, supervisors, and operations teams on any screen.</span>
        </div>
      </div>
    </section>
  );
}
