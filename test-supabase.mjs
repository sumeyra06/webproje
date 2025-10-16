import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zoifftmnzfpjttpojmup.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvaWZmdG1uemZwanR0cG9qbXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYwODQ4MSwiZXhwIjoyMDczMTg0NDgxfQ.ZS2JFOW2YdWD_j-mwDvb74n-eeJDLqvQ0sqr4babyyQ';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('Supabase bağlantı hatası:', error);
  } else {
    console.log('Supabase bağlantısı başarılı, örnek veri:', data);
  }
})();
