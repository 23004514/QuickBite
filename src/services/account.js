import { supabase } from '../supabase.js';

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Customers can only change full_name and phone (column-level grant + RLS).
export async function updateProfile(userId, { full_name, phone }) {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name, phone })
    .eq('id', userId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function fetchAddresses() {
  const { data, error } = await supabase
    .from('delivery_addresses')
    .select('id, label, street, suburb, city, postal_code, instructions, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addAddress(userId, address) {
  const { error } = await supabase
    .from('delivery_addresses')
    .insert({ user_id: userId, ...address });
  if (error) throw error;
}

export async function deleteAddress(id) {
  const { error } = await supabase.from('delivery_addresses').delete().eq('id', id);
  if (error) throw error;
}