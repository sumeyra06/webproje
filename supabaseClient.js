// Supabase istemcisi kurulumu
// https://supabase.com/docs/reference/javascript/installing
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Runtime config override support:
// If you place a script that sets window.ENV = { SUPABASE_URL, SUPABASE_ANON_KEY }
// before your modules, these values will be used. Otherwise, the defaults below apply.
// Note: Supabase anon key is PUBLIC by design; protect data with RLS. Do NOT expose service_role keys in the browser.
const ENV = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};

const supabaseUrl = ENV.SUPABASE_URL || 'https://zoifftmnzfpjttpojmup.supabase.co';
const supabaseKey = ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvaWZmdG1uemZwanR0cG9qbXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDg0ODEsImV4cCI6MjA3MzE4NDQ4MX0.9SFI1qS7tPS6U2r3NwYZIu1YBSb7HlN5iv2KCpCXYoM';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Basit test: Kullanıcılar tablosunu çek
export async function getUsers() {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
}

// Notlar (Güvenlik & RLS):
// - Bu projede basit bir kullanıcı tablosu ve client-side hash ile giriş uygulanmıştır.
// - Üretim için Supabase Auth kullanmanız veya parola hash/doğrulamayı server-side yapmanız tavsiye edilir.
// - RLS Örnekleri:
//   CREATE POLICY "signup_insert" ON public.users FOR INSERT TO anon WITH CHECK (true);
//   CREATE POLICY "self_select" ON public.users FOR SELECT USING (
//     email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
//   );
// - Alternatif: Giriş için bir RPC (Postgres function) tanımlayıp email+hash doğrulamasını orada yapın ve sadece id, email, role döndürün.
