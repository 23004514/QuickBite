import { supabase } from '../supabase.js';

const PRODUCT_FIELDS =
  'id, name, slug, description, price, image_url, is_available, is_popular, categories!inner(id, name, slug)';

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchProducts({ search = '', categorySlug = '', sort = 'popular' } = {}) {
  let query = supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .limit(200);

  if (categorySlug) query = query.eq('categories.slug', categorySlug);

  // Strip characters that have special meaning in PostgREST filters / LIKE patterns
  const term = search.replace(/[%_\\,()*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);

  switch (sort) {
    case 'price-asc':
      query = query.order('price', { ascending: true }).order('name');
      break;
    case 'price-desc':
      query = query.order('price', { ascending: false }).order('name');
      break;
    case 'name':
      query = query.order('name');
      break;
    default:
      query = query.order('is_popular', { ascending: false }).order('name');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchPopularProducts(limit = 8) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .eq('is_popular', true)
    .eq('is_available', true)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// RLS only returns promotions that are public, active and within their dates.
export async function fetchPublicPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('code, description')
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return data ?? [];
}