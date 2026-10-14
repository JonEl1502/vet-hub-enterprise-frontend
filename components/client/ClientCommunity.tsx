import React from 'react';
import { useNavigate } from 'react-router-dom';
import CommunityApp from '../shared/community/CommunityApp';
import { usePortalMode } from './usePortalMode';

/**
 * Community for a pet owner or farm owner (297).
 *
 * ⚠️ THIS IS THE AUDIENCE THE WHOLE REDESIGN IS FOR. The upsell shown to
 * clinics says pet owners and farmers "are all already here" — and until now
 * they were here as an audience that could not make a sound: the old composer
 * was closed to CLIENT outright and there was nothing else to do but read.
 *
 * (2026-10-14) Clients can now POST too: a plain post, or a pet up for adoption
 * (both free, no add-on). What they still cannot do is originate a DEAL or a
 * MEET — those are an advert or an event under a business's name, and stay with
 * clinics, suppliers and practitioners. The rule lives in
 * `community.controller.ts` (`resolveAuthor`) and `community.service.ts`
 * (`create`); `CommunityFeed`'s `isClient` composer only mirrors it.
 *
 * ⚠️ "Back to work" says "Back to my pets" / "Back to my farm" here. A pet
 * owner has no work to return to, and borrowing the clinic's word would make
 * the exit read as somebody else's button.
 */
const ClientCommunity: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = usePortalMode();
  const isFarm = mode === 'FARM';

  // Same rows the portal nav carries, so the rail cannot drift from it.
  const workLinks = isFarm
    ? [
        { id: '/client/farm', label: 'My Farm' },
        { id: '/client/farm/animals', label: 'Animals' },
        { id: '/client/farm/medical', label: 'Medical' },
        { id: '/client/messages', label: 'Messages' },
        { id: '/client/invoices', label: 'Invoices' },
      ]
    : [
        { id: '/client', label: 'Home' },
        { id: '/client/pets', label: 'Pets' },
        { id: '/client/appointments', label: 'Visits' },
        { id: '/client/messages', label: 'Messages' },
        { id: '/client/invoices', label: 'Invoices' },
      ];

  return (
    <CommunityApp
      onBackToWork={() => navigate(isFarm ? '/client/farm' : '/client')}
      onGoToWorkView={(to) => navigate(to)}
      /* A client has no plan to upgrade for Community — they were never going
         to post. Send them to their own plan page rather than a billing screen
         that would offer them something they cannot use. */
      onGoToBilling={() => navigate('/client/plan')}
      workspaceName={isFarm ? 'My farm' : 'My pets'}
      workLinks={workLinks}
    />
  );
};

export default ClientCommunity;
