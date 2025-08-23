'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Cliente de Supabase para usar en componentes del lado del cliente (App Router)
export const supabase = createClientComponentClient();
