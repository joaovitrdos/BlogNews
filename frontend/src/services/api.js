const BASE = '/api/v1/news';

async function request(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function getLatestNews(n = 6) {
  return request(`/latest?n=${n}`);
}

export function getNewsList({ limit = 18, offset = 0, category } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (category) params.set('category', category);
  return request(`/?${params}`);
}

export function getNewsById(id) {
  return request(`/${id}`);
}

export function getCategories() {
  return request('/categories');
}

export function getRelatedNews(category, excludeId, limit = 4) {
  const params = new URLSearchParams({ limit: limit + 1, category });
  return request(`/?${params}`).then(data => {
    const list = data.news ?? [];
    return list.filter(n => n.id !== excludeId).slice(0, limit);
  });
}
