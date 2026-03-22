import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uartjcwxioirwhmeijtm.supabase.co";
const supabaseKey = "sb_publishable_B_DTQnmbtvkF6IKFbKFhxQ_EpkSpBiS";


export const supabase = createClient(supabaseUrl, supabaseKey);
