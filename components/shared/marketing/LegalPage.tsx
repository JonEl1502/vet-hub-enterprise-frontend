import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export type LegalKind = 'terms' | 'privacy' | 'security';

interface LegalPageProps {
  kind: LegalKind;
  onBack: () => void;
  /** Opens the "Contact us" lead form (footer + inline contact links). */
  onContact?: () => void;
  /** Jump between legal pages without going back to the landing first. */
  onNavigate?: (kind: LegalKind) => void;
}

interface Section {
  heading: string;
  /** Paragraphs and/or bullet lists, rendered in order. */
  body: Array<string | { list: string[] }>;
}

interface LegalDoc {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
}

// Standard SaaS boilerplate tailored to VetHubCore. This is drafted copy meant
// as a working baseline — it is not a substitute for review by a qualified
// lawyer before it is relied upon.
const LAST_UPDATED = 'July 24, 2026';
const CONTACT_EMAIL = 'vethubcore@gmail.com';

const DOCS: Record<LegalKind, LegalDoc> = {
  terms: {
    eyebrow: 'Legal',
    title: 'Terms & Conditions',
    intro:
      'These Terms & Conditions ("Terms") govern your access to and use of the VetHubCore platform, ' +
      'websites, APIs, and related services (together, the "Service") operated by VetHubCore Enterprise ' +
      '("VetHubCore", "we", "us"). By creating an account, accessing, or using the Service you agree to ' +
      'these Terms. If you are using the Service on behalf of a clinic, group, or supplier, you confirm ' +
      'that you are authorised to bind that organisation to these Terms.',
    sections: [
      {
        heading: '1. The Service',
        body: [
          'VetHubCore provides software for veterinary practices, multi-site groups, and the suppliers who serve them — including scheduling and visits, clinical records, inventory, billing, analytics, and marketplace features. We may add, change, or remove features over time to improve the Service.',
          'The Service is a practice-management tool. It does not provide veterinary, medical, or professional advice, and it is not a substitute for the professional judgement of a licensed veterinarian. You remain responsible for all clinical decisions and for compliance with the laws and professional standards that apply to your practice.',
        ],
      },
      {
        heading: '2. Accounts & eligibility',
        body: [
          'You must provide accurate account information and keep it up to date. You are responsible for safeguarding your login credentials and for all activity that occurs under your account. Notify us promptly if you suspect any unauthorised use.',
          'You are responsible for the accounts of staff and users you invite to your workspace, including setting appropriate roles and permissions and removing access when it is no longer needed.',
        ],
      },
      {
        heading: '3. Acceptable use',
        body: [
          'You agree not to misuse the Service. In particular, you will not:',
          {
            list: [
              'Use the Service in violation of any applicable law, regulation, or third-party right.',
              'Upload malicious code or attempt to gain unauthorised access to the Service, other accounts, or our systems.',
              'Interfere with, disrupt, or place an unreasonable load on the Service or its infrastructure.',
              'Reverse engineer, resell, or provide access to the Service except as expressly permitted.',
              'Upload data you do not have the right to use, or that infringes the privacy or intellectual-property rights of others.',
            ],
          },
        ],
      },
      {
        heading: '4. Your data & content',
        body: [
          'You retain all rights to the data and content you and your users submit to the Service ("Your Data"). You grant us a limited licence to host, process, and transmit Your Data solely to provide, secure, and improve the Service, and as described in our Privacy Policy.',
          'You are responsible for the accuracy, quality, and legality of Your Data and for obtaining any consents needed to store it in the Service — including data about pet owners and their animals.',
        ],
      },
      {
        heading: '5. Fees & subscriptions',
        body: [
          'Paid plans are billed in advance on the interval shown at checkout and, unless stated otherwise, renew automatically until cancelled. Fees are exclusive of taxes, which you are responsible for where applicable.',
          'You can cancel at any time; cancellation stops future renewals but does not entitle you to a refund of fees already paid, except where required by law. We may change pricing on reasonable notice, with changes taking effect on your next renewal.',
        ],
      },
      {
        heading: '6. Marketplace & third parties',
        body: [
          'The Service may connect clinics with suppliers and other third parties, and may integrate with third-party services such as payment providers. Transactions and relationships between you and those parties are solely between you and them. VetHubCore is not a party to and is not responsible for those dealings, and third-party services are governed by their own terms.',
        ],
      },
      {
        heading: '7. Intellectual property',
        body: [
          'The Service, including its software, design, and content (excluding Your Data), is owned by VetHubCore and its licensors and is protected by intellectual-property laws. Subject to these Terms, we grant you a non-exclusive, non-transferable right to use the Service for your internal business purposes.',
        ],
      },
      {
        heading: '8. Availability & changes',
        body: [
          'We work to keep the Service available and reliable, but we do not guarantee uninterrupted or error-free operation. We may perform maintenance, and we may suspend or restrict access where reasonably necessary to protect the Service, our users, or to comply with law.',
        ],
      },
      {
        heading: '9. Disclaimers & liability',
        body: [
          'To the fullest extent permitted by law, the Service is provided "as is" and "as available" without warranties of any kind, whether express or implied. We do not warrant that the Service will meet every requirement or be free of defects.',
          'To the fullest extent permitted by law, VetHubCore will not be liable for indirect, incidental, special, or consequential damages, or for loss of profits, revenue, or data. Nothing in these Terms excludes liability that cannot lawfully be excluded.',
        ],
      },
      {
        heading: '10. Termination',
        body: [
          'You may stop using the Service at any time. We may suspend or terminate access if you materially breach these Terms or use the Service in a way that risks harm to others or to the Service. On termination, your right to use the Service ends; we will make Your Data available for export for a reasonable period as described in our documentation, after which it may be deleted.',
        ],
      },
      {
        heading: '11. Changes to these Terms',
        body: [
          'We may update these Terms from time to time. If we make material changes we will provide reasonable notice, for example by email or an in-app notice. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.',
        ],
      },
      {
        heading: '12. Contact',
        body: [
          `Questions about these Terms can be sent to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    intro:
      'This Privacy Policy explains how VetHubCore Enterprise ("VetHubCore", "we", "us") collects, uses, ' +
      'and protects personal information when you use the VetHubCore platform and related services (the ' +
      '"Service"). It applies to clinic staff, suppliers, and pet owners who use the Service.',
    sections: [
      {
        heading: '1. Information we collect',
        body: [
          'We collect information you provide and information generated as you use the Service, including:',
          {
            list: [
              'Account & profile data — name, email, phone, role, clinic or supplier details, and login credentials.',
              'Operational data — clients, patients (animals), appointments and visits, clinical records, inventory, and billing entered by clinic staff.',
              'Payment data — processed by third-party payment providers; we store limited transaction metadata, not full card numbers.',
              'Usage & device data — log data, IP address, browser and device information, and analytics about how the Service is used.',
            ],
          },
        ],
      },
      {
        heading: '2. How we use information',
        body: [
          'We use personal information to:',
          {
            list: [
              'Provide, maintain, and secure the Service and support your account.',
              'Process transactions and manage subscriptions and billing.',
              'Send service, security, and transactional communications, and — where permitted — product updates you can opt out of.',
              'Improve the Service, develop features, and analyse performance.',
              'Detect, prevent, and respond to fraud, abuse, and security incidents, and comply with legal obligations.',
            ],
          },
        ],
      },
      {
        heading: '3. Roles & responsibility',
        body: [
          'When a clinic or supplier uses the Service to manage its own records, that organisation controls how the data is used and is responsible for its own privacy practices. VetHubCore processes that data on their behalf to deliver the Service. For our own account, billing, and website data, VetHubCore is the controller.',
        ],
      },
      {
        heading: '4. Sharing information',
        body: [
          'We do not sell personal information. We share it only as needed to operate the Service:',
          {
            list: [
              'Service providers — hosting, email delivery, payment processing, and analytics, bound by confidentiality and data-protection obligations.',
              'Within the marketplace — where you choose to connect with a clinic or supplier, relevant details are shared to enable that connection.',
              'Legal & safety — where required by law or to protect the rights, safety, and security of users and the Service.',
              'Business transfers — as part of a merger, acquisition, or sale of assets, subject to this Policy.',
            ],
          },
        ],
      },
      {
        heading: '5. Data retention',
        body: [
          'We retain personal information for as long as your account is active or as needed to provide the Service, and thereafter as required to meet legal, accounting, or reporting obligations. You can request export or deletion of data as described below, subject to those obligations.',
        ],
      },
      {
        heading: '6. Your rights',
        body: [
          'Depending on your location, you may have the right to access, correct, export, or delete your personal information, and to object to or restrict certain processing. To exercise these rights, contact us using the details below. If your data is managed by a clinic or supplier, we may direct your request to them as the controller.',
        ],
      },
      {
        heading: '7. Security',
        body: [
          'We use technical and organisational measures to protect personal information, including encryption in transit, access controls, and monitoring. See our Security page for more detail. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
        ],
      },
      {
        heading: '8. International transfers',
        body: [
          'We may process and store information in countries other than where you are located. Where we transfer data across borders, we take steps to ensure it remains protected in line with this Policy and applicable law.',
        ],
      },
      {
        heading: '9. Children',
        body: [
          'The Service is intended for use by businesses and their staff, not by children. We do not knowingly collect personal information directly from children.',
        ],
      },
      {
        heading: '10. Changes & contact',
        body: [
          `We may update this Policy from time to time and will post the updated version with a new "last updated" date. For privacy questions or requests, contact ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  security: {
    eyebrow: 'Trust',
    title: 'Security',
    intro:
      'Veterinary practices trust VetHubCore with sensitive operational and client data. We take that ' +
      'responsibility seriously and build security into the platform at every layer. This page summarises ' +
      'the safeguards we have in place and how to reach us with security concerns.',
    sections: [
      {
        heading: 'Data protection',
        body: [
          {
            list: [
              'Encryption in transit — all traffic to the Service is served over HTTPS/TLS.',
              'Encryption at rest — data is stored on managed infrastructure with encryption at rest.',
              'Isolation — production environments are separated from staging and development.',
            ],
          },
        ],
      },
      {
        heading: 'Access control',
        body: [
          {
            list: [
              'Role-based permissions let clinics and groups grant staff only the access they need, with per-clinic overrides.',
              'Passwords are stored using strong one-way hashing; we never store them in plain text.',
              'Sessions and authentication tokens are scoped and can be revoked.',
              'Internal access to production systems is limited to authorised personnel on a need-to-know basis.',
            ],
          },
        ],
      },
      {
        heading: 'Infrastructure & reliability',
        body: [
          {
            list: [
              'The Service runs on hardened, actively maintained server infrastructure.',
              'We apply security updates to our platform and dependencies on an ongoing basis.',
              'Rate limiting and throttling protect authentication and other sensitive endpoints from abuse.',
              'Backups and monitoring help us detect issues and recover data.',
            ],
          },
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Payments are handled by established third-party providers. Sensitive payment credentials are processed by those providers and are not stored on VetHubCore servers.',
        ],
      },
      {
        heading: 'Your part in security',
        body: [
          'Security is shared. We encourage every organisation to use strong, unique passwords, grant staff the least access they need, review user access regularly, and remove accounts promptly when someone leaves.',
        ],
      },
      {
        heading: 'Reporting a vulnerability',
        body: [
          `If you believe you have found a security vulnerability or have a security concern, please contact us at ${CONTACT_EMAIL}. We appreciate responsible disclosure and will investigate reports promptly.`,
        ],
      },
    ],
  },
};

const OTHER_LEGAL: Array<{ kind: LegalKind; label: string }> = [
  { kind: 'privacy', label: 'Privacy' },
  { kind: 'terms', label: 'Terms' },
  { kind: 'security', label: 'Security' },
];

export default function LegalPage({ kind, onBack, onContact, onNavigate }: LegalPageProps) {
  const doc = DOCS[kind];

  // Land at the top when opening or switching between legal pages.
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch { /* noop */ }
  }, [kind]);

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-[#144E35] font-sans overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm py-4">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#144E35] transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-xl bg-[#1C7A5B] flex items-center justify-center p-1.5"><img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full object-contain" /></div>
            <span className="font-black text-lg tracking-tight text-[#144E35]">VetHub<span className="text-[#F2A41C]">Core</span></span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-16 pb-8 px-6">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-[#1C7A5B] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#1C7A5B]/10 px-4 py-1.5 rounded-full">{doc.eyebrow}</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#144E35] mb-3">{doc.title}</h1>
          <p className="text-slate-400 text-sm font-medium">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>

      {/* Body */}
      <main className="px-6 pb-20">
        <article className="max-w-3xl mx-auto">
          <p className="text-slate-600 text-[15px] leading-relaxed mb-10">{doc.intro}</p>

          {doc.sections.map((section) => (
            <section key={section.heading} className="mb-9">
              <h2 className="text-lg font-black text-[#144E35] mb-3">{section.heading}</h2>
              {section.body.map((block, i) =>
                typeof block === 'string' ? (
                  <p key={i} className="text-slate-600 text-[15px] leading-relaxed mb-3">{block}</p>
                ) : (
                  <ul key={i} className="mb-3 space-y-2">
                    {block.list.map((item) => (
                      <li key={item} className="flex gap-2.5 text-slate-600 text-[15px] leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#1C7A5B] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          ))}

          <p className="text-slate-500 text-sm mt-10">
            Questions? {onContact ? (
              <button onClick={onContact} className="text-[#1C7A5B] font-semibold hover:underline">Get in touch</button>
            ) : (
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1C7A5B] font-semibold hover:underline">{CONTACT_EMAIL}</a>
            )}.
          </p>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-[#144E35] text-white/50 py-8">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#1C7A5B] flex items-center justify-center p-1"><img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full object-contain" /></div>
            <span className="font-black text-white tracking-tight text-sm">VetHub<span className="text-[#F2A41C]">Core</span></span>
          </div>
          <div className="flex gap-6 text-[13px]">
            {OTHER_LEGAL.map(({ kind: k, label }) =>
              k === kind ? (
                <span key={k} className="text-white/70 font-semibold">{label}</span>
              ) : onNavigate ? (
                <button key={k} onClick={() => onNavigate(k)} className="hover:text-white transition-colors">{label}</button>
              ) : (
                <button key={k} onClick={onBack} className="hover:text-white transition-colors">{label}</button>
              )
            )}
          </div>
        </div>
        <p className="max-w-3xl mx-auto px-6 mt-4 text-[12px] text-white/30">© {new Date().getFullYear()} VetHubCore Enterprise. All rights reserved.</p>
      </footer>
    </div>
  );
}
