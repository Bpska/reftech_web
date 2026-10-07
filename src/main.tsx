/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { ListNotice } from '@/shared/components/ListNotice'; // REQ-PLT-004: "showing the first N" note of a cut list
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ListNotice />
  </StrictMode>
);
