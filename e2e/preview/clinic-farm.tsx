// Dev-only preview of the clinic's farm read view, mounted on its own so it can be
// driven in a browser without standing up the whole clinic app. Not part of the build.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';
import ClientLivestockDetail from '../../components/clinic/clients/ClientLivestockDetail';

ReactDOM.createRoot(document.getElementById('root')!).render(<ClientLivestockDetail clientId="c1" />);
