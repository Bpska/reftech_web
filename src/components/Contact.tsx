import { Reveal } from '@/components/Reveal';
import { CONTACT_INFO, CTA_IMAGE } from '@/data';
import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ name: '', email: '', company: '', phone: '', message: '' });
    }, 4000);
  };

  return (
    <section id="contact" className="relative section-pad bg-mesh overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={CTA_IMAGE}
          alt="Truck at sunset"
          className="h-full w-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: info */}
          <Reveal>
            <div>
              <span className="heading-eyebrow text-frost-300">
                <span className="h-px w-8 bg-frost-400" />
                Contact Us
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white text-balance md:text-4xl lg:text-5xl">
                Let's Build Your{' '}
                <span className="gradient-text">Cold Chain</span> Together
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/60">
                Get in touch with our team to discuss your temperature-sensitive logistics needs.
                We provide tailored 5PL solutions designed around your specific requirements.
              </p>

              <div className="mt-10 space-y-4">
                {CONTACT_INFO.map((item) => (
                  <div
                    key={item.label}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-frost-500/20 text-frost-300 transition-transform group-hover:scale-110">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/40">
                        {item.label}
                      </p>
                      <p className="text-sm font-medium text-white">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Right: form */}
          <Reveal delay={100}>
            <div className="glass-card rounded-3xl p-8 md:p-10">
              {submitted ? (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-deep-900">
                    Message Sent Successfully
                  </h3>
                  <p className="mt-2 text-sm text-deep-500">
                    Thank you for reaching out. Our team will get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="font-display text-xl font-bold text-deep-900">
                    Request a Quote
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-deep-500">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl border border-frost-200 bg-frost-50/30 px-4 py-3 text-sm text-deep-900 outline-none transition-all placeholder:text-deep-300 focus:border-frost-400 focus:bg-white focus:ring-4 focus:ring-frost-100"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-deep-500">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full rounded-xl border border-frost-200 bg-frost-50/30 px-4 py-3 text-sm text-deep-900 outline-none transition-all placeholder:text-deep-300 focus:border-frost-400 focus:bg-white focus:ring-4 focus:ring-frost-100"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-deep-500">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-xl border border-frost-200 bg-frost-50/30 px-4 py-3 text-sm text-deep-900 outline-none transition-all placeholder:text-deep-300 focus:border-frost-400 focus:bg-white focus:ring-4 focus:ring-frost-100"
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-deep-500">
                        Company
                      </label>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        className="w-full rounded-xl border border-frost-200 bg-frost-50/30 px-4 py-3 text-sm text-deep-900 outline-none transition-all placeholder:text-deep-300 focus:border-frost-400 focus:bg-white focus:ring-4 focus:ring-frost-100"
                        placeholder="Company Pvt Ltd"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-deep-500">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full resize-none rounded-xl border border-frost-200 bg-frost-50/30 px-4 py-3 text-sm text-deep-900 outline-none transition-all placeholder:text-deep-300 focus:border-frost-400 focus:bg-white focus:ring-4 focus:ring-frost-100"
                      placeholder="Tell us about your cold chain logistics requirements..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary w-full group"
                  >
                    Send Message
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <p className="text-center text-xs text-deep-400">
                    We respond within 24 hours. Your information stays confidential.
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
