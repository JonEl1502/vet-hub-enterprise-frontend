
import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  activeView: string;
  petName?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ activeView, petName }) => {
  const getBreadcrumbs = () => {
    const parts = [{ label: 'Enterprise', href: '#' }];
    
    switch (activeView) {
      case 'dashboard':
        parts.push({ label: 'Intelligence', href: '#' });
        break;
      case 'patients':
      case 'pet-profile':
        parts.push({ label: 'Patients', href: '#' });
        if (petName) parts.push({ label: petName, href: '#' });
        break;
      case 'clients':
        parts.push({ label: 'Clients', href: '#' });
        break;
      case 'appointments':
      case 'appointment-detail':
        parts.push({ label: 'Appointments', href: '#' });
        break;
      case 'finance':
        parts.push({ label: 'Finance', href: '#' });
        break;
      case 'inventory':
        parts.push({ label: 'Inventory', href: '#' });
        break;
      case 'settings':
        parts.push({ label: 'Settings', href: '#' });
        break;
      default:
        if (activeView && activeView.length > 0) {
          parts.push({ label: activeView.charAt(0).toUpperCase() + activeView.slice(1), href: '#' });
        }
    }
    return parts;
  };

  return (
    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-4">
      {getBreadcrumbs().map((crumb, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={8} className="text-mist dark:text-zinc-800" />}
          <span className={`${idx === getBreadcrumbs().length - 1 ? 'text-pine dark:text-zinc-100' : 'text-seafoam dark:text-zinc-500 hover:text-cyan cursor-pointer transition-colors'}`}>
            {crumb.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumbs;
