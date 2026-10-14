import { useState } from 'react';
import { ArrowUpRight, CheckCheck, MessageCircle, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Reveal } from '@/website/Reveal';

const WHATSAPP_NUMBER = '917045080808';
const WHATSAPP_MESSAGE = 'sales';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const steps = [
  { number: '01', title: 'Send "sales"', text: 'Start a WhatsApp chat with one simple message.' },
  { number: '02', title: 'Choose a service', text: 'Tell us whether you need transport, warehousing, or technology.' },
  { number: '03', title: 'Share your details', text: 'Add your name, company, route, cargo, and temperature needs.' },
  { number: '04', title: 'Plan the next step', text: 'Our sales team reviews the request and arranges a callback.' },
];

export function WhatsAppSales() {
  const [chatStep, setChatStep] = useState(0);

  return (
    <section className="wa-sales" aria-labelledby="wa-sales-title">
      <div className="wa-sales__grid" aria-hidden="true" />
      <div className="wa-sales__shell">
        <Reveal className="wa-sales__copy">
          <p className="wa-sales__eyebrow"><MessageCircle aria-hidden="true" /> Talk to sales on WhatsApp</p>
          <h2 id="wa-sales-title">Send <span>“sales”.</span><br />We’ll take it from there.</h2>
          <p className="wa-sales__intro">One word starts a guided conversation with RefTech. Share what you need to move, choose the right service, and let our team arrange the next step.</p>
          <ol className="wa-sales__steps">
            {steps.map((step, index) => (
              <li key={step.number} className={chatStep === index ? 'is-featured' : ''}>
                <span>{step.number}</span><strong>{step.title}</strong><p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="wa-sales__actions">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="wa-sales__button" aria-label="Start a sales conversation with RefTech on WhatsApp">
              <MessageCircle aria-hidden="true" />
              <span><strong>Chat on WhatsApp</strong><small>+91 70450 80808 · type “sales”</small></span>
              <ArrowUpRight aria-hidden="true" />
            </a>
            <div className="wa-sales__qr">
              <QRCodeSVG value={WHATSAPP_URL} size={82} bgColor="#ffffff" fgColor="#062d27" level="M" title="Scan to chat with RefTech sales on WhatsApp" />
              <span>Scan with your<br />phone camera</span>
            </div>
          </div>
          <p className="wa-sales__note">Interactive guided demo. WhatsApp opens in a new tab and message charges may apply.</p>
        </Reveal>

        <Reveal className="wa-sales__visual" delay={120}>
          <div className="wa-sales__float wa-sales__float--top"><strong>Try the guided chat.</strong><span>Choose each reply inside the phone</span></div>
          <div className="wa-phone" aria-label="Interactive RefTech WhatsApp sales conversation">
            <div className="wa-phone__speaker" aria-hidden="true" />
            <header className="wa-phone__header">
              <span className="wa-phone__logo">R</span>
              <div><strong>RefTech Sales</strong><small>Interactive demo · replies instantly</small></div>
            </header>
            <div className="wa-phone__chat" aria-live="polite">
              <div className="wa-bubble wa-bubble--in">Welcome to RefTech. Start a guided sales conversation.<button type="button" onClick={() => setChatStep(1)} disabled={chatStep > 0}>Send “sales”</button><time>10:41</time></div>
              {chatStep >= 1 && <>
                <div className="wa-bubble wa-bubble--out">sales<time>10:42 <CheckCheck aria-hidden="true" /></time></div>
                <div className="wa-bubble wa-bubble--in">Which service do you need?<button type="button" onClick={() => setChatStep(2)} disabled={chatStep > 1}>Temperature-controlled transport</button><time>10:42</time></div>
              </>}
              {chatStep >= 2 && <>
                <div className="wa-bubble wa-bubble--out">Temperature-controlled transport<time>10:43 <CheckCheck aria-hidden="true" /></time></div>
                <div className="wa-bubble wa-bubble--in">Share a sample route so we can prepare the right team.<button type="button" onClick={() => setChatStep(3)} disabled={chatStep > 2}>Kolkata → Chennai · 2–8°C</button><time>10:43</time></div>
              </>}
              {chatStep >= 3 && <>
                <div className="wa-bubble wa-bubble--out">Kolkata → Chennai · 2–8°C<time>10:44 <CheckCheck aria-hidden="true" /></time></div>
                <div className="wa-bubble wa-bubble--in">Thank you. A RefTech specialist can now review the sample requirement and arrange a callback.<time>10:44</time></div>
              </>}
            </div>
            <div className="wa-phone__composer">
              <button type="button" className="wa-phone__reset" onClick={() => setChatStep(0)} aria-label="Restart guided chat"><RotateCcw aria-hidden="true" /> Restart demo</button>
              <i><MessageCircle aria-hidden="true" /></i>
            </div>
          </div>
          <div className="wa-sales__float wa-sales__float--bottom"><strong>Step {chatStep + 1} of 4</strong><span>{chatStep === 3 ? 'Ready for a callback' : 'Choose the next reply'}</span></div>
        </Reveal>
      </div>
    </section>
  );
}
